import { QueryCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { CursorKey, Task } from "@lyco/shared";
import { documentClient } from "./client.js";
import { getTableName } from "../lib/table.js";
import { toTask } from "./repo.js";

export type SmartListType =
  | "today"
  | "scheduled"
  | "all"
  | "flagged"
  | "completed"
  | "assigned";

export async function querySmartList(
  type: SmartListType,
  userId: string,
  now: string,
  limit = 50,
  cursor?: CursorKey,
): Promise<{ items: Task[]; nextCursor?: CursorKey }> {
  const tableName = getTableName();
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const results: Task[] = [];
  let lastEvaluatedKey: CursorKey | undefined = cursor;

  // Compute today's UTC boundaries for "today" filter
  const nowDate = new Date(now);
  const todayStart = new Date(
    Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()),
  ).toISOString();
  const todayEnd = new Date(
    Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() + 1),
  ).toISOString();

  // Loop through GSI1 to accumulate enough matching items
  while (results.length < effectiveLimit) {
    const response: QueryCommandOutput = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "TASKS",
        },
        Limit: 1000,
        ...(lastEvaluatedKey
          ? { ExclusiveStartKey: lastEvaluatedKey }
          : {}),
      }),
    );

    for (const item of response.Items ?? []) {
      const task = toTask(item);
      if (!task || task.deletedAt) continue;

      if (matchesSmartList(task, type, userId, todayStart, todayEnd)) {
        results.push(task);
        if (results.length >= effectiveLimit) break;
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey as CursorKey | undefined;
    if (!lastEvaluatedKey) break;
  }

  return {
    items: results.slice(0, effectiveLimit),
    ...(lastEvaluatedKey
      ? { nextCursor: lastEvaluatedKey }
      : {}),
  };
}

function matchesSmartList(
  task: Task,
  type: SmartListType,
  userId: string,
  todayStart: string,
  todayEnd: string,
): boolean {
  // Normalize dueDate from local-date ("2026-01-15") to ISO for comparison
  const dueDateISO = task.dueDate
    ? task.dueDate.length === 10
      ? `${task.dueDate}T00:00:00.000Z`
      : task.dueDate
    : null;

  switch (type) {
    case "today":
      return (
        !task.isCompleted &&
        dueDateISO != null &&
        dueDateISO >= todayStart &&
        dueDateISO < todayEnd
      );
    case "scheduled":
      return !task.isCompleted && task.dueDate != null;
    case "all":
      return !task.isCompleted;
    case "flagged":
      return !task.isCompleted && task.isFlagged;
    case "completed":
      return task.isCompleted;
    case "assigned":
      return (
        !task.isCompleted &&
        task.assigneeIds.includes(userId)
      );
  }
}
