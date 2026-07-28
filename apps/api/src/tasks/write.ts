import { createHash } from "node:crypto";
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import { PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  ConflictError,
  NotFoundError,
  type Notification,
  type Task,
  type TaskInput,
  type TaskUpdateBody,
} from "@lyco/shared";
import { getTableName } from "../lib/table.js";
import { documentClient } from "./client.js";
import { buildKeys, getTaskById, toRecord } from "./repo.js";

// ---- Assignment notification helpers ----

const assignmentNotificationNamespace = "f4e9e3e5-9f21-4bf1-8a97-3c1d3f5e5b42";

function createAssignmentNotificationId(
  taskId: string,
  recipientId: string,
  taskVersion: number,
): string {
  const namespace = Buffer.from(
    assignmentNotificationNamespace.replaceAll("-", ""),
    "hex",
  );
  const hash = createHash("sha1")
    .update(namespace)
    .update(`assignment:${taskId}:${recipientId}:${taskVersion}`)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const value = hash.subarray(0, 16).toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16,
  )}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function toAssignmentNotificationRecord(
  task: Task,
  recipientId: string,
  now: string,
): Record<string, unknown> {
  const notification: Notification = {
    id: createAssignmentNotificationId(task.id, recipientId, task.version),
    type: "assignment",
    recipientId,
    taskId: task.id,
    taskTitle: task.title,
    message: "你被分配了一个新任务",
    isRead: false,
    version: 1,
    createdAt: now,
  };
  return {
    PK: `NOTIFICATION#${notification.id}`,
    SK: "METADATA",
    GSI1PK: `USER#${recipientId}#NOTIFICATIONS`,
    GSI1SK: `NOTIFICATION#${now}`,
    entityType: "NOTIFICATION",
    ...notification,
  };
}

async function transactTaskWithAssignmentNotifications(
  task: Task,
  recipientIds: string[],
  now: string,
  expectedVersion?: number,
): Promise<void> {
  const tableName = getTableName();
  try {
    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: toRecord(task),
              ConditionExpression:
                expectedVersion === undefined
                  ? "attribute_not_exists(PK)"
                  : "version = :expectedVersion AND attribute_not_exists(deletedAt)",
              ...(expectedVersion === undefined
                ? {}
                : {
                    ExpressionAttributeValues: {
                      ":expectedVersion": expectedVersion,
                    },
                  }),
            },
          },
          ...recipientIds.map((recipientId) => ({
            Put: {
              TableName: tableName,
              Item: toAssignmentNotificationRecord(task, recipientId, now),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          })),
        ],
      }),
    );
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      throw new ConflictError(`Task ${task.id} write conflict`);
    }
    throw error;
  }
}

// ---- Create ----

export async function createTask(
  input: TaskInput,
  metadata: { id: string; userId: string; now: string },
): Promise<Task> {
  let listId = input.listId;
  if (input.parentId) {
    const parent = await getTaskById(input.parentId);
    if (!parent) {
      throw new NotFoundError(`Parent task ${input.parentId} not found`);
    }
    listId = parent.listId;
  }

  const task: Task = {
    ...input,
    listId,
    id: metadata.id,
    completedAt: null,
    lastCompletedAt: null,
    version: 1,
    createdAt: metadata.now,
    updatedAt: metadata.now,
    createdBy: metadata.userId,
    updatedBy: metadata.userId,
  };

  if (task.assigneeIds.length > 0) {
    await transactTaskWithAssignmentNotifications(
      task,
      task.assigneeIds,
      metadata.now,
    );
  } else {
    await documentClient.send(
      new PutCommand({
        TableName: getTableName(),
        Item: toRecord(task),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  }

  return task;
}

// ---- Update ----

export async function updateTask(
  id: string,
  input: Omit<TaskUpdateBody, "expectedVersion">,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<Task> {
  const existing = await getTaskById(id);
  if (!existing) {
    throw new NotFoundError(`Task ${id} not found`);
  }

  const next: Task = {
    ...existing,
    ...input,
    version: existing.version + 1,
    updatedAt: now,
    updatedBy: userId,
  };

  const addedAssigneeIds =
    input.assigneeIds?.filter(
      (assigneeId) => !existing.assigneeIds.includes(assigneeId),
    ) ?? [];

  if (addedAssigneeIds.length > 0) {
    await transactTaskWithAssignmentNotifications(
      next,
      addedAssigneeIds,
      now,
      expectedVersion,
    );
  } else {
    try {
      await documentClient.send(
        new PutCommand({
          TableName: getTableName(),
          Item: toRecord(next),
          ConditionExpression:
            "version = :expectedVersion AND attribute_not_exists(deletedAt)",
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new ConflictError(`Task ${id} version mismatch`);
      }
      throw error;
    }
  }

  return next;
}

// ---- Delete ----

export async function deleteTask(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<Task> {
  const existing = await getTaskById(id);
  if (!existing) {
    throw new NotFoundError(`Task ${id} not found`);
  }

  const nextVersion = existing.version + 1;
  const undoDate = new Date(new Date(now).getTime() + 30_000);
  const undoUntil = undoDate.toISOString();
  const deletionVersion = nextVersion;

  const jobId = `TASK#${id}`;
  const jobRecord = {
    PK: `DELETION_JOB#${jobId}`,
    SK: "METADATA",
    GSI1PK: "DELETION_JOBS",
    GSI1SK: `RUN#${undoUntil}#JOB#${jobId}`,
    entityType: "DELETION_JOB",
    id: jobId,
    targetType: "TASK",
    targetId: id,
    targetCreatedBy: existing.createdBy,
    deletionVersion,
    undoUntil,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const tableName = getTableName();
  try {
    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName,
              Key: buildKeys(id),
              ConditionExpression:
                "version = :expectedVersion AND attribute_not_exists(deletedAt)",
              UpdateExpression:
                "SET deletedAt = :now, undoUntil = :undoUntil, deletionVersion = :deletionVersion, #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
              ExpressionAttributeNames: { "#version": "version" },
              ExpressionAttributeValues: {
                ":expectedVersion": expectedVersion,
                ":nextVersion": nextVersion,
                ":now": now,
                ":undoUntil": undoUntil,
                ":deletionVersion": deletionVersion,
                ":userId": userId,
              },
              ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: jobRecord,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );

    return {
      ...existing,
      deletedAt: now,
      undoUntil,
      deletionVersion,
      version: nextVersion,
      updatedAt: now,
      updatedBy: userId,
    };
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      throw new ConflictError(`Task ${id} version mismatch`);
    }
    throw error;
  }
}
