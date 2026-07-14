import { z } from "zod";
import { cognitoSub } from "../common.js";

export const userSchema = z.object({
  id: cognitoSub,
  name: z.string().min(1).max(100),
});

export type User = z.infer<typeof userSchema>;
