# 实现响应式应用壳与移动端导航骨架 Implementation Plan

> Ticket: `tickets/004A-实现响应式应用壳与移动端导航骨架/ticket.md`
> Plan: `tickets/004A-实现响应式应用壳与移动端导航骨架/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立所有前端页面复用的响应式应用壳：桌面端显示固定左侧导航，移动端显示当前页面标题与汉堡按钮，并通过 shadcn/ui `Sheet` 提供可自动关闭的导航抽屉。

**Architecture:** 新建 `AppShell`，通过 `title`、`navigation`、`children` 三个插槽接收路由元数据、后续 008A 的导航组件和当前 `<Outlet />`。布局只渲染一次路由内容，以 Tailwind `lg` class 切换桌面/移动外观；受控 Sheet 通过事件委托在导航后关闭，并通过 `matchMedia` 在跨入桌面断点时清理仍打开的抽屉。TanStack Router `staticData.title` 提供当前叶子路由标题。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS v4、TanStack Router、shadcn/ui Sheet/Button、Lucide React、Vitest、React Testing Library。

## Global Constraints

- 必须先完成 004B；直接复用其 Button、Sheet、主题 token 和 `lucide-react`，不得在 004A 重新初始化 shadcn/ui。
- 唯一响应式边界是 Tailwind `lg`（默认 `64rem` / 1024 CSS px），不增加平板布局。
- 桌面固定侧栏宽 `18rem`；移动端隐藏侧栏并显示顶部栏，主内容占满可用宽度。
- 004A 只定义 navigation 插槽；智能列表、自定义列表和“新建列表”由 008A 提供。
- 移动 Sheet 可由导航链接、带 `data-navigation-item` 的控件、Escape、遮罩、关闭按钮及跨入 `lg` 断点关闭。
- 汉堡按钮名称为“打开导航”，Sheet 标题为“导航”，主要触控目标至少 `44 × 44` CSS px。
- 使用 `viewport-fit=cover` 与 `env(safe-area-inset-*)`；页面不得产生水平滚动。
- 断点/方向变化不得重建 router 或重复渲染 `<Outlet />`，当前路由内容必须保留。
- 使用 TDD；statements / branches / functions / lines 覆盖率均为 100%。
- 测试使用 `bun run test`；类型检查优先 `bunx tsgo`，不兼容时回退 `tsc --noEmit`。
- Git 提交采用约定式提交，全英文、小写祈使句、末尾不加句号。
- 不实现业务导航数据、页面内部响应式排版、滑动手势、PWA manifest、Service Worker 或安装提示。

---

## Task 1: 建立可复用的响应式 AppShell

> Covers: 场景 1–6 的组件边界，包括插槽、响应式结构、Sheet 关闭路径、安全区域与断点切换。

**Files:**
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: 004B 的 `Button`、`Sheet`、`SheetContent`、`SheetHeader`、`SheetTitle`、`SheetTrigger` 和 `lucide-react/Menu`。
- Produces: `AppShell(props: { title: string; navigation: ReactNode; children: ReactNode }): JSX.Element`。
- Produces: 标准 `<a>` 或带 `data-navigation-item` 的控件会在选择后关闭移动导航。

- [ ] **Step 1: 验证 004B 前置产物**

```bash
test -f apps/web/src/components/ui/sheet.tsx
test -f apps/web/src/components/ui/button.tsx
rg '"lucide-react"' apps/web/package.json
rg 'SheetContent|SheetTrigger' apps/web/src/components/ui/sheet.tsx
```

Expected: 全部退出 0；否则先完成 004B，不在 004A 中复制依赖安装。

- [ ] **Step 2: 写失败测试**

创建 `apps/web/src/components/AppShell.test.tsx`。先提供可驱动断点的 `matchMedia` stub：

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

type MediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia() {
  let matches = false;
  const listeners = new Set<MediaListener>();
  const media = "(min-width: 64rem)";
  const value = {
    get matches() { return matches; },
    media,
    onchange: null,
    addEventListener: vi.fn((_type: "change", fn: MediaListener) => listeners.add(fn)),
    removeEventListener: vi.fn((_type: "change", fn: MediaListener) => listeners.delete(fn)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => value));
  return {
    value,
    change(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of listeners) {
          listener({ matches, media } as MediaQueryListEvent);
        }
      });
    },
  };
}

function renderShell(navigation: ReactNode = <a href="/lists">列表</a>) {
  return render(
    <AppShell title="今天" navigation={navigation}>
      <p>当前路由内容</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  beforeEach(() => installMatchMedia());
  afterEach(() => vi.unstubAllGlobals());

  it("renders responsive regions and all slots", () => {
    renderShell();
    expect(screen.getByRole("heading", { name: "今天" })).toBeInTheDocument();
    expect(screen.getByText("当前路由内容")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-navigation")).toHaveClass("hidden", "lg:flex", "fixed");
    expect(screen.getByTestId("mobile-header")).toHaveClass("flex", "lg:hidden");
    expect(screen.getByRole("main")).toHaveClass("min-w-0", "overflow-x-hidden");
  });

  it("applies safe areas and a 44px menu target", () => {
    renderShell();
    expect(screen.getByTestId("mobile-header")).toHaveClass("pt-[env(safe-area-inset-top)]");
    expect(screen.getByTestId("desktop-navigation")).toHaveClass(
      "pt-[env(safe-area-inset-top)]",
      "pb-[env(safe-area-inset-bottom)]",
    );
    expect(screen.getByRole("main")).toHaveClass(
      "pl-[max(1rem,env(safe-area-inset-left))]",
      "pr-[max(1rem,env(safe-area-inset-right))]",
      "pb-[max(1rem,env(safe-area-inset-bottom))]",
    );
    expect(screen.getByRole("button", { name: "打开导航" })).toHaveClass("size-11");
  });

  it("opens and closes after link navigation", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    expect(await screen.findByRole("dialog", { name: "导航" })).toBeVisible();
    fireEvent.click(screen.getAllByRole("link", { name: "列表" })[1]);
    expect(screen.queryByRole("dialog", { name: "导航" })).not.toBeInTheDocument();
  });

  it("closes after a data-navigation-item is selected", () => {
    renderShell(<button type="button" data-navigation-item>新建</button>);
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.click(screen.getAllByRole("button", { name: "新建" })[1]);
    expect(screen.queryByRole("dialog", { name: "导航" })).not.toBeInTheDocument();
  });

  it("stays open for a non-navigation click", async () => {
    renderShell(<span>导航说明</span>);
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.click(screen.getAllByText("导航说明")[1]);
    expect(await screen.findByRole("dialog", { name: "导航" })).toBeVisible();
  });

  it("closes with Escape and with the close button", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "导航" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "导航" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.click(await screen.findByRole("button", { name: /close|关闭/i }));
    expect(screen.queryByRole("dialog", { name: "导航" })).not.toBeInTheDocument();
  });

  it("closes only when media changes into lg", async () => {
    const media = installMatchMedia();
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    media.change(false);
    expect(await screen.findByRole("dialog", { name: "导航" })).toBeVisible();
    media.change(true);
    expect(screen.queryByRole("dialog", { name: "导航" })).not.toBeInTheDocument();
  });

  it("removes the media listener on unmount", () => {
    const media = installMatchMedia();
    const view = renderShell();
    view.unmount();
    expect(media.value.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
```

