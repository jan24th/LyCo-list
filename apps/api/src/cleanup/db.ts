import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CursorKey } from "@lyco/shared";
import { documentClient } from "../tasks/client.js";
import { getTableName } from "../lib/table.js";

interface DeletionJobRecord {
  PK: string;
  SK: string;
  id: string;
  targetType: string;
  targetId: string;
  deletionVersion: number;
  undoUntil: string;
  status: string;
}

function toDeleteRequest(key: { PK: string; SK: string }) {
  return { DeleteRequest: { Key: key } };
}

async function batchDeleteWithRetry(
  tableName: string,
  items: Array<{ PK: string; SK: string }>,
  maxRetries = 3,
): Promise<void> {
  let remaining = items;
  let retries = 0;

  while (remaining.length > 0 && retries < maxRetries) {
    const response = await documentClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: remaining.map(toDeleteRequest),
        },
      }),
    );

    const unprocessed = response.UnprocessedItems?.[tableName] ?? [];
    if (unprocessed.length === 0) break;

    remaining = unprocessed.map(
      (u) => u.DeleteRequest?.Key as { PK: string; SK: string },
    );
    retries++;

    if (remaining.length > 0) {
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise((resolve) =>
        setTimeout(resolve, 100 * 2 ** (retries - 1)),
      );
    }
  }
}

export async function processCleanup(
  now: string,
  limit = 100,
  cursor?: CursorKey,
): Promise<{ processedCount: number; nextCursor?: CursorKey }> {
  const tableName = getTableName();
  let processedCount = 0;

  const response = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK <= :nowPrefix",
      ExpressionAttributeValues: {
        ":pk": "DELETION_JOBS",
        ":nowPrefix": `RUN#${now}`,
      },
      Limit: limit,
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }),
  );

  const jobs = (response.Items ?? []) as DeletionJobRecord[];

  // Collect items to delete
  const deleteItems: Array<{ PK: string; SK: string }> = [];

  for (const job of jobs) {
    // Verify the target still matches deletion version
    try {
      const targetResponse = await documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: `TASK#${job.targetId}`, SK: "METADATA" },
        }),
      );

      if (targetResponse.Item) {
        const task = targetResponse.Item as {
          deletionVersion?: number;
        };
        // Only hard-delete if deletion version matches
        if (task.deletionVersion === job.deletionVersion) {
          deleteItems.push({ PK: `TASK#${job.targetId}`, SK: "METADATA" });
        }
      }
      // Always remove the DELETION_JOB
      deleteItems.push({ PK: job.PK, SK: job.SK });
      processedCount++;
    } catch {
      // Skip if target check fails, still delete the job
      deleteItems.push({ PK: job.PK, SK: job.SK });
      processedCount++;
    }
  }

  // Batch delete with retry
  if (deleteItems.length > 0) {
    await batchDeleteWithRetry(tableName, deleteItems);
  }

  return {
    processedCount,
    ...(response.LastEvaluatedKey
      ? {
          nextCursor: response.LastEvaluatedKey as CursorKey,
        }
      : {}),
  };
}
