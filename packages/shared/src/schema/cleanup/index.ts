import { z } from "zod";
import { cognitoSub, entityType, isoTimestamp, uuid } from "../common.js";

export const targetType = z.enum(["TASK", "LIST"]);

export const deletionJobStatus = z.enum(["pending", "processing"]);

export const deletionJobSchema = z.object({
  id: z.string(),
  targetType,
  targetId: uuid,
  targetCreatedBy: cognitoSub,
  deletionVersion: z.number().int().nonnegative(),
  undoUntil: isoTimestamp,
  status: deletionJobStatus.default("pending"),
  cursor: z.string().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export type DeletionJob = z.infer<typeof deletionJobSchema>;
export type DeletionJobStatus = z.infer<typeof deletionJobStatus>;