- [ ] **Step 3: 确认测试失败**

Run: `bun run test -- --project apps/web src/components/AppShell.test.tsx`

Expected: FAIL，包含 `Failed to resolve import "./AppShell"` 或模块不存在。

- [ ] **Step 4: 实现最小 AppShell**

创建 `apps/web/src/components/AppShell.tsx`：

```tsx
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

export interface AppShellProps {
  title: string;
  navigation: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, navigation, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 64rem)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    media.addEventListener("change", closeAtDesktop);
    return () => media.removeEventListener("change", closeAtDesktop);
  }, []);

  function closeAfterNavigation(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element;
    if (target.closest("a, [data-navigation-item]")) {
      setOpen(false);
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <aside
        data-testid="desktop-navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex"
      >
        <div className="px-4 py-4 text-lg font-semibold">LyCo-list</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3">{navigation}</div>
      </aside>
      <div className="min-w-0 lg:pl-72">
        <header
          data-testid="mobile-header"
          className="sticky top-0 z-40 flex border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden"
        >
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="打开导航"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(20rem,calc(100vw-2rem))] overflow-y-auto pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                <SheetHeader><SheetTitle>导航</SheetTitle></SheetHeader>
                <div className="px-4" onClick={closeAfterNavigation}>{navigation}</div>
              </SheetContent>
            </Sheet>
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          </div>
        </header>
        <main className="min-w-0 overflow-x-hidden pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
          {children}
        </main>
      </div>
    </div>
  );
}
```

