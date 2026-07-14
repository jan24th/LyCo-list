import { z } from "zod";

export const uuid = z.string().uuid();
export const cognitoSub = uuid;
export const isoTimestamp = z.string().datetime({ offset: true });
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Invalid local date format (YYYY-MM-DD)",
});
export const localTime = z.string().regex(/^\d{2}:\d{2}$/, {
  message: "Invalid local time format (HH:mm)",
});
export const ianaTimeZone = z.string().refine(
  (value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid IANA time zone" },
);
export const recurrenceRule = z.enum([
  "none",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "weekdays",
]);
export const priority = z.enum(["none", "low", "medium", "high"]);
export const orderNumber = z.number().nonnegative().finite().max(1_000_000_000);
export function formatOrderKey(order: number): string {
  return order.toFixed(9);
}
export const entityType = z.enum([
  "LIST",
  "TASK",
  "REMINDER",
  "NOTIFICATION",
  "DELETION_JOB",
]);
