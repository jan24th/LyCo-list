import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("./client.js", () => ({
  documentClient: { send: sendMock },
}));

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { ValidationError } from "@lyco/shared";
import {
  ConflictError,
  NotFoundError,
  completeTask,
  createTask,
  deleteTask,
  getTaskTree,
  moveTask,
  queryTasksByList,
  restoreTask,
  updateTask,
} from "./db.js";

const LIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_LIST_ID = "550e8400-e29b-41d4-a716-446655440001";
const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const PARENT_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const CHILD_ID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
const GRANDCHILD_ID = "6ba7b813-9dad-11d1-80b4-00c04fd430c8";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const NOW = "2026-01-01T00:00:00.000Z";

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "买牛奶",
    notes: "",
    listId: LIST_ID,
    parentId: null,
    assigneeIds: [],
    isCompleted: false,
    isFlagged: false,
    priority: "none" as const,
    recurrence: "none" as const,
    order: 0,
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    title: "买牛奶",
    notes: "",
    listId: LIST_ID,
    parentId: null,
    assigneeIds: [],
    isCompleted: false,
    isFlagged: false,
    priority: "none",
    recurrence: "none",
    order: 0,
    completedAt: null,
    lastCompletedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    ...overrides,
  };
}

function makeDdbRecord(overrides: Record<string, unknown> = {}) {
  const task = makeTask(overrides);
  return {
    PK: `TASK#${task.id}`,
    SK: "METADATA",
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${task.listId}#PARENT#${task.parentId ?? "ROOT"}#ORDER#${(task.order as number).toFixed(9)}#TASK#${task.id}`,
    entityType: "TASK",
    ...task,
  };
}

describe("createTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("creates a root task with version 1 and audit fields", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await createTask(makeInput(), {
      id: TASK_ID,
      userId: USER_ID,
      now: NOW,
    });

    expect(result).toMatchObject({
      id: TASK_ID,
      title: "买牛奶",
      parentId: null,
      version: 1,
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      ConditionExpression: "attribute_not_exists(PK)",
    });
    expect(sendMock.mock.calls[0][0].input.Item).toMatchObject({
      PK: `TASK#${TASK_ID}`,
      SK: "METADATA",
      GSI1PK: "TASKS",
      entityType: "TASK",
    });
    expect(sendMock.mock.calls[0][0].input.Item.GSI1SK).toContain(
      `LIST#${LIST_ID}#PARENT#ROOT#`,
    );
  });

  it("derives listId from the parent when parentId is given", async () => {
    const parentListId = "11111111-2222-4333-8444-555555555555";
    sendMock.mockResolvedValueOnce({
      Item: makeDdbRecord({ id: PARENT_ID, listId: parentListId }),
    });
    sendMock.mockResolvedValueOnce({});

    const result = await createTask(
      makeInput({ title: "子任务", parentId: PARENT_ID }),
      { id: TASK_ID, userId: USER_ID, now: NOW },
    );

    expect(result.listId).toBe(parentListId);
    expect(result.parentId).toBe(PARENT_ID);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][0].input.Item.GSI1SK).toContain(
      `LIST#${parentListId}#PARENT#${PARENT_ID}#`,
    );
  });

  it("throws NotFoundError when the parent does not exist", async () => {
    sendMock.mockResolvedValueOnce({});

    await expect(
      createTask(makeInput({ title: "子任务", parentId: PARENT_ID }), {
        id: TASK_ID,
        userId: USER_ID,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("throws if TABLE_NAME is missing", async () => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
    await expect(
      createTask(makeInput({ title: "x" }), {
        id: TASK_ID,
        userId: USER_ID,
        now: NOW,
      }),
    ).rejects.toThrow("TABLE_NAME environment variable is not set");
  });
});

describe("queryTasksByList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("queries the list prefix and filters deleted and malformed tasks", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeDdbRecord({
          id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
          title: "A",
        }),
        makeDdbRecord({
          id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
          title: "B",
          deletedAt: "2026-01-02T00:00:00.000Z",
        }),
        { PK: "TASK#x", SK: "METADATA", title: "malformed" },
        makeDdbRecord({
          id: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
          title: "C",
        }),
      ],
    });

    const result = await queryTasksByList(LIST_ID, 50);

    expect(result.items.map((t) => t.title)).toEqual(["A", "C"]);
    expect(result.nextCursor).toBeUndefined();
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      TableName: "test-table",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": "TASKS",
        ":prefix": `LIST#${LIST_ID}#`,
      },
    });
  });

  it("returns empty array when the list has no tasks", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const result = await queryTasksByList(LIST_ID, 50);
    expect(result.items).toEqual([]);
  });

  it("treats a missing Items field as an empty page", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await queryTasksByList(LIST_ID, 50);
    expect(result.items).toEqual([]);
  });

  it("stops at limit and exposes nextCursor when more pages remain", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDdbRecord({ id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8" })],
      LastEvaluatedKey: { PK: "TASK#a", SK: "METADATA" },
    });

    const result = await queryTasksByList(LIST_ID, 1);

    expect(result.items).toHaveLength(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(result.nextCursor).toEqual({ PK: "TASK#a", SK: "METADATA" });
  });

  it("resumes from cursor", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });

    await queryTasksByList(LIST_ID, 10, { PK: "TASK#x", SK: "METADATA" });

    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      ExclusiveStartKey: { PK: "TASK#x", SK: "METADATA" },
    });
  });
});

