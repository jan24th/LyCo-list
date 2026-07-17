import { z } from "zod";
import { cognitoSub, isoTimestamp, orderNumber } from "../common.js";

export const listBaseSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .max(7)
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#3b82f6"),
  icon: z.string().max(50).default("list"),
  order: orderNumber.default(0),
});

export const listInputSchema = listBaseSchema;
export const listUpdateSchema = listBaseSchema.partial();

export const listSchema = listBaseSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  deletedAt: isoTimestamp.optional(),
  undoUntil: isoTimestamp.optional(),
  deletionVersion: z.number().int().nonnegative().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  createdBy: cognitoSub,
  updatedBy: cognitoSub,
});

export const listUpdateBodySchema = z.object({
  name: listBaseSchema.shape.name.optional(),
  color: listBaseSchema.shape.color.removeDefault().optional(),
  icon: listBaseSchema.shape.icon.removeDefault().optional(),
  order: listBaseSchema.shape.order.removeDefault().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export const listRestoreBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const listDeleteQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().nonnegative(),
});

export type ListInput = z.infer<typeof listInputSchema>;
export type ListUpdate = z.infer<typeof listUpdateSchema>;
export type List = z.infer<typeof listSchema>;
export type ListUpdateBody = z.infer<typeof listUpdateBodySchema>;
export type ListRestoreBody = z.infer<typeof listRestoreBodySchema>;
export type ListDeleteQuery = z.infer<typeof listDeleteQuerySchema>;
