import { useListsQuery } from "@/hooks/use-lists";
import { fetchTasksByList } from "@/lib/tasks";
import type { Task } from "@lyco/shared";
import { useQuery } from "@tanstack/react-query";

export type SmartListType =
  | "today"
  | "scheduled"
  | "all"
  | "flagged"
  | "completed"
  | "assigned";

interface SmartListProps {
  type: SmartListType;
  userId?: string;
}

function getTodayRange(): [string, string] {
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  ).toISOString();
  const end = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  ).toISOString();
  return [start, end];
}

function priorityValue(priority: string): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 3;
    default:
      return 2;
  }
}

function filterAndSort(tasks: Task[], type: SmartListType, userId?: string) {
  const [todayStart, todayEnd] = getTodayRange();
  let filtered: Task[];

  switch (type) {
    case "today":
      filtered = tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.dueDate != null &&
          t.dueDate >= todayStart &&
          t.dueDate < todayEnd,
      );
      filtered.sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          priorityValue(a.priority) - priorityValue(b.priority),
      );
      break;
    case "scheduled":
      filtered = tasks.filter((t) => !t.isCompleted && t.dueDate != null);
      filtered.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
      break;
    case "all":
      filtered = tasks.filter((t) => !t.isCompleted);
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    case "flagged":
      filtered = tasks.filter((t) => !t.isCompleted && t.isFlagged);
      filtered.sort(
        (a, b) =>
          priorityValue(a.priority) - priorityValue(b.priority) ||
          (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
      );
      break;
    case "completed":
      filtered = tasks.filter((t) => t.isCompleted);
      filtered.sort(
        (a, b) =>
          new Date(b.completedAt ?? 0).getTime() -
          new Date(a.completedAt ?? 0).getTime(),
      );
      break;
    case "assigned":
      filtered = tasks.filter(
        (t) =>
          !t.isCompleted && userId != null && t.assigneeIds.includes(userId),
      );
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    default:
      filtered = tasks;
  }

  return filtered;
}

const SMART_LIST_QUERY_KEY = ["smart-list"];

export function useSmartList(type: SmartListType, userId?: string) {
  const listsQuery = useListsQuery();

  return useQuery({
    queryKey: [...SMART_LIST_QUERY_KEY, type, userId, listsQuery.data],
    queryFn: async () => {
      const lists = listsQuery.data?.items ?? [];
      const allTasks: Task[] = [];

      // Fetch tasks per list
      for (const list of lists) {
        const result = await fetchTasksByList(list.id);
        allTasks.push(...result.items);
      }

      return filterAndSort(allTasks, type, userId);
    },
    enabled: !!listsQuery.data,
  });
}
