import { z } from "zod";
import {
  cognitoSub,
  ianaTimeZone,
  isoTimestamp,
  recurrenceRule,
} from "../common.js";

export const reminderBaseSchema = z.object({
  taskId: z.string().uuid(),
  triggerAt: isoTimestamp,
  recurrence: recurrenceRule.default("none"),
  timeZone: ianaTimeZone,
  isEnabled: z.boolean().default(true),
});

export const reminderInputSchema = reminderBaseSchema;
export const reminderUpdateSchema = reminderBaseSchema.partial();

export const reminderSchema = reminderBaseSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  createdBy: cognitoSub,
  updatedBy: cognitoSub,
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type ReminderUpdate = z.infer<typeof reminderUpdateSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
