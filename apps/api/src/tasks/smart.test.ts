import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("./client.js", () => ({
  documentClient: { send: sendMock },
}));

import { querySmartList } from "./smart.js";

const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const TASK_ID_2 = "7cb8c922-aebd-22e2-91c5-11d15ee541d9";
const TASK_ID_3 = "8dc9d033-bfce-43f3-a2d6-22e26ff652ea";
const LIST_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    PK: `TASK#${overrides.id ?? TASK_ID}`,
    SK: "METADATA",
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${LIST_ID}#PARENT#ROOT#ORDER#0.000000000#TASK#${overrides.id ?? TASK_ID}`,
    entityType: "TASK",
    id: TASK_ID,
    title: "测试任务",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
    ...overrides,
  };
}

const NOW = "2026-01-15T12:00:00.000Z";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";

describe("querySmartList", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    delete process.env.TABLE_NAME;
  });

  it("today: returns incomplete tasks due today", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({
          title: "今天任务",
          dueDate: "2026-01-15",
          isCompleted: false,
        }),
        makeTask({
          id: TASK_ID_2,
          title: "明天任务",
          dueDate: "2026-01-16",
          isCompleted: false,
        }),
      ],
    });

    const result = await querySmartList("today", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("今天任务");
  });

  it("today: excludes completed tasks", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({
          title: "已完成",
          dueDate: "2026-01-15",
          isCompleted: true,
        }),
      ],
    });

    const result = await querySmartList("today", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(0);
  });

  it("scheduled: returns incomplete tasks with due dates", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({ title: "有日期", dueDate: "2026-06-01" }),
        makeTask({ id: TASK_ID_2, title: "无日期", dueDate: null }),
      ],
    });

    const result = await querySmartList("scheduled", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("有日期");
  });

  it("all: returns all incomplete tasks", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({ title: "待办1" }),
        makeTask({ id: TASK_ID_2, title: "待办2" }),
        makeTask({
          id: TASK_ID_3,
          title: "已完成",
          isCompleted: true,
        }),
      ],
    });

    const result = await querySmartList("all", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((t) => t.title)).toEqual(
      expect.arrayContaining(["待办1", "待办2"]),
    );
  });

  it("flagged: returns flagged incomplete tasks", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({ title: "已标记", isFlagged: true }),
        makeTask({ id: TASK_ID_2, title: "未标记" }),
      ],
    });

    const result = await querySmartList("flagged", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("已标记");
  });

  it("completed: returns completed tasks", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({ title: "已完成", isCompleted: true }),
        makeTask({ id: TASK_ID_2, title: "待办" }),
      ],
    });

    const result = await querySmartList("completed", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("已完成");
  });

  it("assigned: returns tasks assigned to user", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({
          title: "分配给我",
          assigneeIds: [USER_ID],
        }),
        makeTask({
          id: TASK_ID_2,
          title: "未分配",
        }),
      ],
    });

    const result = await querySmartList("assigned", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("分配给我");
  });

  it("filters out deleted tasks", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeTask({
          title: "已删除",
          deletedAt: "2026-01-10T00:00:00.000Z",
        }),
        makeTask({ id: TASK_ID_2, title: "正常" }),
      ],
    });

    const result = await querySmartList("all", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("正常");
  });

  it("loops through DynamoDB pages", async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [makeTask({ title: "page1" })],
        LastEvaluatedKey: { PK: "TASK#p1", SK: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [makeTask({ id: TASK_ID_2, title: "page2" })],
      });

    const result = await querySmartList("all", USER_ID, NOW, 50);

    expect(result.items).toHaveLength(2);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("returns nextCursor when more items may exist", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeTask({ title: "t1" }), makeTask({ id: TASK_ID_2, title: "t2" })],
      LastEvaluatedKey: { PK: "TASK#t2", SK: "METADATA" },
    });

    const result = await querySmartList("all", USER_ID, NOW, 2);

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeDefined();
  });

  it("respects cursor for resumption", async () => {
    const cursor = { PK: "TASK#resume", SK: "METADATA" };
    sendMock.mockResolvedValueOnce({
      Items: [makeTask({ title: "resumed" })],
    });

    const result = await querySmartList("all", USER_ID, NOW, 50, cursor);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input.ExclusiveStartKey).toEqual(cursor);
    expect(result.items).toHaveLength(1);
  });
});
