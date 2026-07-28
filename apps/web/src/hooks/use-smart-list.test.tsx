import { describe, expect, it } from "vitest";
import type { SmartListType } from "./use-smart-list";

// Standalone filter logic for unit testing (uses fixed dates)

function priorityValue(priority: string): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 3;
    default:
      return 2;
  }
}

interface TestTask {
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  isFlagged: boolean;
  priority: string;
  assigneeIds: string[];
  createdAt: string;
  completedAt: string | null;
}

// Fixed "today" range: Jan 15, 2026
const todayStart = "2026-01-15T00:00:00.000Z";
const todayEnd = "2026-01-16T00:00:00.000Z";

function filterAndSort(
  tasks: TestTask[],
  type: SmartListType,
  userId?: string,
) {
  let filtered: TestTask[];

  switch (type) {
    case "today":
      filtered = tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.dueDate != null &&
          t.dueDate >= todayStart &&
          t.dueDate < todayEnd,
      );
      filtered.sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          priorityValue(a.priority) - priorityValue(b.priority),
      );
      break;
    case "scheduled":
      filtered = tasks.filter((t) => !t.isCompleted && t.dueDate != null);
      filtered.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
      break;
    case "all":
      filtered = tasks.filter((t) => !t.isCompleted);
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    case "flagged":
      filtered = tasks.filter((t) => !t.isCompleted && t.isFlagged);
      filtered.sort(
        (a, b) =>
          priorityValue(a.priority) - priorityValue(b.priority) ||
          (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
      );
      break;
    case "completed":
      filtered = tasks.filter((t) => t.isCompleted);
      filtered.sort(
        (a, b) =>
          new Date(b.completedAt ?? 0).getTime() -
          new Date(a.completedAt ?? 0).getTime(),
      );
      break;
    case "assigned":
      filtered = tasks.filter(
        (t) =>
          !t.isCompleted && userId != null && t.assigneeIds.includes(userId),
      );
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    default:
      filtered = tasks;
  }

  return filtered;
}

const sampleTasks: TestTask[] = [
  {
    title: "买牛奶",
    isCompleted: false,
    dueDate: "2026-01-16T00:00:00.000Z", // tomorrow boundary — NOT in today
    isFlagged: false,
    priority: "none",
    assigneeIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  },
  {
    title: "写报告",
    isCompleted: false,
    dueDate: "2026-01-15T12:00:00.000Z", // today
    isFlagged: true,
    priority: "high",
    assigneeIds: ["user-1"],
    createdAt: "2026-01-02T00:00:00.000Z",
    completedAt: null,
  },
  {
    title: "洗澡",
    isCompleted: false,
    dueDate: null,
    isFlagged: false,
    priority: "low",
    assigneeIds: [],
    createdAt: "2026-01-03T00:00:00.000Z",
    completedAt: null,
  },
  {
    title: "已完成任务",
    isCompleted: true,
    dueDate: null,
    isFlagged: true,
    priority: "none",
    assigneeIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-10T00:00:00.000Z",
  },
  {
    title: "计划任务",
    isCompleted: false,
    dueDate: "2026-06-15T12:00:00.000Z",
    isFlagged: false,
    priority: "high",
    assigneeIds: ["user-1"],
    createdAt: "2026-01-04T00:00:00.000Z",
    completedAt: null,
  },
];

describe("smart list filter", () => {
  it("today: shows incomplete tasks due today", () => {
    const result = filterAndSort(sampleTasks, "today");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("写报告");
  });

  it("scheduled: shows incomplete tasks with due dates", () => {
    const result = filterAndSort(sampleTasks, "scheduled");
    expect(result).toHaveLength(3); // 买牛奶, 写报告, 计划任务
    expect(result[0].title).toBe("写报告"); // earlieste due date (Jan 15)
  });

  it("all: shows all incomplete tasks", () => {
    const result = filterAndSort(sampleTasks, "all");
    expect(result).toHaveLength(4); // all incomplete
    expect(result[0].title).toBe("计划任务"); // most recent createdAt (Jan 4)
  });

  it("flagged: shows flagged incomplete tasks", () => {
    const result = filterAndSort(sampleTasks, "flagged");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("写报告");
  });

  it("completed: shows completed tasks sorted by completedAt desc", () => {
    const result = filterAndSort(sampleTasks, "completed");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("已完成任务");
  });

  it("assigned: shows tasks assigned to user", () => {
    const result = filterAndSort(sampleTasks, "assigned", "user-1");
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.title)).toContain("写报告");
    expect(result.map((t) => t.title)).toContain("计划任务");
  });

  it("assigned: empty when no user id", () => {
    const result = filterAndSort(sampleTasks, "assigned");
    expect(result).toHaveLength(0);
  });

  it("handles empty input", () => {
    const result = filterAndSort([], "today");
    expect(result).toHaveLength(0);
  });
});