若 004B 的 Button 不支持 `size="icon"`，应先补全 004B，不能用类型断言绕过。

- [ ] **Step 5: 验证、格式化、类型检查并提交**

```bash
bun run test -- --project apps/web src/components/AppShell.test.tsx
bunx @biomejs/biome check --write apps/web/src/components/AppShell.tsx apps/web/src/components/AppShell.test.tsx
bunx tsgo -p apps/web/tsconfig.app.json
git add apps/web/src/components/AppShell.tsx apps/web/src/components/AppShell.test.tsx
git commit -m "feat(web): add responsive application shell"
```

Expected: 测试 PASS，Biome 无诊断，tsgo 退出 0。若 tsgo 不兼容，改用 `bunx tsc --noEmit -p apps/web/tsconfig.app.json`。

---

## Task 2: 接入路由标题和现有导航

> Covers: 场景 1、2、4、6；真实 router 只渲染一个 Outlet，标题随叶子路由更新。

**Files:**
- Create: `apps/web/src/router-static-data.d.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/routes/about.tsx`
- Modify: `apps/web/src/routes/callback.tsx`
- Modify: `apps/web/src/routes/index.test.tsx`
- Modify: `apps/web/src/routes/about.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `AppShell`。
- Produces: `StaticDataRouteOption.title: string`；以后新增页面路由必须声明当前页面中文标题。
- Produces: App 从最深 route match 读取标题，以现有“首页/关于”作为临时导航；008A 用 `Sidebar` 替换临时导航而不重写布局。

- [ ] **Step 1: 写失败的路由集成测试**

向 `apps/web/src/routes/index.test.tsx` 添加：

```tsx
it("shows the current route title in the application header", async () => {
  mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));
  await renderRouter("/");
  expect(screen.getByRole("heading", { level: 1, name: "今天" })).toBeInTheDocument();
});
```

将 `about.test.tsx` 的 Testing Library import 加入 `fireEvent`，并添加：

```tsx
it("uses route static data as the application header title", async () => {
  await renderRouter("/about");
  expect(screen.getByRole("heading", { level: 1, name: "关于" })).toBeInTheDocument();
});

it("navigates through the shell while preserving its main element", async () => {
  await renderRouter("/about");
  const main = screen.getByRole("main");
  fireEvent.click(screen.getAllByRole("link", { name: "首页" })[0]);
  expect(await screen.findByText("智能列表占位页")).toBeInTheDocument();
  expect(screen.getByRole("main")).toBe(main);
});
```

Run: `bun run test -- --project apps/web src/routes/index.test.tsx src/routes/about.test.tsx`

Expected: FAIL；当前 h1 仍为 `LyCo-list`，且没有应用壳“首页”链接。

- [ ] **Step 2: 定义标题协议并配置全部现有路由**

创建 `apps/web/src/router-static-data.d.ts`：

```ts
import "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title: string;
  }
}
```

为 route options 添加以下字段，保留各文件其余 loader/component 逻辑：

```tsx
// apps/web/src/routes/__root.tsx
staticData: { title: "LyCo-list" },

