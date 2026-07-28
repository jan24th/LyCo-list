import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("../tasks/client.js", () => ({
  documentClient: { send: sendMock },
}));

import { search } from "./db.js";

const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const LIST_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeTaskRecord(overrides: Record<string, unknown> = {}) {
  return {
    PK: `TASK#${overrides.id ?? TASK_ID}`,
    SK: "METADATA",
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${LIST_ID}#PARENT#ROOT#ORDER#0.000000000#TASK#${overrides.id ?? TASK_ID}`,
    entityType: "TASK",
    id: TASK_ID,
    title: "买牛奶",
    notes: "记得买全脂牛奶",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

function makeListRecord(overrides: Record<string, unknown> = {}) {
  return {
    PK: `LIST#${overrides.id ?? LIST_ID}`,
    SK: "METADATA",
    GSI1PK: "LISTS",
    GSI1SK: `ORDER#0.000000000#LIST#${overrides.id ?? LIST_ID}`,
    entityType: "LIST",
    id: LIST_ID,
    name: "购物清单",
    color: "#3b82f6",
    icon: "list",
    order: 0,
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

describe("search", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("finds tasks by title match", async () => {
    sendMock
      .mockResolvedValueOnce({ Items: [makeTaskRecord()] }) // TASKS query
      .mockResolvedValueOnce({ Items: [] }); // LISTS query

    const result = await search("牛奶", 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("task");
    expect(result.items[0].title).toBe("买牛奶");
  });

  it("finds tasks by notes match", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [makeTaskRecord({ title: "随便", notes: "里面有牛奶二字" })],
      })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search("牛奶", 50);

    expect(result.items).toHaveLength(1);
  });

  it("finds lists by name match", async () => {
    sendMock
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [makeListRecord({ name: "购物清单" })] });

    const result = await search("购物", 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("list");
    expect(result.items[0].title).toBe("购物清单");
  });

  it("is case-insensitive", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [makeTaskRecord({ title: "BUY MILK" })],
      })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search("milk", 50);

    expect(result.items).toHaveLength(1);
  });

  it("handles unicode normalization (NFD input, NFC stored)", async () => {
    // "café" with combining accent (NFD) vs precomposed (NFC)
    const nfdQuery = "cafe\u0301"; // NFD
    sendMock
      .mockResolvedValueOnce({
        Items: [makeTaskRecord({ title: "caf\u00e9" })], // NFC
      })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search(nfdQuery, 50);

    expect(result.items).toHaveLength(1);
  });

  it("filters out deleted tasks", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [
          makeTaskRecord({
            title: "match",
            deletedAt: "2026-01-03T00:00:00.000Z",
          }),
          makeTaskRecord({ id: "task-2", title: "match active" }),
        ],
      })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search("match", 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("task-2");
  });

  it("filters out deleted lists", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({
      Items: [
        makeListRecord({
          name: "match",
          deletedAt: "2026-01-03T00:00:00.000Z",
        }),
        makeListRecord({ id: "list-2", name: "match active" }),
      ],
    });

    const result = await search("match", 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("list-2");
  });

  it("sorts results by updatedAt descending", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [
          makeTaskRecord({
            title: "newer",
            updatedAt: "2026-01-03T00:00:00.000Z",
          }),
          makeTaskRecord({
            id: "task-2",
            title: "older",
            updatedAt: "2026-01-01T00:00:00.000Z",
          }),
        ],
      })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search("er", 50);

    expect(result.items[0].title).toBe("newer");
    expect(result.items[1].title).toBe("older");
  });

  it("merges tasks and lists sorted by updatedAt", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [makeTaskRecord({ title: "match-this" })],
      })
      .mockResolvedValueOnce({
        Items: [makeListRecord({ name: "match-also" })],
      });

    const result = await search("match", 50);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].type).toBe("list");
    expect(result.items[1].type).toBe("task");
  });

  it("returns nextCursor when results exceed limit", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [
          makeTaskRecord({ title: "a", updatedAt: "2026-01-10T00:00:00.000Z" }),
          makeTaskRecord({
            id: "task-2",
            title: "b",
            updatedAt: "2026-01-09T00:00:00.000Z",
          }),
          makeTaskRecord({
            id: "task-3",
            title: "c",
            updatedAt: "2026-01-08T00:00:00.000Z",
          }),
        ],
      })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search("", 2);

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeDefined();
  });

  it("returns empty for no matches", async () => {
    sendMock
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] });

    const result = await search("nonexistent", 50);

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });

  it("queries with default limit of 50", async () => {
    sendMock
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] });

    await search("test");

    expect(sendMock.mock.calls[0][0].input.Limit).toBe(1000);
  });
});
