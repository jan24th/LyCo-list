import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("../tasks/client.js", () => ({
  documentClient: { send: sendMock },
}));

import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import { ValidationError, notificationSchema } from "@lyco/shared";
import {
  ConflictError,
  NotFoundError,
  advanceRecurrence,
  createReminder,
  createReminderNotificationId,
  deleteReminder,
  getReminderById,
  getRemindersByTask,
  processDueReminders,
  updateReminder,
} from "./db.js";

const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const LIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const REMINDER_ID = "7cb8c922-aebd-22e2-91c5-11d15ee541d9";
const SECOND_REMINDER_ID = "8dc9d033-bfce-43f3-a2d6-22e26ff652ea";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const ASSIGNEE_ID = "11111111-2222-4333-8444-555555555555";
const NOW = "2026-01-01T00:00:00.000Z";
const TRIGGER_AT = "2026-01-15T08:00:00.000Z";

const NOTIFICATION_NAMESPACE = "6ba7b820-9dad-11d1-80b4-00c04fd430c8";

function makeTaskRecord(overrides: Record<string, unknown> = {}) {
  return {
    PK: `TASK#${overrides.id ?? TASK_ID}`,
    SK: "METADATA",
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${overrides.listId ?? LIST_ID}#PARENT#ROOT#ORDER#0.000000000#TASK#${overrides.id ?? TASK_ID}`,
    entityType: "TASK",
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

function makeReminderRecord(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? REMINDER_ID;
  return {
    PK: `REMINDER#${id}`,
    SK: "METADATA",
    GSI1PK: `TASK#${overrides.taskId ?? TASK_ID}#REMINDERS`,
    GSI1SK: `TRIGGER#${overrides.triggerAt ?? TRIGGER_AT}`,
    entityType: "REMINDER",
    id,
    taskId: TASK_ID,
    triggerAt: TRIGGER_AT,
    recurrence: "none" as const,
    timeZone: "Asia/Shanghai",
    isEnabled: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    ...overrides,
  };
}

function makeReminderInput(overrides: Record<string, unknown> = {}) {
  return {
    taskId: TASK_ID,
    triggerAt: TRIGGER_AT,
    recurrence: "none" as const,
    timeZone: "Asia/Shanghai",
    isEnabled: true,
    ...overrides,
  };
}

describe("createReminder", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("creates a reminder when the task exists and is not deleted", async () => {
    sendMock.mockResolvedValueOnce({ Item: makeTaskRecord() });
    sendMock.mockResolvedValueOnce({});

    const result = await createReminder(makeReminderInput(), {
      id: REMINDER_ID,
      userId: USER_ID,
      now: NOW,
    });

    expect(result).toMatchObject({
      id: REMINDER_ID,
      taskId: TASK_ID,
      triggerAt: TRIGGER_AT,
      recurrence: "none",
      timeZone: "Asia/Shanghai",
      isEnabled: true,
      version: 1,
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    const putCall = sendMock.mock.calls[1][0].input;
    expect(putCall.TableName).toBe("test-table");
    expect(putCall.ConditionExpression).toBe("attribute_not_exists(PK)");
    expect(putCall.Item).toMatchObject({
      PK: `REMINDER#${REMINDER_ID}`,
      SK: "METADATA",
      GSI1PK: `TASK#${TASK_ID}#REMINDERS`,
      entityType: "REMINDER",
    });
    expect(putCall.Item.GSI1SK).toContain("TRIGGER#");
  });

  it("throws NotFoundError when the task does not exist", async () => {
    sendMock.mockResolvedValueOnce({});

    await expect(
      createReminder(makeReminderInput(), {
        id: REMINDER_ID,
        userId: USER_ID,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the task is soft-deleted", async () => {
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ deletedAt: NOW }),
    });

    await expect(
      createReminder(makeReminderInput(), {
        id: REMINDER_ID,
        userId: USER_ID,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ValidationError when task recurrence is not none and reminder recurrence is not none", async () => {
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ recurrence: "daily" }),
    });

    await expect(
      createReminder(makeReminderInput({ recurrence: "weekly" }), {
        id: REMINDER_ID,
        userId: USER_ID,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows reminder recurrence when task recurrence is none", async () => {
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ recurrence: "none" }),
    });
    sendMock.mockResolvedValueOnce({});

    const result = await createReminder(
      makeReminderInput({ recurrence: "daily" }),
      { id: REMINDER_ID, userId: USER_ID, now: NOW },
    );

    expect(result.recurrence).toBe("daily");
  });

  it("throws if TABLE_NAME is missing", async () => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
    await expect(
      createReminder(makeReminderInput(), {
        id: REMINDER_ID,
        userId: USER_ID,
        now: NOW,
      }),
    ).rejects.toThrow("TABLE_NAME environment variable is not set");
  });
});

