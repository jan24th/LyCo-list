import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CursorKey } from "@lyco/shared";
import { documentClient } from "../tasks/client.js";
import { getTableName } from "../lib/table.js";

export interface SearchResult {
  type: "task" | "list";
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: string;
}

function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

function matchesQuery(texts: string[], query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  return texts.some((t) => normalize(t).includes(q));
}

export async function search(
  query: string,
  limit = 50,
  cursor?: CursorKey,
): Promise<{ items: SearchResult[]; nextCursor?: CursorKey }> {
  const tableName = getTableName();
  const normalizedQuery = normalize(query);

  const results: SearchResult[] = [];

  // Query all tasks from GSI1, looping past the 1MB/1000-item limit
  let taskStartKey: Record<string, unknown> | undefined;
  do {
    const taskResponse = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": "TASKS" },
        ExclusiveStartKey: taskStartKey,
        Limit: 1000,
      }),
    );

    for (const item of taskResponse.Items ?? []) {
      const { title, notes, deletedAt, updatedAt, id } = item as Record<
        string,
        unknown
      >;
      if (deletedAt) continue;
      const texts = [String(title ?? ""), String(notes ?? "")];
      if (matchesQuery(texts, normalizedQuery)) {
        results.push({
          type: "task",
          id: String(id),
          title: String(title ?? ""),
          subtitle: String(notes ?? "").slice(0, 100) || undefined,
          updatedAt: String(updatedAt ?? ""),
        });
      }
    }

    taskStartKey = taskResponse.LastEvaluatedKey;
  } while (taskStartKey);

  // Query all lists from GSI1, looping past the 1MB/1000-item limit
  let listStartKey: Record<string, unknown> | undefined;
  do {
    const listResponse = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": "LISTS" },
        ExclusiveStartKey: listStartKey,
        Limit: 1000,
      }),
    );

    for (const item of listResponse.Items ?? []) {
      const { name, deletedAt, updatedAt, id } = item as Record<
        string,
        unknown
      >;
      if (deletedAt) continue;
      if (matchesQuery([String(name ?? "")], normalizedQuery)) {
        results.push({
          type: "list",
          id: String(id),
          title: String(name ?? ""),
          updatedAt: String(updatedAt ?? ""),
        });
      }
    }

    listStartKey = listResponse.LastEvaluatedKey;
  } while (listStartKey);

  // Sort by updatedAt descending
  results.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  // Offset-based pagination
  const offset = (cursor?.offset as number) ?? 0;
  const page = results.slice(offset, offset + limit);
  const hasMore = offset + limit < results.length;

  return {
    items: page,
    ...(hasMore ? { nextCursor: { offset: offset + limit } } : {}),
  };
}
