import { z } from "zod";

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
