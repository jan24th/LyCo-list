import { useSearch } from "@/hooks/use-search";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  staticData: { title: "搜索" },
});

function SearchPage() {
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const { data, isLoading, error } = useSearch(query);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input.trim());
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">搜索</h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="搜索任务或列表…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          搜索
        </button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">搜索中…</p>}
      {error && (
        <p className="text-sm text-destructive">搜索失败：{error.message}</p>
      )}
      {data && data.items.length === 0 && query && (
        <p className="text-sm text-muted-foreground">未找到匹配项</p>
      )}
      {data && (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <li
              key={`${item.type}-${item.id}`}
              className="rounded-md border px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {item.type === "task" ? "任务" : "列表"}
                </span>
                <span className="font-medium">{item.title}</span>
              </div>
              {item.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.subtitle}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
