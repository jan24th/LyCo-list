import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("./client.js", () => ({
  documentClient: { send: sendMock },
}));

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  ConflictError,
  NotFoundError,
  createList,
  deleteList,
  getListById,
  queryActiveLists,
  restoreList,
  updateList,
} from "./db.js";

function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "购物",
    color: "#3b82f6",
    order: 0,
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    ...overrides,
  };
}

const idA = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const idB = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const idC = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function makeDdbRecord(overrides: Record<string, unknown> = {}) {
  const list = makeList(overrides);
  return {
    PK: `LIST#${list.id}`,
    SK: "METADATA",
    GSI1PK: "LISTS",
    GSI1SK: `ORDER#${list.order.toFixed(9)}#LIST#${list.id}`,
    entityType: "LIST",
    ...list,
  };
}

function clearTableName() {
  // biome-ignore lint/performance/noDelete: need to actually remove the env var
  delete process.env.TABLE_NAME;
}

describe("createList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("creates a list with version 1 and audit fields", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await createList(
      { name: "购物", color: "#3b82f6", order: 1 },
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        userId: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
        now: "2026-01-01T00:00:00.000Z",
      },
    );

    expect(result).toMatchObject({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "购物",
      version: 1,
      createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      ConditionExpression: "attribute_not_exists(PK)",
    });
  });

  it("throws if TABLE_NAME is missing", async () => {
    clearTableName();
    await expect(
      createList(
        { name: "x", color: "#3b82f6", order: 0 },
        { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", userId: "u", now: "t" },
      ),
    ).rejects.toThrow("TABLE_NAME environment variable is not set");
  });
});

describe("queryActiveLists", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("returns active lists and filters deleted", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeDdbRecord({ id: idA, name: "A" }),
        makeDdbRecord({
          id: idB,
          name: "B",
          deletedAt: "2026-01-02T00:00:00.000Z",
        }),
        makeDdbRecord({ id: idC, name: "C" }),
      ],
    });

    const result = await queryActiveLists(50);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((l) => l.name)).toEqual(["A", "C"]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("defaults limit to 50 when not provided", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: idA, name: "A" })],
    });

    const result = await queryActiveLists();

    expect(result.items).toHaveLength(1);
    expect(sendMock.mock.calls[0][0].input.Limit).toBe(50);
  });

  it("skips malformed items", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeDdbRecord({ id: idA, name: "A" }),
        { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
      ],
    });

    const result = await queryActiveLists(50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("A");
  });

  it("returns empty array when no lists", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const result = await queryActiveLists(50);
    expect(result.items).toEqual([]);
  });

  it("handles missing Items field", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await queryActiveLists(50);
    expect(result.items).toEqual([]);
  });

  it("follows pages until limit is filled", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: idA, name: "A" })],
        LastEvaluatedKey: { PK: `LIST#${idA}`, SK: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: idB, name: "B" })],
        LastEvaluatedKey: { PK: `LIST#${idB}`, SK: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: idC, name: "C" })],
      });

    const result = await queryActiveLists(3);

    expect(result.items).toHaveLength(3);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(result.nextCursor).toBeUndefined();
  });

  it("returns nextCursor when more pages remain after limit", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: idA }), makeDdbRecord({ id: idB })],
      LastEvaluatedKey: { PK: `LIST#${idB}`, SK: "METADATA" },
    });

    const result = await queryActiveLists(1);

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toEqual({
      PK: `LIST#${idB}`,
      SK: "METADATA",
    });
  });

  it("clamps limit above 100 to 100", async () => {
    sendMock.mockResolvedValueOnce({
      Items: Array.from({ length: 100 }, (_, i) =>
        makeDdbRecord({ id: idA, name: `Item ${i}` }),
      ),
      LastEvaluatedKey: { PK: `LIST#${idA}`, SK: "METADATA" },
    });

    const result = await queryActiveLists(500);

    expect(result.items).toHaveLength(100);
    expect(sendMock.mock.calls[0][0].input.Limit).toBe(100);
    expect(result.nextCursor).toBeDefined();
  });

  it("clamps limit below 1 to 1", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: idA, name: "Only" })],
      LastEvaluatedKey: { PK: `LIST#${idA}`, SK: "METADATA" },
    });

    const result = await queryActiveLists(0);

    expect(result.items).toHaveLength(1);
    expect(sendMock.mock.calls[0][0].input.Limit).toBe(1);
  });

  it("resumes from cursor", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });

    await queryActiveLists(10, { PK: "LIST#x", SK: "METADATA" });

    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      ExclusiveStartKey: { PK: "LIST#x", SK: "METADATA" },
    });
  });
});

describe("getListById", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("returns parsed list when found", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ name: "Found" }) });
    const result = await getListById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result?.name).toBe("Found");
  });

  it("returns null when not found", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await getListById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result).toBeNull();
  });

  it("returns null when item is malformed", async () => {
    sendMock.mockResolvedValueOnce({
      Item: { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
    });
    const result = await getListById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result).toBeNull();
  });
});

describe("updateList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("updates fields and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ version: 1, name: "Old" }),
      })
      .mockResolvedValueOnce({});

    const result = await updateList(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      { name: "New" },
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-02T00:00:00.000Z",
    );

    expect(result.name).toBe("New");
    expect(result.version).toBe(2);
    expect(result.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
    });
  });

  it("throws NotFoundError when list does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(
      updateList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {}, 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "version mismatch",
        $metadata: {},
      }),
    );

    await expect(
      updateList(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        { name: "x" },
        1,
        "u",
        "t",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) });
    sendMock.mockRejectedValueOnce(new Error("dynamodb down"));

    await expect(
      updateList(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        { name: "x" },
        1,
        "u",
        "t",
      ),
    ).rejects.toThrow("dynamodb down");
  });
});

describe("deleteList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("sets deletedAt and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: makeDdbRecord({
          deletedAt: "2026-01-02T00:00:00.000Z",
          version: 2,
        }),
      });

    const result = await deleteList(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-02T00:00:00.000Z",
    );

    expect(result.deletedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(result.version).toBe(2);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      Key: { PK: "LIST#a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", SK: "METADATA" },
    });
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
    });
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          message: "version mismatch",
          $metadata: {},
        }),
      );

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when list does not exist", async () => {
    sendMock.mockResolvedValueOnce({});

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockRejectedValueOnce(new Error("dynamodb down"));

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toThrow("dynamodb down");
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
      });

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when returned attributes are missing", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({});

    await expect(
      deleteList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("restoreList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    clearTableName();
  });

  it("removes deletedAt and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockResolvedValueOnce({
        Attributes: makeDdbRecord({ version: 3 }),
      });

    const result = await restoreList(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      2,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-03T00:00:00.000Z",
    );

    expect(result.deletedAt).toBeUndefined();
    expect(result.version).toBe(3);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      Key: { PK: "LIST#a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", SK: "METADATA" },
    });
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_exists(deletedAt)",
    });
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          message: "version mismatch",
          $metadata: {},
        }),
      );

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when list does not exist", async () => {
    sendMock.mockResolvedValueOnce({});

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockRejectedValueOnce(new Error("dynamodb down"));

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toThrow("dynamodb down");
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "LIST#x", SK: "METADATA", name: "missing fields" },
      });

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when returned attributes are missing", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) })
      .mockResolvedValueOnce({});

    await expect(
      restoreList("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 2, "u", "t"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
