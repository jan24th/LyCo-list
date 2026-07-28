import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface SearchItem {
  type: "task" | "list";
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: string;
}

interface SearchResponse {
  items: SearchItem[];
  nextCursor?: string;
}

async function doSearch(q: string, limit: number): Promise<SearchResponse> {
  return apiClient<SearchResponse>(
    `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export function useSearch(query: string, limit = 50) {
  return useQuery({
    queryKey: ["search", query, limit],
    queryFn: () => doSearch(query, limit),
    enabled: query.trim().length > 0,
  });
}
