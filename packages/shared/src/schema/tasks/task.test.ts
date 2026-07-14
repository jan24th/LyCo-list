import { describe, expect, it } from "vitest";
import { taskInputSchema, taskSchema, taskUpdateSchema } from "./index.js";

const listId = "550e8400-e29b-41d4-a716-446655440000";
const parentId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const userId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("task schemas", () => {
  it("accepts valid task input", () => {
    const result = taskInputSchema.safeParse({
      title: "买牛奶",
      listId,
    });
    expect(result.success).toBe(true);
  });

  it("accepts nested task", () => {
    const result = taskInputSchema.safeParse({
      title: "子任务",
      listId,
      parentId,
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 20 assignees", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId,
      assigneeIds: Array.from({ length: 21 }, () => userId),
    });
    expect(result.success).toBe(false);
  });

  it("rejects recurrence without dueDate", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId,
      recurrence: "daily",
    });
    expect(result.success).toBe(false);
  });

  it("accepts recurrence with dueDate", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId,
      recurrence: "daily",
      dueDate: "2026-07-14",
      dueTime: "09:00",
      timeZone: "Asia/Shanghai",
    });
    expect(result.success).toBe(true);
  });

  it("allows partial update", () => {
    expect(taskUpdateSchema.safeParse({ title: "新标题" }).success).toBe(true);
  });

  it("rejects update recurrence without dueDate", () => {
    expect(taskUpdateSchema.safeParse({ recurrence: "weekly" }).success).toBe(
      false,
    );
  });

  it("accepts full record", () => {
    const result = taskSchema.safeParse({
      id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      title: "买牛奶",
      notes: "",
      listId: "550e8400-e29b-41d4-a716-446655440000",
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
      createdAt: "2026-07-14T00:00:00Z",
      updatedAt: "2026-07-14T00:00:00Z",
      createdBy: userId,
      updatedBy: userId,
    });
    expect(result.success).toBe(true);
  });
});