// apps/web/src/routes/index.tsx
staticData: { title: "今天" },

// apps/web/src/routes/about.tsx
staticData: { title: "关于" },

// apps/web/src/routes/callback.tsx
staticData: { title: "登录回调" },
```

- [ ] **Step 3: 用 AppShell 替换 App 的一次性布局**

将 `apps/web/src/App.tsx` 替换为：

```tsx
import { AppShell } from "@/components/AppShell";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";

function Navigation() {
  const classes =
    "flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground";
  return (
    <nav aria-label="主导航" className="space-y-1">
      <Link to="/" className={classes}>首页</Link>
      <Link to="/about" className={classes}>关于</Link>
    </nav>
  );
}

export default function App() {
  const title = useRouterState({
    select: (state) => state.matches[state.matches.length - 1].staticData.title,
  });
  return (
    <AppShell title={title} navigation={<Navigation />}>
      <Outlet />
    </AppShell>
  );
}
```

不增加 fallback：类型声明已要求全部路由提供标题，避免默认值掩盖漏配。

- [ ] **Step 4: 生成 route tree 并运行相关测试**

```bash
bunx tsr generate --config apps/web/tsr.config.json
bun run test -- --project apps/web src/components/AppShell.test.tsx src/routes/index.test.tsx src/routes/about.test.tsx src/routes/callback.test.tsx
```

Expected: 全部 PASS；首页标题“今天”、关于页标题“关于”，导航后主内容节点保持同一实例，callback 无回归。

- [ ] **Step 5: 格式化、类型检查并提交**

```bash
bunx @biomejs/biome check --write apps/web/src/App.tsx apps/web/src/router-static-data.d.ts apps/web/src/routes
bunx tsgo -p apps/web/tsconfig.app.json
git add apps/web/src/App.tsx apps/web/src/router-static-data.d.ts apps/web/src/routes apps/web/src/routeTree.gen.ts
git commit -m "feat(web): connect application shell to router metadata"
```

Expected: Biome 无诊断，tsgo 退出 0；不兼容时使用 `bunx tsc --noEmit -p apps/web/tsconfig.app.json`。

---

## Task 3: 启用安全区域 viewport 并完成全量验收

> Covers: 场景 1、2、3、5、6 的真实浏览器行为。

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: Task 1 的 safe-area classes。
- Produces: `viewport-fit=cover`；html/body/root 构成全高且无页面级水平滚动的根容器。

- [ ] **Step 1: 更新 viewport 与根布局**

把 `apps/web/index.html` 的 viewport meta 改为：

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
/>
```

在 `apps/web/src/index.css` 保留 004B 主题、字体和 token，只把根布局规则规范为：

```css
html,
body,
#root {
  min-height: 100%;
}

html,
body {
  overflow-x: hidden;
}

body {
  margin: 0;
}
```

- [ ] **Step 2: 运行全量自动验证**

```bash
bun run test
bunx tsgo -p apps/web/tsconfig.app.json
bunx @biomejs/biome check .
bun run --cwd apps/web build
```

Expected: 所有 tests PASS；四项覆盖率均 100%；类型检查、Biome、production build 均成功。tsgo 不兼容时回退 `bunx tsc --noEmit -p apps/web/tsconfig.app.json`。

- [ ] **Step 3: 运行浏览器验收**

```bash
bun run --cwd apps/web dev --host 127.0.0.1
```

打开 `http://127.0.0.1:5173`，逐项验证：

