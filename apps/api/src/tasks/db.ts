import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandOutput,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  type CursorKey,
  type Task,
  type TaskInput,
  type TaskUpdateBody,
  ValidationError,
  formatOrderKey,
  taskSchema,
} from "@lyco/shared";
import { documentClient } from "./client.js";

function getTableName(): string {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME environment variable is not set");
  }
  return tableName;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

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

async function queryDirectChildren(task: Task): Promise<Task[]> {
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
          ":prefix": `LIST#${task.listId}#PARENT#${task.id}#`,
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

  await documentClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: toRecord(task),
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

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

  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression:
          "version = :expectedVersion AND attribute_not_exists(deletedAt)",
        UpdateExpression:
          "SET deletedAt = :now, #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
          ":nextVersion": expectedVersion + 1,
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
