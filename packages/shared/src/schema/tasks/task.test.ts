import { describe, expect, it } from "vitest";
import {
  taskCompleteBodySchema,
  taskDeleteQuerySchema,
  taskInputSchema,
  taskRestoreBodySchema,
  taskSchema,
  taskUpdateBodySchema,
  taskUpdateSchema,
} from "./index.js";

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
      assigneeIds: Array.from(
        { length: 21 },
        (_, index) =>
          `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
      ),
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate assignees", () => {
    const result = taskInputSchema.safeParse({
      title: "A",
      listId,
      assigneeIds: [userId, userId],
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

describe("taskUpdateBodySchema", () => {
  it("requires expectedVersion and allows partial editable fields", () => {
    const result = taskUpdateBodySchema.parse({
      title: "新标题",
      isFlagged: true,
      expectedVersion: 2,
    });
    expect(result).toEqual({
      title: "新标题",
      isFlagged: true,
      expectedVersion: 2,
    });
  });

  it("strips listId, parentId and isCompleted", () => {
    const result = taskUpdateBodySchema.parse({
      title: "新标题",
      listId: "550e8400-e29b-41d4-a716-446655440000",
      parentId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      isCompleted: true,
      expectedVersion: 1,
    });
    expect(result).toEqual({ title: "新标题", expectedVersion: 1 });
  });

  it("rejects missing expectedVersion", () => {
    expect(taskUpdateBodySchema.safeParse({ title: "x" }).success).toBe(false);
  });

  it("rejects negative expectedVersion", () => {
    expect(
      taskUpdateBodySchema.safeParse({ expectedVersion: -1 }).success,
    ).toBe(false);
  });

  it("rejects duplicate assignees", () => {
    expect(
      taskUpdateBodySchema.safeParse({
        assigneeIds: [userId, userId],
        expectedVersion: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects recurrence without dueDate", () => {
    expect(
      taskUpdateBodySchema.safeParse({
        recurrence: "daily",
        expectedVersion: 1,
      }).success,
    ).toBe(false);
  });
});

describe("taskDeleteQuerySchema", () => {
  it("coerces string expectedVersion", () => {
    expect(taskDeleteQuerySchema.parse({ expectedVersion: "3" })).toEqual({
      expectedVersion: 3,
    });
  });

  it("rejects missing expectedVersion", () => {
    expect(taskDeleteQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("taskCompleteBodySchema", () => {
  it("accepts expectedVersion", () => {
    expect(taskCompleteBodySchema.parse({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
  });

  it("rejects missing expectedVersion", () => {
    expect(taskCompleteBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("taskRestoreBodySchema", () => {
  it("accepts expectedVersion", () => {
    expect(taskRestoreBodySchema.parse({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
  });

  it("rejects missing expectedVersion", () => {
    expect(taskRestoreBodySchema.safeParse({}).success).toBe(false);
  });
});
