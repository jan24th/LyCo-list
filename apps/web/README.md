# LyCo-list Web

React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + TanStack Router。

## 命令

```bash
bun run dev
bun run build
bun run test
bun run typecheck
```

从仓库根目录运行全量测试时使用 `bun run test`，不要使用 Bun 原生的 `bun test`。

## shadcn/ui 基线

- CLI：`shadcn@4.13.1`（`apps/web` devDependency）
- Primitive：Radix UI
- Style：new-york
- Base color：slate
- Theme：CSS variables，跟随系统 light/dark；MVP 无手动切换入口
- Icons：Lucide
- Tailwind：v4 CSS-first，不创建 `tailwind.config.*`

在 `apps/web` 目录添加已批准的新组件：

```bash
bunx shadcn add <component>
```

必须使用本地固定 CLI，不得使用 `shadcn@latest`。提交生成文件、`apps/web/package.json` 和 `bun.lock`。优先复用 `src/components/ui` 中已有组件，不手写重复 primitive，也不为没有消费者的场景新增 variant。

检查 `shadcn --diff` 时，只允许 Biome 的 import normalization，以及 PopoverTitle 从生成的 `div` 改为与其 `h2` props 一致的 `h2` 这一有意语义修复；其他 variants、sizes、classes 或 JSX 差异必须先调查。

Phase 1 已安装：Button、Sheet、Separator、Scroll Area、Tooltip、Input、Textarea、Label、Checkbox、Select、Switch、Dialog、Alert Dialog、Dropdown Menu、Popover、Sonner、Badge、Avatar、Skeleton。

Calendar 延后到截止日期/提醒的本地日期、时间与 IANA 时区交互确定后；Command 延后到全局搜索信息架构和移动端呈现方式确定后。未经对应 ticket 更新，不得预装。
