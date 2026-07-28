import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import type { CursorKey, Task } from "@lyco/shared";
import { formatOrderKey, taskSchema } from "@lyco/shared";
import { getTableName } from "../lib/table.js";
import { documentClient } from "./client.js";

// ---- Key & GSI builders ----

export function buildKeys(id: string) {
  return { PK: `TASK#${id}`, SK: "METADATA" };
}

export function buildGsi(task: Task) {
  return {
    GSI1PK: "TASKS",
    GSI1SK: `LIST#${task.listId}#PARENT#${task.parentId ?? "ROOT"}#ORDER#${formatOrderKey(task.order)}#TASK#${task.id}`,
  };
}

// ---- Serialization ----

export function toRecord(task: Task): Record<string, unknown> {
  return {
    ...buildKeys(task.id),
    ...buildGsi(task),
    entityType: "TASK",
    ...task,
  };
}

export function toTask(item: Record<string, unknown>): Task | null {
  const parsed = taskSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

// ---- Single-task reads ----

export async function getTaskById(id: string): Promise<Task | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: buildKeys(id),
    }),
  );
  return response.Item ? toTask(response.Item) : null;
}

// ---- Tree ----

// this function is only used internally by getTaskTree
export async function queryChildrenByList(
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

export type TaskNode = Task & {
  children: TaskNode[];
};

export async function getTaskTree(id: string): Promise<TaskNode | null> {
  const task = await getTaskById(id);
  if (!task || task.deletedAt) {
    return null;
  }
  return buildNode(task);
}

// ---- List query ----

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
