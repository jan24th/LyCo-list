import { z } from "zod";
import { cognitoSub, isoTimestamp } from "../common.js";

export const notificationType = z.enum(["assignment", "reminder"]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: notificationType,
  recipientId: cognitoSub,
  taskId: z.string().uuid(),
  reminderId: z.string().uuid().optional(),
  taskTitle: z.string().min(1).max(500),
  message: z.string().min(1).max(1000),
  isRead: z.boolean().default(false),
  readAt: isoTimestamp.optional(),
  createdAt: isoTimestamp,
  expiresAtEpoch: z.number().int().nonnegative().optional(),
});

export const markNotificationReadInputSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationType = z.infer<typeof notificationType>;
export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadInputSchema
>;
