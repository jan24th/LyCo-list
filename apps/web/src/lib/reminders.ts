import { apiClient } from "./api";

export interface ProcessDueResponse {
  processedCount: number;
}

export async function processDueReminders(): Promise<ProcessDueResponse> {
  return apiClient<ProcessDueResponse>("/api/reminders/process-due", {
    method: "POST",
  });
}
