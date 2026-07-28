import { createHash } from "node:crypto";
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ConflictError,
  type CursorKey,
  type Notification,
  NotFoundError,
  type Reminder,
  type ReminderInput,
  type ReminderUpdate,
  type Task,
  ValidationError,
  reminderSchema,
} from "@lyco/shared";
import { documentClient } from "../tasks/client.js";
import { getTableName } from "../lib/table.js";

// Reuse task types locally to avoid circular dependency
interface TaskRecord {
  id: string;
  title: string;
  assigneeIds: string[];
  recurrence: string;
  deletedAt?: string;
}

function buildKeys(id: string) {
  return { PK: `REMINDER#${id}`, SK: "METADATA" };
}

function buildGsi(reminder: Reminder) {
  return {
    GSI1PK: `TASK#${reminder.taskId}#REMINDERS`,
    GSI1SK: `TRIGGER#${reminder.triggerAt}`,
  };
}

function toRecord(reminder: Reminder): Record<string, unknown> {
  return {
    ...buildKeys(reminder.id),
    ...buildGsi(reminder),
    entityType: "REMINDER",
    ...reminder,
  };
}

function toReminder(item: Record<string, unknown>): Reminder | null {
  const parsed = reminderSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

async function getTaskByIdRaw(id: string): Promise<TaskRecord | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: { PK: `TASK#${id}`, SK: "METADATA" },
    }),
  );
  if (!response.Item) return null;
  return response.Item as unknown as TaskRecord;
}

function validateRecurrenceExclusion(
  taskRecurrence: string,
  reminderRecurrence: string,
): void {
  if (taskRecurrence !== "none" && reminderRecurrence !== "none") {
    throw new ValidationError("When a task has a recurrence rule, reminders cannot have recurrence rules");
  }
}

const reminderNotificationNamespace = "6ba7b820-9dad-11d1-80b4-00c04fd430c8";

export function createReminderNotificationId(
  reminderId: string,
  recipientId: string,
  triggerAt: string,
): string {
  const namespace = Buffer.from(
    reminderNotificationNamespace.replaceAll("-", ""),
    "hex",
  );
  const hash = createHash("sha1")
    .update(namespace)
    .update(`reminder:${reminderId}:${recipientId}:${triggerAt}`)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const value = hash.subarray(0, 16).toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16,
  )}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

export function advanceRecurrence(
  recurrence: string,
  triggerAt: string,
  timeZone: string,
): string | null {
  if (recurrence === "none") return null;

  const triggerDate = new Date(triggerAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(triggerDate);

  const getPart = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  let nextYear = year;
  let nextMonth = month;
  let nextDay = day;

  switch (recurrence) {
    case "daily": {
      nextDay += 1;
      break;
    }
    case "weekly": {
      nextDay += 7;
      break;
    }
    case "biweekly": {
      nextDay += 14;
      break;
    }
    case "monthly": {
      nextMonth += 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      // Clamp day to last day of target month
      const lastDay = new Date(nextYear, nextMonth, 0).getDate();
      if (nextDay > lastDay) {
        nextDay = lastDay;
      }
      break;
    }
    case "yearly": {
      nextYear += 1;
      // Handle Feb 29 leap year
      if (month === 2 && day === 29) {
        const lastDay = new Date(nextYear, 2, 0).getDate();
        if (lastDay < 29) nextDay = 28;
      }
      break;
    }
    case "weekdays": {
      // Advance day by day until we hit a weekday
      do {
        nextDay += 1;
        // Check day of week using UTC date construction to avoid TZ issues
        const check = new Date(
          Date.UTC(nextYear, nextMonth - 1, nextDay, hour, minute, second),
        );
        // But the day-of-week is based on UTC, need local...
        // Use a simpler method: advance in a loop checking local day of week
      } while (!isLocalWeekday(nextYear, nextMonth, nextDay, timeZone));
      break;
    }
    default:
      return null;
  }

  // Normalize month/day overflow for daily/weekly/biweekly
  if (
    recurrence === "daily" ||
    recurrence === "weekly" ||
    recurrence === "biweekly"
  ) {
    const d = new Date(
      Date.UTC(nextYear, nextMonth - 1, nextDay, hour, minute, second),
    );
    nextYear = d.getUTCFullYear();
    nextMonth = d.getUTCMonth() + 1;
    nextDay = d.getUTCDate();
  }

  // Convert local date components to UTC
  return localComponentsToUtc(
    nextYear,
    nextMonth,
    nextDay,
    hour,
    minute,
    second,
    timeZone,
  );
}

function isLocalWeekday(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): boolean {
  // Create a UTC date at noon (to avoid DST edge issues near midnight)
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const localDay = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(utcNoon);
  return localDay !== "Sat" && localDay !== "Sun";
}

/**
 * Convert local date components in a given IANA timezone to a UTC ISO string.
 *
 * Strategy: create a UTC date with the same wall-clock numbers, format it in
 * the target timezone to find the offset, then subtract the offset to get the
 * real UTC time.
 */
function localComponentsToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): string {
  // Create a UTC date that has the SAME wall-clock numbers as our local target
  const pseudoUtc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );

  // Format it in the target timezone to see what wall-clock time it maps to
  const formattedParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(pseudoUtc);

  const mappedHour = Number(
    formattedParts.find((p) => p.type === "hour")?.value ?? "0",
  );

  // Offset = mappedLocalHour - pseudoUtcHour (wrapped for day boundary)
  let offsetMs = (mappedHour - hour) * 60 * 60 * 1000;

  // Handle day wrap: if offset is large positive (e.g., UTC 23 mapped to local 8 = +9 hours),
  // or large negative (e.g., UTC 0 mapped to local 17 = +17 or -7 depending on timezone)
  if (offsetMs < -12 * 60 * 60 * 1000) {
    offsetMs += 24 * 60 * 60 * 1000;
  } else if (offsetMs > 12 * 60 * 60 * 1000) {
    offsetMs -= 24 * 60 * 60 * 1000;
  }

  // Real UTC = local time - offset
  // local time in ms since epoch (as if it were UTC) - offset
  const localAsMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const realUtcMs = localAsMs - offsetMs;

  return new Date(realUtcMs).toISOString();
}

