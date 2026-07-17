export const LIST_COLORS = [
  { name: "蓝色", value: "#3b82f6" },
  { name: "红色", value: "#ef4444" },
  { name: "橙色", value: "#f97316" },
  { name: "黄色", value: "#eab308" },
  { name: "绿色", value: "#22c55e" },
  { name: "青色", value: "#14b8a6" },
  { name: "紫色", value: "#a855f7" },
  { name: "粉色", value: "#ec4899" },
] as const;

export const DEFAULT_LIST_COLOR = LIST_COLORS[0].value;

export function randomListColor(current: string): string {
  const pool = LIST_COLORS.filter(
    (option) => option.value !== current.toLowerCase(),
  );
  return pool[Math.floor(Math.random() * pool.length)].value;
}
