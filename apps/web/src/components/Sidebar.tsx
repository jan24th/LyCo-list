import { useListsQuery } from "@/hooks/use-lists";
import { Calendar, CheckCircle, Circle, Flag, Inbox, User } from "lucide-react";
import { ListSettingsMenu } from "./ListSettingsMenu";
import { NewListDialog } from "./NewListDialog";

const SMART_LISTS = [
  { id: "today", name: "今天", icon: Calendar },
  { id: "scheduled", name: "计划", icon: Circle },
  { id: "all", name: "全部", icon: Inbox },
  { id: "flagged", name: "已标记", icon: Flag },
  { id: "completed", name: "已完成", icon: CheckCircle },
  { id: "assigned", name: "分配给我", icon: User },
];

const linkClasses =
  "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground";

export function Sidebar() {
  const { data, isLoading, error } = useListsQuery();

  return (
    <div className="space-y-6">
      <nav aria-label="智能列表" className="space-y-1">
        {SMART_LISTS.map((item) => (
          <a key={item.id} href={`#${item.id}`} className={linkClasses}>
            <item.icon className="size-4" />
            {item.name}
          </a>
        ))}
      </nav>
      <section aria-label="我的列表" className="space-y-1">
        <h2 className="px-3 text-xs font-semibold text-muted-foreground">
          我的列表
        </h2>
        {isLoading && (
          <p className="px-3 text-sm text-muted-foreground">加载中…</p>
        )}
        {error && (
          <p role="alert" className="px-3 text-sm text-destructive">
            加载失败
          </p>
        )}
        {data && data.items.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">暂无自定义列表</p>
        )}
        <ul className="space-y-1">
          {data?.items.map((list) => (
            <li key={list.id} className="group flex items-center gap-1">
              <a href={`#list-${list.id}`} className={`${linkClasses} flex-1`}>
                <span
                  data-color-dot
                  className="size-2.5 rounded-full"
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
        <NewListDialog />
      </section>
    </div>
  );
}
