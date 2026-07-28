import { createHash } from "node:crypto";
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandOutput,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ConflictError,
  type CursorKey,
  type MoveTaskInput,
  type Notification,
  NotFoundError,
  type Task,
  type TaskInput,
  type TaskUpdateBody,
  ValidationError,
  formatOrderKey,
  taskSchema,
} from "@lyco/shared";
import { documentClient } from "./client.js";
import { getTableName } from "../lib/table.js";

function buildKeys(id: string) {
  return { PK: `TASK#${id}`, SK: "METADATA" };
}

function buildGsi(task: Task) {
  return {
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${task.listId}#PARENT#${task.parentId ?? "ROOT"}#ORDER#${formatOrderKey(task.order)}#TASK#${task.id}`,
  };
}

function toRecord(task: Task): Record<string, unknown> {
  return {
    ...buildKeys(task.id),
    ...buildGsi(task),
    entityType: "TASK",
    ...task,
  };
}

function toTask(item: Record<string, unknown>): Task | null {
  const parsed = taskSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

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

export async function getTaskById(id: string): Promise<Task | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: buildKeys(id),
    }),
  );
  return response.Item ? toTask(response.Item) : null;
}

export type TaskNode = Task & {
  children: TaskNode[];
};

async function queryChildrenByList(
  listId: string,
  parentId: string,
): Promise<Task[]> {
  const children: Task[] = [];
  let lastEvaluatedKey: CursorKey | undefined;

  do {
    const response: QueryCommandOutput = await documentClient.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": "TASKS",
          ":prefix": `LIST#${listId}#PARENT#${parentId}#`,
        },
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }),
    );

    children.push(
      ...(response.Items ?? [])
        .map(toTask)
        .filter((parsed): parsed is Task => !!parsed && !parsed.deletedAt),
    );
    lastEvaluatedKey = response.LastEvaluatedKey as CursorKey | undefined;
  } while (lastEvaluatedKey);

  return children;
}

async function queryDirectChildren(task: Task): Promise<Task[]> {
  return queryChildrenByList(task.listId, task.id);
}

async function buildNode(task: Task): Promise<TaskNode> {
  const children = await queryDirectChildren(task);
  const childNodes: TaskNode[] = [];
  for (const child of children) {
    childNodes.push(await buildNode(child));
  }
  return { ...task, children: childNodes };
}

export async function getTaskTree(id: string): Promise<TaskNode | null> {
  const task = await getTaskById(id);
  if (!task || task.deletedAt) {
    return null;
  }
  return buildNode(task);
}

export async function queryTasksByList(
  listId: string,
  limit = 50,
  cursor?: CursorKey,
): Promise<{ items: Task[]; nextCursor?: CursorKey }> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const items: Task[] = [];
  let lastEvaluatedKey: CursorKey | undefined = cursor;
  let hasMore = true;

  while (hasMore && items.length < effectiveLimit) {
    const response: QueryCommandOutput = await documentClient.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": "TASKS",
          ":prefix": `LIST#${listId}#`,
        },
        Limit: effectiveLimit - items.length,
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }),
    );

    const pageItems = (response.Items ?? [])
      .map(toTask)
      .filter((parsed): parsed is Task => !!parsed && !parsed.deletedAt);
    const remaining = effectiveLimit - items.length;
    const take = Math.min(pageItems.length, remaining);

    items.push(...pageItems.slice(0, take));
    lastEvaluatedKey = response.LastEvaluatedKey as CursorKey | undefined;
    hasMore = take === pageItems.length && !!lastEvaluatedKey;
  }

  return {
    items,
    ...(lastEvaluatedKey ? { nextCursor: lastEvaluatedKey } : {}),
  };
}

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

async function updateTaskCompletion(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
  completed: boolean,
): Promise<Task> {
  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression:
          "version = :expectedVersion AND attribute_not_exists(deletedAt)",
        UpdateExpression:
          "SET isCompleted = :isCompleted, completedAt = :completedAt, #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
          ":nextVersion": expectedVersion + 1,
          ":isCompleted": completed,
          ":completedAt": completed ? now : null,
          ":now": now,
          ":userId": userId,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    const parsed = toTask(response.Attributes ?? {});
    if (!parsed) {
      throw new NotFoundError(`Task ${id} not found`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`Task ${id} version mismatch`);
    }
    throw error;
  }
}

export async function completeTask(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<Task> {
  const existing = await getTaskById(id);
  if (!existing) {
    throw new NotFoundError(`Task ${id} not found`);
  }
  if (existing.recurrence !== "none") {
    throw new ValidationError("重复任务暂不支持完成");
  }
  return updateTaskCompletion(id, expectedVersion, userId, now, true);
}

export async function restoreTask(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<Task> {
  const existing = await getTaskById(id);
  if (!existing) {
    throw new NotFoundError(`Task ${id} not found`);
  }
  return updateTaskCompletion(id, expectedVersion, userId, now, false);
}

async function cascadeListId(
  parentId: string,
  oldListId: string,
  newListId: string,
  userId: string,
  now: string,
): Promise<void> {
  const children = await queryChildrenByList(oldListId, parentId);
  for (const child of children) {
    const movedChild: Task = {
      ...child,
      listId: newListId,
      version: child.version + 1,
      updatedAt: now,
      updatedBy: userId,
    };
    await documentClient.send(
      new PutCommand({
        TableName: getTableName(),
        Item: toRecord(movedChild),
      }),
    );
    await cascadeListId(child.id, oldListId, newListId, userId, now);
  }
}

export async function moveTask(
  id: string,
  input: Omit<MoveTaskInput, "expectedVersion">,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<Task> {
  const existing = await getTaskById(id);
  if (!existing) {
    throw new NotFoundError(`Task ${id} not found`);
  }

  if (input.parentId) {
    const parent = await getTaskById(input.parentId);
    if (!parent) {
      throw new NotFoundError(`Parent task ${input.parentId} not found`);
    }
    if (parent.listId !== input.listId) {
      throw new ValidationError("parentId 所在列表与目标列表不一致");
    }
    let current: Task | null = parent;
    while (current) {
      if (current.id === id || current.parentId === id) {
        throw new ValidationError("不能将任务移动到自身或其子任务下");
      }
      current = current.parentId ? await getTaskById(current.parentId) : null;
    }
  }

  const next: Task = {
    ...existing,
    listId: input.listId,
    parentId: input.parentId,
    order: input.order,
    version: existing.version + 1,
    updatedAt: now,
    updatedBy: userId,
  };

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

  if (existing.listId !== input.listId) {
    try {
      await cascadeListId(id, existing.listId, input.listId, userId, now);
    } catch (error) {
      console.error(`Failed to cascade list move for task ${id}`, error);
    }
  }

  return next;
}

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
  // undoUntil = now + 30 seconds (ISO 8601)
  const undoDate = new Date(new Date(now).getTime() + 30_000);
  const undoUntil = undoDate.toISOString();
  const deletionVersion = nextVersion;

  // Build DELETION_JOB record
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
    const response = await documentClient.send(
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
