import type { Notification } from "@lyco/shared";
import { apiClient } from "./api";

export interface ListNotificationsResponse {
  items: Notification[];
  nextCursor?: string;
}

export async function fetchNotifications(
  limit = 20,
): Promise<ListNotificationsResponse> {
  return apiClient<ListNotificationsResponse>(
    `/api/notifications?limit=${limit}`,
  );
}
