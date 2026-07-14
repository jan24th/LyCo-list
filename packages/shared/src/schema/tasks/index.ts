import { z } from "zod";
import {
  cognitoSub,
  ianaTimeZone,
  isoTimestamp,
  localDate,
  localTime,
  orderNumber,
  priority,
  recurrenceRule,
} from "../common.js";

export const taskBaseSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(5000).default(""),
  listId: z.string().uuid(),
  parentId: z.string().uuid().nullable().default(null),
  assigneeIds: z.array(cognitoSub).max(20).default([]),
  isCompleted: z.boolean().default(false),
  isFlagged: z.boolean().default(false),
  priority: priority.default("none"),
  dueDate: localDate.optional(),
  dueTime: localTime.optional(),
  timeZone: ianaTimeZone.optional(),
  recurrence: recurrenceRule.default("none"),
  order: orderNumber.default(0),
});

const requireDueDate = (
  data: { recurrence?: string | null; dueDate?: string },
  ctx: z.RefinementCtx,
) => {
  if (
    data.recurrence !== undefined &&
    data.recurrence !== "none" &&
    !data.dueDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dueDate is required when recurrence is not none",
      path: ["dueDate"],
    });
  }
};

export const taskInputSchema = taskBaseSchema.superRefine(requireDueDate);
export const taskUpdateSchema = taskBaseSchema
  .partial()
  .superRefine(requireDueDate);

export const taskSchema = taskBaseSchema.extend({
  id: z.string().uuid(),
  completedAt: isoTimestamp.nullable().default(null),
  lastCompletedAt: isoTimestamp.nullable().default(null),
  version: z.number().int().nonnegative(),
  deletedAt: isoTimestamp.optional(),
  undoUntil: isoTimestamp.optional(),
  deletionVersion: z.number().int().nonnegative().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  createdBy: cognitoSub,
  updatedBy: cognitoSub,
});

export const moveTaskInputSchema = z.object({
  listId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  order: orderNumber,
  expectedVersion: z.number().int().nonnegative(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type Task = z.infer<typeof taskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskInputSchema>;