const ROOT_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const DELETED_CHILD_ID = "6ba7b814-9dad-11d1-80b4-00c04fd430c8";

describe("getTaskTree", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("returns the task with a recursively nested children tree", async () => {
    sendMock
      // root GetItem
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ id: ROOT_ID, title: "根" }),
      })
      // children of root
      .mockResolvedValueOnce({
        Items: [
          makeDdbRecord({
            id: CHILD_ID,
            parentId: ROOT_ID,
            title: "子",
            order: 1,
          }),
          makeDdbRecord({
            id: DELETED_CHILD_ID,
            parentId: ROOT_ID,
            title: "已删",
            order: 2,
            deletedAt: "2026-01-02T00:00:00.000Z",
          }),
        ],
      })
      // children of CHILD_ID
      .mockResolvedValueOnce({
        Items: [
          makeDdbRecord({
            id: GRANDCHILD_ID,
            parentId: CHILD_ID,
            title: "孙",
            order: 3,
          }),
        ],
      })
      // children of GRANDCHILD_ID
      .mockResolvedValueOnce({ Items: [] });

    const result = await getTaskTree(ROOT_ID);

    expect(result?.title).toBe("根");
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0].title).toBe("子");
    expect(result?.children[0].children[0].title).toBe("孙");
    expect(result?.children[0].children[0].children).toEqual([]);
    // children query uses the parent prefix
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ExpressionAttributeValues: {
        ":pk": "TASKS",
        ":prefix": `LIST#${LIST_ID}#PARENT#${ROOT_ID}#`,
      },
    });
    expect(sendMock.mock.calls[2][0].input).toMatchObject({
      ExpressionAttributeValues: {
        ":pk": "TASKS",
        ":prefix": `LIST#${LIST_ID}#PARENT#${CHILD_ID}#`,
      },
    });
  });

  it("follows pagination when reading children", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ id: ROOT_ID }) })
      .mockResolvedValueOnce({
        Items: [makeDdbRecord({ id: CHILD_ID, parentId: ROOT_ID, order: 1 })],
        LastEvaluatedKey: { PK: "TASK#a", SK: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [
          makeDdbRecord({ id: GRANDCHILD_ID, parentId: ROOT_ID, order: 2 }),
        ],
      })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] });

    const result = await getTaskTree(ROOT_ID);

    expect(result?.children.map((c) => c.id)).toEqual([
      CHILD_ID,
      GRANDCHILD_ID,
    ]);
    expect(sendMock.mock.calls[2][0].input).toMatchObject({
      ExclusiveStartKey: { PK: "TASK#a", SK: "METADATA" },
    });
  });

  it("returns null when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    expect(await getTaskTree(ROOT_ID)).toBeNull();
  });

  it("treats a missing Items field in children pages as no children", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ id: ROOT_ID }) })
      .mockResolvedValueOnce({});

    const result = await getTaskTree(ROOT_ID);
    expect(result?.children).toEqual([]);
  });

  it("returns null when the task is deleted", async () => {
    sendMock.mockResolvedValueOnce({
      Item: makeDdbRecord({
        id: ROOT_ID,
        deletedAt: "2026-01-02T00:00:00.000Z",
      }),
    });
    expect(await getTaskTree(ROOT_ID)).toBeNull();
  });
});

