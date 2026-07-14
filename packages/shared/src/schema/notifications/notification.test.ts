import { describe, expect, it } from "vitest";
import {
  markNotificationReadInputSchema,
  notificationSchema,
} from "./index.js";

describe("notification schemas", () => {
  it("accepts valid notification", () => {
    const result = notificationSchema.safeParse({
      id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      type: "assignment",
      recipientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      taskTitle: "新任务",
      message: "你被分配了一个新任务",
      isRead: false,
      createdAt: "2026-07-14T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = notificationSchema.safeParse({
      id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      type: "email",
      recipientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      taskTitle: "新任务",
      message: "你被分配了一个新任务",
      createdAt: "2026-07-14T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts notification with TTL", () => {
    const result = notificationSchema.safeParse({
      id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      type: "reminder",
      recipientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      taskTitle: "提醒",
      message: "任务到期",
      isRead: true,
      readAt: "2026-07-14T00:00:00Z",
      createdAt: "2026-07-14T00:00:00Z",
      expiresAtEpoch: 1752460800,
    });
    expect(result.success).toBe(true);
  });

  it("accepts mark read input", () => {
    const result = markNotificationReadInputSchema.safeParse({
      expectedVersion: 3,
    });
    expect(result.success).toBe(true);
  });
});
