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
  type List,
  type ListInput,
  type ListUpdate,
  formatOrderKey,
  listSchema,
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
  return { PK: `LIST#${id}`, SK: "METADATA" };
}

function buildGsi(list: List) {
  return {
    GSI1PK: "LISTS",
    GSI1SK: `ORDER#${formatOrderKey(list.order)}#LIST#${list.id}`,
  };
}

function toRecord(list: List): Record<string, unknown> {
  return {
    ...buildKeys(list.id),
    ...buildGsi(list),
    entityType: "LIST",
    ...list,
  };
}

function toList(item: Record<string, unknown>): List | null {
  const parsed = listSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

export async function createList(
  input: ListInput,
  metadata: { id: string; userId: string; now: string },
): Promise<List> {
  const list: List = {
    ...input,
    id: metadata.id,
    version: 1,
    createdAt: metadata.now,
    updatedAt: metadata.now,
    createdBy: metadata.userId,
    updatedBy: metadata.userId,
  };

  await documentClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: toRecord(list),
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return list;
}

export async function queryActiveLists(
  limit: number,
  cursor?: CursorKey,
): Promise<{ items: List[]; nextCursor?: CursorKey }> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const items: List[] = [];
  let lastEvaluatedKey: CursorKey | undefined = cursor;
  let hasMore = true;

  while (hasMore && items.length < effectiveLimit) {
    const response: QueryCommandOutput = await documentClient.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": "LISTS" },
        Limit: effectiveLimit - items.length,
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }),
    );

    const pageItems = (response.Items ?? [])
      .map(toList)
      .filter((parsed): parsed is List => !!parsed && !parsed.deletedAt);
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

export async function getListById(id: string): Promise<List | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: buildKeys(id),
    }),
  );
  return response.Item ? toList(response.Item) : null;
}

export async function updateList(
  id: string,
  input: ListUpdate,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<List> {
  const existing = await getListById(id);
  if (!existing) {
    throw new NotFoundError(`List ${id} not found`);
  }

  const next: List = {
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
      throw new ConflictError(`List ${id} version mismatch`);
    }
    throw error;
  }

  return next;
}

export async function deleteList(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<List> {
  const existing = await getListById(id);
  if (!existing) {
    throw new NotFoundError(`List ${id} not found`);
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
    const parsed = toList(response.Attributes ?? {});
    if (!parsed) {
      throw new NotFoundError(`List ${id} not found`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`List ${id} version mismatch`);
    }
    throw error;
  }
}

export async function restoreList(
  id: string,
  expectedVersion: number,
  userId: string,
  now: string,
): Promise<List> {
  const existing = await getListById(id);
  if (!existing) {
    throw new NotFoundError(`List ${id} not found`);
  }

  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression:
          "version = :expectedVersion AND attribute_exists(deletedAt)",
        UpdateExpression:
          "REMOVE deletedAt SET #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
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
    const parsed = toList(response.Attributes ?? {});
    if (!parsed) {
      throw new NotFoundError(`List ${id} not found`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`List ${id} version mismatch`);
    }
    throw error;
  }
}