1. `1280 × 800`：固定左侧导航可见，移动顶部栏隐藏；滚动内容时侧栏保持固定。
2. `390 × 844`：侧栏隐藏，顶部显示“今天”和 `44 × 44px` 汉堡按钮；主内容全宽。
3. 打开 Sheet，分别以 Escape、遮罩、关闭按钮关闭。
4. 打开 Sheet 并选择“关于”：URL 变为 `/about`，Sheet 关闭，标题变为“关于”。
5. 在 `/about` 从 1023px 调至 1024px：Sheet 关闭、桌面侧栏出现且路由内容仍为“关于 LyCo-list”；调回后移动顶部栏恢复。
6. portrait/landscape 切换时按 1024px 边界切换，URL 和内容不变。
7. 首页、关于页及 Sheet 开关状态下执行以下 Console 表达式，均应返回 `true`：

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

8. 用带 notch 的 iPhone 模拟器确认顶部栏、Sheet 和主内容未被系统区域遮挡。

- [ ] **Step 4: 复验并提交**

```bash
bunx @biomejs/biome check --write apps/web/index.html apps/web/src/index.css
bun run test
bun run --cwd apps/web build
git add apps/web/index.html apps/web/src/index.css
git commit -m "fix(web): respect mobile safe areas and viewport bounds"
```

Expected: 格式化后全量测试仍 PASS，production build 成功。

---

## Task 4: 核对 008A 集成边界

> Covers: 防止后续 ticket 重复实现全局布局；只检查和记录，不实现业务 Sidebar。

**Files:**
- Inspect: `tickets/008A-实现前端列表创建与查询页面/plan.md`
- Inspect: `tickets/008A-实现前端列表创建与查询页面/ticket.md`

**Interfaces:**
- Consumes: Task 1 的 `navigation: ReactNode`。
- Produces: 008A 的 `Sidebar` 应替换 App 中临时 `Navigation`，不得再次创建 `aside + main`。

- [ ] **Step 1: 定位旧集成任务并记录执行约束**

```bash
rg -n "Integrate Sidebar into App layout|AppShell|Sidebar" tickets/008A-实现前端列表创建与查询页面/plan.md
```

Expected: 定位到 008A 的 Sidebar 集成任务。执行 008A 时把它收敛为“将 `<Navigation />` 替换为 `<Sidebar />` 并复用 `AppShell`”；004A 不提前加入智能列表、自定义列表或新建列表。

- [ ] **Step 2: 检查最终范围**

```bash
git status --short
git diff --stat HEAD~3..HEAD
```

Expected: 只涉及应用壳、路由标题、现有临时导航、viewport/根布局和测试；没有列表 API、业务 Sidebar、PWA 或无关重构。

---

## Self-Review

### 1. Ticket coverage

- 场景 1 → Task 1 desktop class 断言；Task 3 桌面浏览器验收。
- 场景 2 → Task 1 移动结构与插槽测试；Task 2 路由标题；Task 3 移动浏览器验收。
- 场景 3 → Task 1 Sheet 打开、Escape、关闭按钮测试；Task 3 真实遮罩验收。
- 场景 4 → Task 1 link / `data-navigation-item` 测试；Task 2/3 真实路由导航。
- 场景 5 → Task 1 safe-area、44px、overflow 结构断言；Task 3 viewport、notch 与 scrollWidth 验收。
- 场景 6 → Task 1 matchMedia 测试；Task 2 单一 Outlet；Task 3 断点和方向切换验收。
- 测试要求 → 每项逻辑先失败测试再实现；Task 3 执行 100% 覆盖率、类型、Biome 和构建门禁。

### 2. Scope and dependency check

- 004B 是硬前置，004A 不复制其初始化与依赖工作。
- 008A 业务导航不进入本 ticket；“首页/关于”只服务现有路由和壳验收。
- 008A 旧 plan 的重复布局在执行时改为 AppShell 插槽集成。
- 不包含页面内部排版、滑动手势、平板独立布局或 PWA。

### 3. Interface consistency

- `AppShellProps` 在测试、实现和消费端均为 `title`、`navigation`、`children`。
- Tailwind `lg` 与 `matchMedia("(min-width: 64rem)")` 一致。
- static data 在声明、全部现有路由和 App 中统一为 `title: string`。
- 非链接导航统一使用 `data-navigation-item`。