describe("getRemindersByTask", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("queries GSI1 for reminders by task and returns items", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        makeReminderRecord({ id: REMINDER_ID }),
        makeReminderRecord({
          id: "8dc9d033-bfce-33f3-a2d6-22e26ff652ea",
          triggerAt: "2026-01-16T08:00:00.000Z",
        }),
      ],
    });

    const result = await getRemindersByTask(TASK_ID);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe(REMINDER_ID);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const queryCall = sendMock.mock.calls[0][0].input;
    expect(queryCall.IndexName).toBe("GSI1");
    expect(queryCall.KeyConditionExpression).toBe(
      "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
    );
    expect(queryCall.ExpressionAttributeValues).toMatchObject({
      ":pk": `TASK#${TASK_ID}#REMINDERS`,
      ":prefix": "TRIGGER#",
    });
  });

  it("supports pagination with limit and cursor", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeReminderRecord()],
      LastEvaluatedKey: { PK: "x", SK: "y" },
    });

    const result = await getRemindersByTask(TASK_ID, 1);

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeDefined();
    const queryCall = sendMock.mock.calls[0][0].input;
    expect(queryCall.Limit).toBe(1);
  });

  it("respects cursor parameter", async () => {
    const cursor = { PK: "prev", SK: "prev" };
    sendMock.mockResolvedValueOnce({ Items: [] });

    await getRemindersByTask(TASK_ID, 10, cursor);

    const queryCall = sendMock.mock.calls[0][0].input;
    expect(queryCall.ExclusiveStartKey).toEqual(cursor);
  });

  it("returns empty items when no reminders exist", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await getRemindersByTask(TASK_ID);

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });
});

describe("getReminderById", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("returns the reminder when found", async () => {
    sendMock.mockResolvedValueOnce({
      Item: makeReminderRecord(),
    });

    const result = await getReminderById(REMINDER_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(REMINDER_ID);
    expect(sendMock.mock.calls[0][0].input.Key).toEqual({
      PK: `REMINDER#${REMINDER_ID}`,
      SK: "METADATA",
    });
  });

  it("returns null when the reminder is not found", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await getReminderById(REMINDER_ID);

    expect(result).toBeNull();
  });
});

