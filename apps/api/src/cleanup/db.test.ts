import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("../tasks/client.js", () => ({
  documentClient: { send: sendMock },
}));

import { processCleanup } from "./db.js";

const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const LIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const JOB_ID = `TASK#${TASK_ID}`;
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const NOW = "2026-01-01T00:00:00.000Z";
const FUTURE = "2026-01-02T00:00:00.000Z";

function makeDeletionJobRecord(overrides: Record<string, unknown> = {}) {
  return {
    PK: `DELETION_JOB#${overrides.id ?? JOB_ID}`,
    SK: "METADATA",
    GSI1PK: "DELETION_JOBS",
    GSI1SK: `RUN#${overrides.undoUntil ?? NOW}#JOB#${overrides.id ?? JOB_ID}`,
    entityType: "DELETION_JOB",
    id: JOB_ID,
    targetType: "TASK",
    targetId: TASK_ID,
    targetCreatedBy: USER_ID,
    deletionVersion: 2,
    undoUntil: NOW,
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTaskRecord(overrides: Record<string, unknown> = {}) {
  return {
    PK: `TASK#${overrides.id ?? TASK_ID}`,
    SK: "METADATA",
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${LIST_ID}#PARENT#ROOT#ORDER#0.000000000#TASK#${overrides.id ?? TASK_ID}`,
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
    deletedAt: NOW,
    deletionVersion: 2,
    undoUntil: NOW,
    version: 2,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    ...overrides,
  };
}

describe("processCleanup", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "test-table";
    sendMock.mockReset();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var
    delete process.env.TABLE_NAME;
  });

  it("processes expired deletion jobs and deletes them", async () => {
    // Query returns one expired job
    sendMock.mockResolvedValueOnce({
      Items: [makeDeletionJobRecord()],
    });
    // GetItem: task still exists with matching deletionVersion
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ deletedAt: NOW, deletionVersion: 2 }),
    });
    // BatchWriteItem: delete task + job
    sendMock.mockResolvedValueOnce({});

    const result = await processCleanup(NOW);

    expect(result.processedCount).toBe(1);

    // BatchWriteItems should contain task + job delete
    const batchCall = sendMock.mock.calls[2][0];
    const deleteRequests = batchCall.input.RequestItems["test-table"];
    expect(deleteRequests).toHaveLength(2);
    // First delete: task
    expect(deleteRequests[0].DeleteRequest.Key).toEqual({
      PK: `TASK#${TASK_ID}`,
      SK: "METADATA",
    });
    // Second delete: DELETION_JOB
    expect(deleteRequests[1].DeleteRequest.Key).toEqual({
      PK: `DELETION_JOB#${JOB_ID}`,
      SK: "METADATA",
    });
  });

  it("skips jobs where deletion version no longer matches", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDeletionJobRecord()],
    });
    // Task version was bumped (e.g. restored then deleted again)
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ deletedAt: NOW, deletionVersion: 99 }),
    });
    // BatchWrite: only delete the job (skip task)
    sendMock.mockResolvedValueOnce({});

    const result = await processCleanup(NOW);

    expect(result.processedCount).toBe(1);
    const batchCall = sendMock.mock.calls[2][0];
    const deleteRequests = batchCall.input.RequestItems["test-table"];
    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0].DeleteRequest.Key.PK).toBe(
      `DELETION_JOB#${JOB_ID}`,
    );
  });

  it("skips jobs where target no longer exists (already cleaned)", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [makeDeletionJobRecord()],
    });
    // Task not found — cleanup still removes the job
    sendMock.mockResolvedValueOnce({});
    sendMock.mockResolvedValueOnce({});

    const result = await processCleanup(NOW);

    expect(result.processedCount).toBe(1);
    const batchCall = sendMock.mock.calls[2][0];
    const deleteRequests = batchCall.input.RequestItems["test-table"];
    expect(deleteRequests).toHaveLength(1);
  });

  it("filters jobs that are not yet due", async () => {
    // Job has future undoUntil — should not be returned by query
    sendMock.mockResolvedValueOnce({ Items: [] });

    const result = await processCleanup(NOW);

    expect(result.processedCount).toBe(0);
  });

  it("returns nextCursor when more jobs exist", async () => {
    const cursor = { PK: "DELETION_JOB#next", SK: "METADATA" };
    sendMock.mockResolvedValueOnce({
      Items: [makeDeletionJobRecord()],
      LastEvaluatedKey: cursor,
    });
    sendMock.mockResolvedValueOnce({ Item: null });
    sendMock.mockResolvedValueOnce({});

    const result = await processCleanup(NOW);

    expect(result.nextCursor).toEqual(cursor);
  });

  it("resumes from cursor", async () => {
    const cursor = { PK: "DELETION_JOB#prev", SK: "METADATA" };
    sendMock.mockResolvedValueOnce({ Items: [] });

    await processCleanup(NOW, 100, cursor);

    expect(sendMock.mock.calls[0][0].input.ExclusiveStartKey).toEqual(cursor);
  });

  it("retries UnprocessedItems", async () => {
    const taskKey = { PK: `TASK#${TASK_ID}`, SK: "METADATA" };
    const jobKey = { PK: `DELETION_JOB#${JOB_ID}`, SK: "METADATA" };

    sendMock.mockResolvedValueOnce({
      Items: [makeDeletionJobRecord()],
    });
    sendMock.mockResolvedValueOnce({
      Item: makeTaskRecord({ deletedAt: NOW, deletionVersion: 2 }),
    });
    // First batch: returns UnprocessedItems
    sendMock.mockResolvedValueOnce({
      UnprocessedItems: {
        "test-table": [{ DeleteRequest: { Key: taskKey } }],
      },
    });
    // Retry succeeds
    sendMock.mockResolvedValueOnce({});

    const result = await processCleanup(NOW);

    expect(result.processedCount).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(4);
  });
});
