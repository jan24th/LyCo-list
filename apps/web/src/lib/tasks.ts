import type { Task } from "@lyco/shared";
import { apiClient } from "./api";

export interface TaskListResponse {
  items: Task[];
  nextCursor?: string;
}

export type SmartListType =
  | "today"
  | "scheduled"
  | "all"
  | "flagged"
  | "completed"
  | "assigned";

export async function fetchTasksByList(
  listId: string,
  limit = 100,
): Promise<TaskListResponse> {
  return apiClient<TaskListResponse>(
    `/api/tasks?listId=${encodeURIComponent(listId)}&limit=${limit}`,
  );
}

export async function fetchSmartList(
  type: SmartListType,
  limit = 100,
): Promise<TaskListResponse> {
  return apiClient<TaskListResponse>(
    `/api/tasks?smart=${type}&limit=${limit}`,
  );
}
