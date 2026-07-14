import { describe, expect, it } from "vitest";
import { reminderInputSchema, reminderSchema } from "./index.js";

describe("reminder schemas", () => {
  it("accepts valid input", () => {
    const result = reminderInputSchema.safeParse({
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      triggerAt: "2026-07-14T09:00:00Z",
      timeZone: "Asia/Shanghai",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timeZone", () => {
    const result = reminderInputSchema.safeParse({
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      triggerAt: "2026-07-14T09:00:00Z",
      timeZone: "Invalid/Zone",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid triggerAt", () => {
    const result = reminderInputSchema.safeParse({
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      triggerAt: "not-a-time",
      timeZone: "Asia/Shanghai",
    });
    expect(result.success).toBe(false);
  });

  it("accepts full record", () => {
    const result = reminderSchema.safeParse({
      id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      taskId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      triggerAt: "2026-07-14T09:00:00Z",
      recurrence: "none",
      timeZone: "Asia/Shanghai",
      isEnabled: true,
      version: 1,
      createdAt: "2026-07-14T00:00:00Z",
      updatedAt: "2026-07-14T00:00:00Z",
      createdBy: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      updatedBy: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });
});