export async function createReminder(
  input: ReminderInput,
  metadata: { id: string; userId: string; now: string },
): Promise<Reminder> {
  const task = await getTaskByIdRaw(input.taskId);
  if (!task || task.deletedAt) {
    throw new NotFoundError(`Task ${input.taskId} not found`);
  }

  validateRecurrenceExclusion(task.recurrence, input.recurrence);

  const reminder: Reminder = {
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
      Item: toRecord(reminder),
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return reminder;
}

export async function getRemindersByTask(
  taskId: string,
  limit = 50,
  cursor?: CursorKey,
): Promise<{ items: Reminder[]; nextCursor?: CursorKey }> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);

  const response = await documentClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TASK#${taskId}#REMINDERS`,
        ":prefix": "TRIGGER#",
      },
      Limit: effectiveLimit,
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }),
  );

  const items = (response.Items ?? [])
    .map(toReminder)
    .filter((parsed): parsed is Reminder => parsed !== null);

  return {
    items,
    ...(response.LastEvaluatedKey
      ? { nextCursor: response.LastEvaluatedKey as CursorKey }
      : {}),
  };
}

export async function getReminderById(id: string): Promise<Reminder | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: buildKeys(id),
    }),
  );
  return response.Item ? toReminder(response.Item) : null;
}

export async function updateReminder(
  id: string,
  input: ReminderUpdate,
  expectedVersion: number,
  now: string,
  userId: string,
): Promise<Reminder> {
  // If recurrence is being changed, validate against task
  if (input.recurrence !== undefined) {
    const existing = await getReminderById(id);
    if (!existing) {
      throw new NotFoundError(`Reminder ${id} not found`);
    }
    const task = await getTaskByIdRaw(existing.taskId);
    if (task) {
      validateRecurrenceExclusion(task.recurrence, input.recurrence);
    }
  }

  try {
    const response = await documentClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression: "version = :expectedVersion",
        UpdateExpression: [
          "SET #version = :nextVersion, updatedAt = :now, updatedBy = :userId",
          input.triggerAt !== undefined ? ", triggerAt = :triggerAt" : "",
          input.recurrence !== undefined ? ", recurrence = :recurrence" : "",
          input.timeZone !== undefined ? ", timeZone = :timeZone" : "",
          input.isEnabled !== undefined ? ", isEnabled = :isEnabled" : "",
        ]
          .filter(Boolean)
          .join(""),
        ExpressionAttributeNames: {
          "#version": "version",
        },
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
          ":nextVersion": expectedVersion + 1,
          ":now": now,
          ":userId": userId,
          ...(input.triggerAt !== undefined
            ? { ":triggerAt": input.triggerAt }
            : {}),
          ...(input.recurrence !== undefined
            ? { ":recurrence": input.recurrence }
            : {}),
          ...(input.timeZone !== undefined
            ? { ":timeZone": input.timeZone }
            : {}),
          ...(input.isEnabled !== undefined
            ? { ":isEnabled": input.isEnabled }
            : {}),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    const parsed = toReminder(response.Attributes ?? {});
    if (!parsed) {
      throw new NotFoundError(`Reminder ${id} not found`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`Reminder ${id} version mismatch`);
    }
    throw error;
  }
}