describe("updateTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("updates editable fields and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ version: 1, title: "旧" }),
      })
      .mockResolvedValueOnce({});

    const result = await updateTask(
      TASK_ID,
      { title: "新", isFlagged: true },
      1,
      USER_ID,
      "2026-01-02T00:00:00.000Z",
    );

    expect(result.title).toBe("新");
    expect(result.isFlagged).toBe(true);
    expect(result.version).toBe(2);
    expect(result.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(result.updatedBy).toBe(USER_ID);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
      ExpressionAttributeValues: { ":expectedVersion": 1 },
    });
  });

  it("throws NotFoundError when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(
      updateTask(TASK_ID, { title: "x" }, 1, USER_ID, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError on version mismatch or deleted task", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "mismatch",
        $metadata: {},
      }),
    );

    await expect(
      updateTask(TASK_ID, { title: "x" }, 1, USER_ID, NOW),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rethrows unexpected errors", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) });
    sendMock.mockRejectedValueOnce(new Error("network boom"));

    await expect(
      updateTask(TASK_ID, { title: "x" }, 1, USER_ID, NOW),
    ).rejects.toThrow("network boom");
  });
});

describe("deleteTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
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

    const result = await deleteTask(
      TASK_ID,
      1,
      USER_ID,
      "2026-01-02T00:00:00.000Z",
    );

    expect(result.deletedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(result.version).toBe(2);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
      ExpressionAttributeValues: expect.objectContaining({
        ":expectedVersion": 1,
        ":nextVersion": 2,
      }),
    });
  });

  it("throws NotFoundError when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(deleteTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ConflictError on version mismatch or already deleted", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "mismatch",
        $metadata: {},
      }),
    );

    await expect(deleteTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "TASK#x", SK: "METADATA", title: "malformed" },
      });

    await expect(deleteTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws NotFoundError when no attributes are returned", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({});

    await expect(deleteTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("completeTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("sets completedAt and isCompleted and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: makeDdbRecord({
          isCompleted: true,
          completedAt: NOW,
          version: 2,
        }),
      });

    const result = await completeTask(TASK_ID, 1, USER_ID, NOW);

    expect(result.isCompleted).toBe(true);
    expect(result.completedAt).toBe(NOW);
    expect(result.version).toBe(2);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
      ExpressionAttributeValues: expect.objectContaining({
        ":expectedVersion": 1,
        ":nextVersion": 2,
        ":now": NOW,
        ":userId": USER_ID,
      }),
    });
  });

  it("throws NotFoundError when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(completeTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects completing a recurring task", async () => {
    sendMock.mockResolvedValueOnce({
      Item: makeDdbRecord({ recurrence: "daily", dueDate: "2026-01-01" }),
    });

    await expect(completeTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "mismatch",
        $metadata: {},
      }),
    );

    await expect(completeTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "TASK#x", SK: "METADATA", title: "malformed" },
      });

    await expect(completeTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("restoreTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("clears completedAt and isCompleted and increments version", async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: makeDdbRecord({
          isCompleted: true,
          completedAt: NOW,
          version: 2,
        }),
      })
      .mockResolvedValueOnce({
        Attributes: makeDdbRecord({ version: 3 }),
      });

    const result = await restoreTask(TASK_ID, 2, USER_ID, NOW);

    expect(result.isCompleted).toBe(false);
    expect(result.completedAt).toBeNull();
    expect(result.version).toBe(3);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      ConditionExpression:
        "version = :expectedVersion AND attribute_not_exists(deletedAt)",
      ExpressionAttributeValues: expect.objectContaining({
        ":expectedVersion": 2,
        ":nextVersion": 3,
      }),
    });
  });

  it("throws NotFoundError when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(restoreTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "mismatch",
        $metadata: {},
      }),
    );

    await expect(restoreTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("throws NotFoundError when returned attributes are malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({
        Attributes: { PK: "TASK#x", SK: "METADATA", title: "malformed" },
      });

    await expect(restoreTask(TASK_ID, 1, USER_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("moveTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  function mockChildrenQuery(items: Record<string, unknown>[]) {
    return { Items: items };
  }

  it("moves a root task to another list and bumps version", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) }) // get task
      .mockResolvedValueOnce({}) // conditional put
      .mockResolvedValueOnce(mockChildrenQuery([])); // cascade children query

    const result = await moveTask(
      TASK_ID,
      { listId: OTHER_LIST_ID, parentId: null, order: 5 },
      1,
      USER_ID,
      NOW,
    );

    expect(result.listId).toBe(OTHER_LIST_ID);
    expect(result.version).toBe(2);
    const putInput = sendMock.mock.calls[1][0].input;
    expect(putInput.ConditionExpression).toBe(
      "version = :expectedVersion AND attribute_not_exists(deletedAt)",
    );
    expect(putInput.ExpressionAttributeValues).toEqual({
      ":expectedVersion": 1,
    });
    expect(putInput.Item).toMatchObject({
      listId: OTHER_LIST_ID,
      parentId: null,
      order: 5,
      version: 2,
      updatedBy: USER_ID,
    });
    expect(putInput.Item.GSI1SK).toContain(`LIST#${OTHER_LIST_ID}#`);
  });

  it("moves a task under a parent in another list", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) }) // get task
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ id: PARENT_ID, listId: OTHER_LIST_ID }),
      }) // get parent
      .mockResolvedValueOnce({}) // conditional put
      .mockResolvedValueOnce(mockChildrenQuery([])); // cascade children query

    const result = await moveTask(
      TASK_ID,
      { listId: OTHER_LIST_ID, parentId: PARENT_ID, order: 1 },
      1,
      USER_ID,
      NOW,
    );

    expect(result.listId).toBe(OTHER_LIST_ID);
    expect(result.parentId).toBe(PARENT_ID);
  });

  it("does not query children when the list does not change", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) }) // get task
      .mockResolvedValueOnce({}); // conditional put

    await moveTask(
      TASK_ID,
      { listId: LIST_ID, parentId: null, order: 9 },
      1,
      USER_ID,
      NOW,
    );

    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("cascades listId to descendants with version bumps", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) }) // get task
      .mockResolvedValueOnce({}) // conditional put for the moved task
      .mockResolvedValueOnce(
        mockChildrenQuery([
          makeDdbRecord({ id: CHILD_ID, parentId: TASK_ID, version: 3 }),
        ]),
      ) // children of moved task
      .mockResolvedValueOnce({}) // put child
      .mockResolvedValueOnce(
        mockChildrenQuery([
          makeDdbRecord({ id: GRANDCHILD_ID, parentId: CHILD_ID, version: 1 }),
        ]),
      ) // children of child
      .mockResolvedValueOnce({}) // put grandchild
      .mockResolvedValueOnce(mockChildrenQuery([])); // children of grandchild

    await moveTask(
      TASK_ID,
      { listId: OTHER_LIST_ID, parentId: null, order: 0 },
      1,
      USER_ID,
      NOW,
    );

    const childPut = sendMock.mock.calls[3][0].input.Item;
    expect(childPut).toMatchObject({
      id: CHILD_ID,
      listId: OTHER_LIST_ID,
      version: 4,
    });
    expect(childPut.GSI1SK).toContain(`LIST#${OTHER_LIST_ID}#`);
    const grandchildPut = sendMock.mock.calls[5][0].input.Item;
    expect(grandchildPut).toMatchObject({
      id: GRANDCHILD_ID,
      listId: OTHER_LIST_ID,
      version: 2,
    });
    // descendants are queried under the OLD list id
    const grandchildQuery = sendMock.mock.calls[4][0].input;
    expect(grandchildQuery.ExpressionAttributeValues[":prefix"]).toBe(
      `LIST#${LIST_ID}#PARENT#${CHILD_ID}#`,
    );
  });

  it("logs and continues when the cascade fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({}) // conditional put succeeds
      .mockRejectedValueOnce(new Error("cascade boom")); // children query fails

    const result = await moveTask(
      TASK_ID,
      { listId: OTHER_LIST_ID, parentId: null, order: 0 },
      1,
      USER_ID,
      NOW,
    );

    expect(result.listId).toBe(OTHER_LIST_ID);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("throws NotFoundError when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(
      moveTask(
        TASK_ID,
        { listId: OTHER_LIST_ID, parentId: null, order: 0 },
        1,
        USER_ID,
        NOW,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the parent does not exist", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({}); // parent missing

    await expect(
      moveTask(
        TASK_ID,
        { listId: OTHER_LIST_ID, parentId: PARENT_ID, order: 0 },
        1,
        USER_ID,
        NOW,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a parent that lives in another list", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({ Item: makeDdbRecord({ id: PARENT_ID }) }); // parent in LIST_ID

    await expect(
      moveTask(
        TASK_ID,
        { listId: OTHER_LIST_ID, parentId: PARENT_ID, order: 0 },
        1,
        USER_ID,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects moving a task under itself", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) })
      .mockResolvedValueOnce({ Item: makeDdbRecord({}) }); // parent is the task itself

    await expect(
      moveTask(
        TASK_ID,
        { listId: LIST_ID, parentId: TASK_ID, order: 0 },
        1,
        USER_ID,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects moving a task under its own descendant", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) }) // the task
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ id: CHILD_ID, parentId: TASK_ID }),
      }); // parent candidate is a direct child

    await expect(
      moveTask(
        TASK_ID,
        { listId: LIST_ID, parentId: CHILD_ID, order: 0 },
        1,
        USER_ID,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("stops the ancestor walk when a mid-chain ancestor is missing", async () => {
    sendMock
      .mockResolvedValueOnce({ Item: makeDdbRecord({ version: 1 }) }) // the task
      .mockResolvedValueOnce({
        Item: makeDdbRecord({ id: PARENT_ID, parentId: GRANDCHILD_ID }),
      }) // parent whose own parent is gone
      .mockResolvedValueOnce({}) // missing mid-chain ancestor
      .mockResolvedValueOnce({}) // conditional put
      .mockResolvedValueOnce(mockChildrenQuery([])); // cascade

    const result = await moveTask(
      TASK_ID,
      { listId: LIST_ID, parentId: PARENT_ID, order: 0 },
      1,
      USER_ID,
      NOW,
    );

    expect(result.parentId).toBe(PARENT_ID);
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeDdbRecord({ version: 2 }) });
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "mismatch",
        $metadata: {},
      }),
    );

    await expect(
      moveTask(
        TASK_ID,
        { listId: OTHER_LIST_ID, parentId: null, order: 0 },
        1,
        USER_ID,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
