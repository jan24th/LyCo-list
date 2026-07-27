import { ApiError, apiClient } from "@/lib/api";
import type { List, ListInput, ListUpdate } from "@lyco/shared";

export interface ListsResponse {
  items: List[];
  nextCursor?: string;
}

export async function fetchLists(
  cursor?: string,
  limit = 50,
): Promise<ListsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
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

export interface ListUpdateBody extends ListUpdate {
  expectedVersion: number;
}

export async function deleteList(
  id: string,
  expectedVersion: number,
): Promise<List> {
  try {
    return await apiClient(
      `/api/lists/${id}?expectedVersion=${expectedVersion}`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("数据已过期，请刷新后重试");
    }
    throw error;
  }
}

export async function restoreList(
  id: string,
  expectedVersion: number,
): Promise<List> {
  try {
    return await apiClient(`/api/lists/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("数据已过期，请刷新后重试");
    }
    throw error;
  }
}

export async function updateList(
  id: string,
  input: ListUpdateBody,
): Promise<List> {
  try {
    return await apiClient(`/api/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("数据已过期，请刷新后重试");
    }
    throw error;
  }
}