export async function deleteReminder(
  id: string,
  expectedVersion: number,
): Promise<{ id: string }> {
  try {
    await documentClient.send(
      new DeleteCommand({
        TableName: getTableName(),
        Key: buildKeys(id),
        ConditionExpression: "version = :expectedVersion",
        ExpressionAttributeValues: {
          ":expectedVersion": expectedVersion,
        },
      }),
    );
    return { id };
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ConflictError(`Reminder ${id} version mismatch`);
    }
    throw error;
  }
}

function toReminderNotificationRecord(
  reminder: Reminder,
  recipientId: string,
  triggerAt: string,
  taskTitle: string,
  now: string,
): Record<string, unknown> {
  const notification: Notification = {
    id: createReminderNotificationId(reminder.id, recipientId, triggerAt),
    type: "reminder",
    recipientId,
    taskId: reminder.taskId,
    reminderId: reminder.id,
    taskTitle,
    message: "Reminder due",
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

export async function processDueReminders(
  now: string,
  limit = 100,
  cursor?: CursorKey,
): Promise<{ processedCount: number; nextCursor?: CursorKey }> {
  const tableName = getTableName();
  let processedCount = 0;

  const response = await documentClient.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression:
        "entityType = :entityType AND isEnabled = :isEnabled AND triggerAt <= :now",
      ExpressionAttributeValues: {
        ":entityType": "REMINDER",
        ":isEnabled": true,
        ":now": now,
      },
      Limit: Math.min(limit, 100),
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }),
  );

  const reminders = (response.Items ?? [])
    .map(toReminder)
    .filter((parsed): parsed is Reminder => parsed !== null);

  for (const reminder of reminders) {
    try {
      // Read associated task
      const task = await getTaskByIdRaw(reminder.taskId);
      if (!task) {
        console.error(
          `Task ${reminder.taskId} not found for reminder ${reminder.id}`,
        );
        continue;
      }

      // Determine recipients
      const recipients =
        task.assigneeIds.length > 0 ? task.assigneeIds : [reminder.createdBy];

      // Calculate next trigger for recurrence
      const nextTriggerAt = advanceRecurrence(
        reminder.recurrence,
        reminder.triggerAt,
        reminder.timeZone,
      );

      // Build transact items
      const nextVersion = reminder.version + 1;
      const transactItems: Array<Record<string, unknown>> = [];

      // Update reminder
      transactItems.push({
        Update: {
          TableName: tableName,
          Key: buildKeys(reminder.id),
          ConditionExpression:
            "#version = :expectedVersion AND isEnabled = :isEnabled",
          UpdateExpression: nextTriggerAt
            ? "SET triggerAt = :nextTrigger, #version = :nextVersion, updatedAt = :now, updatedBy = :updatedBy"
            : "SET isEnabled = :isEnabledFalse, #version = :nextVersion, updatedAt = :now, updatedBy = :updatedBy",
          ExpressionAttributeNames: {
            "#version": "version",
          },
          ExpressionAttributeValues: nextTriggerAt
            ? {
                ":expectedVersion": reminder.version,
                ":isEnabled": true,
                ":nextTrigger": nextTriggerAt,
                ":nextVersion": nextVersion,
                ":now": now,
                ":updatedBy": "system",
              }
            : {
                ":expectedVersion": reminder.version,
                ":isEnabled": true,
                ":isEnabledFalse": false,
                ":nextVersion": nextVersion,
                ":now": now,
                ":updatedBy": "system",
              },
        },
      });

      // Create notification for each recipient
      for (const recipientId of recipients) {
        const notificationRecord = toReminderNotificationRecord(
          reminder,
          recipientId,
          nextTriggerAt ?? reminder.triggerAt,
          task.title,
          now,
        );
        transactItems.push({
          Put: {
            TableName: tableName,
            Item: notificationRecord,
            ConditionExpression: "attribute_not_exists(PK)",
          },
        });
      }

      await documentClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems as any,
        }),
      );

      processedCount++;
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        console.error(
          `Transaction cancelled for reminder ${reminder.id}`,
          error,
        );
        continue;
      }
      throw error;
    }
  }

  return {
    processedCount,
    ...(response.LastEvaluatedKey
      ? { nextCursor: response.LastEvaluatedKey as CursorKey }
      : {}),
  };
}
