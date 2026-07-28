import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("../tasks/client.js", () => ({
  documentClient: { send: sendMock },
}));

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  ConflictError,
  getNotificationById,
  listNotifications,
  markNotificationRead,
} from "./db.js";

const NOTIFICATION_ID = "7cb8c922-aebd-22e2-91c5-11d15ee541d9";
const SECOND_NOTIFICATION_ID = "8dc9d033-bfce-43f3-a2d6-22e26ff652ea";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const NOW = "2026-01-01T00:00:00.000Z";
const NOW_EPOCH = Math.floor(new Date(NOW).getTime() / 1000);

function makeNotificationRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    PK: `NOTIFICATION#${overrides.id ?? NOTIFICATION_ID}`,
    SK: "METADATA",
    GSI1PK: `USER#${overrides.recipientId ?? USER_ID}#NOTIFICATIONS`,
    GSI1SK: `NOTIFICATION#${overrides.createdAt ?? NOW}`,
    entityType: "NOTIFICATION",
    id: NOTIFICATION_ID,
    type: "assignment",
    recipientId: USER_ID,
    taskId: TASK_ID,
    taskTitle: "买牛奶",
    message: "你被分配了一个新任务",
    isRead: false,
    version: 1,
    createdAt: NOW,
    ...overrides,
  };
}

describe("listNotifications", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date(NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("queries GSI1 for user notifications sorted newest first", async () => {
    const record = makeNotificationRecord();
    sendMock.mockResolvedValueOnce({ Items: [record] });

    const result = await listNotifications(USER_ID);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.input.TableName).toBeDefined();
    expect(call.input.IndexName).toBe("GSI1");
    expect(call.input.KeyConditionExpression).toContain("GSI1PK");
    expect(call.input.KeyConditionExpression).toContain("GSI1SK");
    expect(call.input.ScanIndexForward).toBe(false);
    expect(call.input.ExpressionAttributeValues[":pk"]).toBe(
      `USER#${USER_ID}#NOTIFICATIONS`,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(NOTIFICATION_ID);
  });

  it("returns items with pagination cursor when more items exist", async () => {
    const record = makeNotificationRecord();
    const lastKey = { PK: "NOTIFICATION#x", SK: "METADATA" };
    sendMock.mockResolvedValueOnce({
      Items: [record],
      LastEvaluatedKey: lastKey,
    });

    const result = await listNotifications(USER_ID);

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toEqual(lastKey);
  });

  it("filters out expired notifications via FilterExpression", async () => {
    const active = makeNotificationRecord({
      id: SECOND_NOTIFICATION_ID,
    });
    sendMock.mockResolvedValueOnce({ Items: [active] });

    const result = await listNotifications(USER_ID);

    // Verify the FilterExpression uses the correct epoch
    const call = sendMock.mock.calls[0][0];
    expect(call.input.FilterExpression).toContain("attribute_not_exists");
    expect(call.input.FilterExpression).toContain("expiresAtEpoch");
    expect(call.input.ExpressionAttributeValues[":nowEpoch"]).toBe(NOW_EPOCH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(SECOND_NOTIFICATION_ID);
  });

  it("passes cursor as ExclusiveStartKey for pagination", async () => {
    const cursor = { PK: "NOTIFICATION#prev", SK: "METADATA" };
    sendMock.mockResolvedValueOnce({ Items: [] });

    await listNotifications(USER_ID, 10, cursor);

    const call = sendMock.mock.calls[0][0];
    expect(call.input.Limit).toBe(10);
    expect(call.input.ExclusiveStartKey).toEqual(cursor);
  });

  it("uses default limit of 50", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });

    await listNotifications(USER_ID);

    const call = sendMock.mock.calls[0][0];
    expect(call.input.Limit).toBe(50);
  });
});

describe("getNotificationById", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    vi.clearAllMocks();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("returns a notification when found", async () => {
    const record = makeNotificationRecord();
    sendMock.mockResolvedValueOnce({ Item: record });

    const result = await getNotificationById(NOTIFICATION_ID);

    expect(result).not.toBeNull();
    if (!result) throw new Error("expected non-null");
    expect(result.id).toBe(NOTIFICATION_ID);
    expect(result.type).toBe("assignment");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.input.Key).toEqual({
      PK: `NOTIFICATION#${NOTIFICATION_ID}`,
      SK: "METADATA",
    });
  });

  it("returns null when notification not found", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await getNotificationById(NOTIFICATION_ID);

    expect(result).toBeNull();
  });
});

describe("markNotificationRead", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date(NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("marks notification as read and sets TTL", async () => {
    const updatedRecord = makeNotificationRecord({
      isRead: true,
      readAt: NOW,
      expiresAtEpoch: NOW_EPOCH + 7 * 24 * 60 * 60,
      version: 2,
    });
    sendMock.mockResolvedValueOnce({ Attributes: updatedRecord });

    const result = await markNotificationRead(NOTIFICATION_ID, 1, NOW);

    expect(result).toMatchObject({
      id: NOTIFICATION_ID,
      isRead: true,
      version: 2,
    });
    expect(result.expiresAtEpoch).toBe(NOW_EPOCH + 7 * 24 * 60 * 60);

    const call = sendMock.mock.calls[0][0];
    expect(call.input.Key).toEqual({
      PK: `NOTIFICATION#${NOTIFICATION_ID}`,
      SK: "METADATA",
    });
    expect(call.input.ConditionExpression).toContain(
      "#version = :expectedVersion",
    );
    expect(call.input.UpdateExpression).toContain("isRead = :isRead");
    expect(call.input.UpdateExpression).toContain(
      "expiresAtEpoch = :expiresAtEpoch",
    );
    expect(call.input.ReturnValues).toBe("ALL_NEW");
  });

  it("throws ConflictError on version mismatch", async () => {
    sendMock.mockRejectedValueOnce(
      new ConditionalCheckFailedException({ $metadata: {}, message: "" }),
    );

    await expect(
      markNotificationRead(NOTIFICATION_ID, 1, NOW),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws on unexpected errors", async () => {
    sendMock.mockRejectedValueOnce(new Error("network error"));

    await expect(markNotificationRead(NOTIFICATION_ID, 1, NOW)).rejects.toThrow(
      "network error",
    );
  });
});
