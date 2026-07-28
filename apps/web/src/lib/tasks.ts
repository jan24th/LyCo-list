import type { Task } from "@lyco/shared";
import { apiClient } from "./api";

export interface TaskListResponse {
  items: Task[];
  nextCursor?: string;
}

export async function fetchTasksByList(
  listId: string,
  limit = 100,
): Promise<TaskListResponse> {
  return apiClient<TaskListResponse>(
    `/api/tasks?listId=${encodeURIComponent(listId)}&limit=${limit}`,
  );
}
