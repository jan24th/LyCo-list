import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConflictError, type CursorKey, type Notification } from "@lyco/shared";
import { documentClient } from "../tasks/client.js";
import { getTableName } from "../lib/table.js";

export async function listNotifications(
  userId: string,
  limit = 50,
  cursor?: CursorKey,
): Promise<{ items: Notification[]; nextCursor?: CursorKey }> {
  const nowEpoch = Math.floor(Date.now() / 1000);

  const response = await documentClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
      FilterExpression:
        "attribute_not_exists(expiresAtEpoch) OR expiresAtEpoch > :nowEpoch",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}#NOTIFICATIONS`,
        ":prefix": "NOTIFICATION#",
        ":nowEpoch": nowEpoch,
      },
      ScanIndexForward: false,
      Limit: limit,
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }),
  );

  return {
    items: (response.Items ?? []) as Notification[],
    ...(response.LastEvaluatedKey
      ? { nextCursor: response.LastEvaluatedKey as CursorKey }
      : {}),
  };
}

export async function getNotificationById(
  id: string,
): Promise<Notification | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: {
        PK: `NOTIFICATION#${id}`,
        SK: "METADATA",
      },
    }),
  );
  return (response.Item as Notification) ?? null;
}

export async function markNotificationRead(
  id: string,
  expectedVersion: number,
  now: string,
): Promise<Notification> {
  const nowEpoch = Math.floor(new Date(now).getTime() / 1000);
  const expiresAtEpoch = nowEpoch + 7 * 24 * 60 * 60;

  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: `NOTIFICATION#${id}`,
          SK: "METADATA",
        },
        ConditionExpression: "#version = :expectedVersion",
        UpdateExpression:
          "SET isRead = :isRead, readAt = :readAt, expiresAtEpoch = :expiresAtEpoch, #version = :nextVersion, updatedAt = :now",
        ExpressionAttributeNames: {
          "#version": "version",
        },
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
          ":isRead": true,
          ":readAt": now,
          ":expiresAtEpoch": expiresAtEpoch,
          ":nextVersion": expectedVersion + 1,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return response.Attributes as Notification;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError("version mismatch");
    }
    throw error;
  }
}
