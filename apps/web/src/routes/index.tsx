import { useSmartList } from "@/hooks/use-smart-list";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getCurrentUser } from "aws-amplify/auth";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

function getSmartListFromHash(): string {
  if (typeof window === "undefined") return "today";
  const hash = window.location.hash.replace("#", "");
  const valid = [
    "today",
    "scheduled",
    "all",
    "flagged",
    "completed",
    "assigned",
  ];
  return valid.includes(hash) ? hash : "today";
}

const SMART_LIST_NAMES: Record<string, string> = {
  today: "今天",
  scheduled: "计划",
  all: "全部",
  flagged: "已标记",
  completed: "已完成",
  assigned: "分配给我",
};

export const Route = createFileRoute("/")({
  component: HomePage,
  staticData: { title: "今天" },
});

function HomePage() {
  const [listType, setListType] = useState(getSmartListFromHash());
  const [userId, setUserId] = useState<string | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleHashChange = () => setListType(getSmartListFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUserId(user.userId))
      .catch(() => setUserId(undefined));
  }, []);

  const { data, isLoading, error } = useSmartList(listType, userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{SMART_LIST_NAMES[listType]}</h2>
        <button
          type="button"
          className="rounded-md p-2 hover:bg-accent"
          onClick={() => navigate({ to: "/search" })}
        >
          <Search className="size-5" />
        </button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {error && (
        <p className="text-sm text-destructive">加载失败：{error.message}</p>
      )}
      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">没有任务</p>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-md border px-4 py-3"
            >
              <input
                type="checkbox"
                checked={task.isCompleted}
                readOnly
                className="size-4"
              />
              <div className="flex-1">
                <span
                  className={
                    task.isCompleted ? "line-through text-muted-foreground" : ""
                  }
                >
                  {task.title}
                </span>
                {task.notes && (
                  <p className="text-sm text-muted-foreground">{task.notes}</p>
                )}
              </div>
              {task.isFlagged && (
                <span className="text-xs text-orange-500">★</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
