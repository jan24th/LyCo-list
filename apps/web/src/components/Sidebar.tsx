import { useListsQuery } from "@/hooks/use-lists.js";
import { Calendar, CheckCircle, Circle, Flag, Inbox, User } from "lucide-react";
import { ListSettingsMenu } from "./ListSettingsMenu.js";
import { NewListDialog } from "./NewListDialog.js";

const SMART_LISTS = [
  { id: "today", name: "今天", icon: Calendar },
  { id: "scheduled", name: "计划", icon: Circle },
  { id: "all", name: "全部", icon: Inbox },
  { id: "flagged", name: "已标记", icon: Flag },
  { id: "completed", name: "已完成", icon: CheckCircle },
  { id: "assigned", name: "分配给我", icon: User },
];

export function Sidebar() {
  const { data, isLoading, error } = useListsQuery();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4">
      <h2 className="mb-4 px-3 text-lg font-semibold">LyCo-list</h2>
      <nav className="space-y-1">
        {SMART_LISTS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </a>
        ))}
      </nav>
      <div className="mt-6">
        <h3 className="mb-2 px-3 text-xs font-semibold text-slate-500">
          我的列表
        </h3>
        {isLoading && <p className="px-3 text-sm text-slate-500">加载中…</p>}
        {error && <p className="px-3 text-sm text-red-600">加载失败</p>}
        <ul className="space-y-1">
          {data?.items.map((list) => (
            <li
              key={list.id}
              className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-slate-100"
            >
              <a
                href={`#list-${list.id}`}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                {list.name}
              </a>
              <ListSettingsMenu
                list={list}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <NewListDialog />
        </div>
      </div>
    </aside>
  );
}
