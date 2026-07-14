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

export type ListInput = z.infer<typeof listInputSchema>;
export type ListUpdate = z.infer<typeof listUpdateSchema>;
export type List = z.infer<typeof listSchema>;
