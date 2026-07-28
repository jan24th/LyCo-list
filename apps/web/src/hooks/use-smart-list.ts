import { fetchSmartList, type SmartListType } from "@/lib/tasks";
import type { Task } from "@lyco/shared";
import { useQuery } from "@tanstack/react-query";

export type { SmartListType } from "@/lib/tasks";

export function useSmartList(type: SmartListType, userId?: string) {
  return useQuery<Task[]>({
    queryKey: ["smart-list", type, userId],
    queryFn: async () => {
      const result = await fetchSmartList(type, 100);
      return result.items;
    },
    enabled: type !== "assigned" || !!userId,
  });
}
