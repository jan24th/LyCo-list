import type { List, ListInput } from "@lyco/shared";
import { apiClient } from "./api.js";

export interface ListsResponse {
  items: List[];
  nextCursor?: string;
}

export async function fetchLists(
  cursor?: string,
  limit = 50,
): Promise<ListsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursor", cursor);
  }
  return apiClient(`/api/lists?${params.toString()}`);
}

export async function createList(input: ListInput): Promise<List> {
  return apiClient("/api/lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
