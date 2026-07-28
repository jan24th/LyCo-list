import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  ConflictError,
  type MoveTaskInput,
  NotFoundError,
  type Task,
  ValidationError,
} from "@lyco/shared";
import { getTableName } from "../lib/table.js";
import { documentClient } from "./client.js";
import {
  buildKeys,
  getTaskById,
  queryChildrenByList,
  toRecord,
  toTask,
} from "./repo.js";

// ---- Completion helpers ----

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

// ---- Complete ----

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

// ---- Restore ----

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

// ---- Move helpers ----

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

// ---- Move ----

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