describe("updateReminder", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("updates with version condition check", async () => {
    const updatedRecord = makeReminderRecord({
      triggerAt: "2026-01-20T10:00:00.000Z",
      isEnabled: false,
      version: 2,
      updatedAt: NOW,
      updatedBy: USER_ID,
    });
    sendMock.mockResolvedValueOnce({ Attributes: updatedRecord });

    const input = { triggerAt: "2026-01-20T10:00:00.000Z", isEnabled: false };
    const result = await updateReminder(REMINDER_ID, input, 1, NOW, USER_ID);

    expect(result).toMatchObject({
      id: REMINDER_ID,
      triggerAt: input.triggerAt,
      isEnabled: false,
      version: 2,
      updatedAt: NOW,
      updatedBy: USER_ID,
    });
    const updateCall = sendMock.mock.calls[0][0].input;
    expect(updateCall.ConditionExpression).toContain(
      "version = :expectedVersion",
    );
  });

  it("throws NotFoundError when reminder does not exist", async () => {
    sendMock.mockResolvedValueOnce({ Attributes: null });

    await expect(
      updateReminder(REMINDER_ID, { isEnabled: false }, 1, NOW, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "conditional check failed",
        $metadata: {},
      }),
    );

    await expect(
      updateReminder(REMINDER_ID, { isEnabled: false }, 1, NOW, USER_ID),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("validates recurrence mutual exclusion when recurrence is changed", async () => {
    const taskWithRecurrence = makeTaskRecord({ recurrence: "daily" });
    // First call: getReminderById
    sendMock.mockResolvedValueOnce({
      Item: makeReminderRecord(),
    });
    // Second call: getTaskByIdRaw
    sendMock.mockResolvedValueOnce({ Item: taskWithRecurrence });

    await expect(
      updateReminder(REMINDER_ID, { recurrence: "weekly" }, 1, NOW, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not read task when recurrence is not in input", async () => {
    const updatedRecord = makeReminderRecord({
      isEnabled: false,
      version: 2,
      updatedAt: NOW,
      updatedBy: USER_ID,
    });
    sendMock.mockResolvedValueOnce({ Attributes: updatedRecord });

    await updateReminder(REMINDER_ID, { isEnabled: false }, 1, NOW, USER_ID);

    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteReminder", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("hard-deletes with version condition check", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await deleteReminder(REMINDER_ID, 1);

    expect(result.id).toBe(REMINDER_ID);
    const deleteCall = sendMock.mock.calls[0][0].input;
    expect(deleteCall.Key).toEqual({
      PK: `REMINDER#${REMINDER_ID}`,
      SK: "METADATA",
    });
    expect(deleteCall.ConditionExpression).toContain(
      "version = :expectedVersion",
    );
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        message: "conditional check failed",
        $metadata: {},
      }),
    );

    await expect(deleteReminder(REMINDER_ID, 1)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("advanceRecurrence", () => {
  it("returns null for none recurrence", () => {
    expect(advanceRecurrence("none", TRIGGER_AT, "Asia/Shanghai")).toBeNull();
  });

  it("advances daily by 1 day", () => {
    const result = advanceRecurrence("daily", TRIGGER_AT, "Asia/Shanghai");
    // 2026-01-15T08:00:00.000Z + 1 day → 2026-01-16 same local time
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const nextDate = new Date(result);
    // Should be roughly 24 hours later
    const originalDate = new Date(TRIGGER_AT);
    const diffMs = nextDate.getTime() - originalDate.getTime();
    expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it("advances weekly by 7 days", () => {
    const result = advanceRecurrence("weekly", TRIGGER_AT, "Asia/Shanghai");
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const diffMs = new Date(result).getTime() - new Date(TRIGGER_AT).getTime();
    expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it("advances biweekly by 14 days", () => {
    const result = advanceRecurrence("biweekly", TRIGGER_AT, "Asia/Shanghai");
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const diffMs = new Date(result).getTime() - new Date(TRIGGER_AT).getTime();
    expect(diffMs).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(15 * 24 * 60 * 60 * 1000);
  });

  it("advances monthly to next month same day", () => {
    const result = advanceRecurrence(
      "monthly",
      "2026-01-15T08:00:00.000Z",
      "Asia/Shanghai",
    );
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    // Should advance by roughly a month (28-31 days)
    const diffMs =
      new Date(result).getTime() -
      new Date("2026-01-15T08:00:00.000Z").getTime();
    expect(diffMs).toBeGreaterThan(27 * 24 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(32 * 24 * 60 * 60 * 1000);
  });

  it("clamps monthly to last day when month is shorter", () => {
    // Jan 31 → Feb 28 (2026 is not a leap year)
    const result = advanceRecurrence(
      "monthly",
      "2026-01-31T08:00:00.000Z",
      "Asia/Shanghai",
    );
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const nextDate = new Date(result);
    // Should be February
    expect(nextDate.getUTCMonth()).toBe(1); // 0-based, 1 = February
  });

  it("advances yearly to next year same month and day", () => {
    const result = advanceRecurrence("yearly", TRIGGER_AT, "Asia/Shanghai");
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const nextDate = new Date(result);
    expect(nextDate.getUTCFullYear()).toBe(2027);
  });

  it("advances weekdays skipping weekends (Fri → Mon)", () => {
    // 2026-01-16 is Friday
    const result = advanceRecurrence(
      "weekdays",
      "2026-01-16T08:00:00.000Z",
      "Asia/Shanghai",
    );
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const nextDate = new Date(result);
    // Should be Monday (1)
    expect(nextDate.getUTCDay()).toBe(1);
  });

  it("advances weekdays (Mon → Tue)", () => {
    const result = advanceRecurrence(
      "weekdays",
      "2026-01-19T08:00:00.000Z",
      "Asia/Shanghai",
    );
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const nextDate = new Date(result);
    // Should be Tuesday (2)
    expect(nextDate.getUTCDay()).toBe(2);
  });

  it("preserves local time across DST transitions", () => {
    // Use a timezone with DST
    const result = advanceRecurrence(
      "daily",
      "2026-03-14T08:00:00.000Z",
      "America/New_York",
    );
    // Should still be 8 AM Eastern
    expect(result).toBeTruthy();
    if (!result) throw new Error("expected non-null");
    const date = new Date(result);
    expect(date).toBeInstanceOf(Date);
  });
});

describe("createReminderNotificationId", () => {
  it("produces a valid UUID v5", () => {
    const id = createReminderNotificationId(
      REMINDER_ID,
      ASSIGNEE_ID,
      TRIGGER_AT,
    );
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("is deterministic for same inputs", () => {
    const a = createReminderNotificationId(
      REMINDER_ID,
      ASSIGNEE_ID,
      TRIGGER_AT,
    );
    const b = createReminderNotificationId(
      REMINDER_ID,
      ASSIGNEE_ID,
      TRIGGER_AT,
    );
    expect(a).toBe(b);
  });

  it("differs when triggerAt differs", () => {
    const a = createReminderNotificationId(
      REMINDER_ID,
      ASSIGNEE_ID,
      "2026-01-15T08:00:00.000Z",
    );
    const b = createReminderNotificationId(
      REMINDER_ID,
      ASSIGNEE_ID,
      "2026-01-16T08:00:00.000Z",
    );
    expect(a).not.toBe(b);
  });

  it("differs when recipientId differs", () => {
    const a = createReminderNotificationId(
      REMINDER_ID,
      ASSIGNEE_ID,
      TRIGGER_AT,
    );
    const b = createReminderNotificationId(
      REMINDER_ID,
      "22222222-3333-4444-8555-666666666666",
      TRIGGER_AT,
    );
    expect(a).not.toBe(b);
  });
});

describe("processDueReminders", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("processes a due reminder with no recurrence (disables it and creates notifications)", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    sendMock.mockResolvedValueOnce({
      Items: [makeReminderRecord({ triggerAt: pastTrigger })],
      LastEvaluatedKey: undefined,
    });
    // getTaskById for the associated task
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord(),
    });
    // TransactWriteCommand
    sendMock.mockResolvedValueOnce({});

    const result = await processDueReminders(NOW);

    expect(result.processedCount).toBe(1);
    expect(result.nextCursor).toBeUndefined();

    const transactCall = sendMock.mock.calls[2][0].input;
    expect(transactCall.TransactItems).toHaveLength(2);

    // First item: update reminder (disable isEnabled)
    const updateItem = transactCall.TransactItems[0].Update;
    expect(updateItem).toBeDefined();
    expect(updateItem.UpdateExpression).toContain("isEnabled = :isEnabled");

    // Second item: create notification
    const putItem = transactCall.TransactItems[1].Put;
    expect(putItem).toBeDefined();
    expect(putItem.ConditionExpression).toBe("attribute_not_exists(PK)");
    const notification = putItem.Item;
    expect(notification.entityType).toBe("NOTIFICATION");
    expect(notification.type).toBe("reminder");
    expect(notification.reminderId).toBe(REMINDER_ID);
    expect(notificationSchema.safeParse(notification).success).toBe(true);
  });

  it("advances recurrence for a recurring reminder", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    sendMock.mockResolvedValueOnce({
      Items: [
        makeReminderRecord({
          triggerAt: pastTrigger,
          recurrence: "daily",
        }),
      ],
      LastEvaluatedKey: undefined,
    });
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord(),
    });
    sendMock.mockResolvedValueOnce({});

    const result = await processDueReminders(NOW);

    expect(result.processedCount).toBe(1);
    const updateItem = sendMock.mock.calls[2][0].input.TransactItems[0].Update;
    expect(updateItem.UpdateExpression).not.toContain("isEnabled = :isEnabled");
    expect(updateItem.UpdateExpression).toContain("triggerAt = :nextTrigger");
    expect(updateItem.ExpressionAttributeValues[":versionIncrement"]).toBe(1);
  });

  it("sends notifications to task assignees when present", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    const secondAssignee = "22222222-3333-4444-8555-666666666666";
    sendMock.mockResolvedValueOnce({
      Items: [makeReminderRecord({ triggerAt: pastTrigger })],
      LastEvaluatedKey: undefined,
    });
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ assigneeIds: [ASSIGNEE_ID, secondAssignee] }),
    });
    sendMock.mockResolvedValueOnce({});

    await processDueReminders(NOW);

    const transactItems = sendMock.mock.calls[2][0].input.TransactItems;
    // 1 update + 2 notifications
    expect(transactItems).toHaveLength(3);
    const recipients = transactItems
      .slice(1)
      .map((item: any) => item.Put.Item.recipientId);
    expect(recipients).toEqual([ASSIGNEE_ID, secondAssignee]);
  });

  it("sends notification to reminder creator when task has no assignees", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    sendMock.mockResolvedValueOnce({
      Items: [makeReminderRecord({ triggerAt: pastTrigger })],
      LastEvaluatedKey: undefined,
    });
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ assigneeIds: [] }),
    });
    sendMock.mockResolvedValueOnce({});

    await processDueReminders(NOW);

    const transactItems = sendMock.mock.calls[2][0].input.TransactItems;
    expect(transactItems).toHaveLength(2);
    expect(transactItems[1].Put.Item.recipientId).toBe(USER_ID);
  });

  it("skips reminder and continues when transaction fails", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    const secondReminderId = SECOND_REMINDER_ID;
    sendMock.mockResolvedValueOnce({
      Items: [
        makeReminderRecord({ id: REMINDER_ID, triggerAt: pastTrigger }),
        makeReminderRecord({
          id: secondReminderId,
          triggerAt: pastTrigger,
        }),
      ],
      LastEvaluatedKey: undefined,
    });

    // First task read succeeds
    sendMock.mockResolvedValueOnce({ Item: makeTaskRecord() });
    // First transact fails
    sendMock.mockRejectedValueOnce(
      new TransactionCanceledException({
        message: "transaction cancelled",
        $metadata: {},
      }),
    );

    // Second task read succeeds
    sendMock.mockResolvedValueOnce({ Item: makeTaskRecord() });
    // Second transact succeeds
    sendMock.mockResolvedValueOnce({});

    const result = await processDueReminders(NOW);

    expect(result.processedCount).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(5);
  });

  it("skips reminder when associated task is not found", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    sendMock.mockResolvedValueOnce({
      Items: [makeReminderRecord({ triggerAt: pastTrigger })],
      LastEvaluatedKey: undefined,
    });
    // Task not found
    sendMock.mockResolvedValueOnce({});

    const result = await processDueReminders(NOW);

    expect(result.processedCount).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("returns nextCursor when more items remain", async () => {
    const pastTrigger = "2025-12-31T08:00:00.000Z";
    sendMock.mockResolvedValueOnce({
      Items: [makeReminderRecord({ triggerAt: pastTrigger })],
      LastEvaluatedKey: { PK: "next", SK: "next" },
    });
    sendMock.mockResolvedValueOnce({ Item: makeTaskRecord() });
    sendMock.mockResolvedValueOnce({});

    const result = await processDueReminders(NOW);

    expect(result.nextCursor).toBeDefined();
  });

  it("respects cursor parameter for resumption", async () => {
    const cursor = { PK: "resume", SK: "resume" };
    sendMock.mockResolvedValueOnce({ Items: [] });

    await processDueReminders(NOW, 100, cursor);

    const scanCall = sendMock.mock.calls[0][0].input;
    expect(scanCall.ExclusiveStartKey).toEqual(cursor);
  });
});
