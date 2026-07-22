# 完成 shadcn/ui 初始化与基础组件预算 Implementation Plan

> Ticket: `tickets/004B-完成shadcn-ui初始化与基础组件预算/ticket.md`
> Plan: `tickets/004B-完成shadcn-ui初始化与基础组件预算/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `apps/web` 建立稳定的 shadcn/ui Radix 基线，包括完整 light/dark 语义主题、跟随系统的 Theme Provider、完整 alias、固定生成工具链，以及 Phase 1 明确需要的基础组件。

**Architecture:** 保留现有 Vite + Tailwind CSS v4 架构，将 shadcn/ui 固定为 `base: radix`、`new-york`、`slate`、CSS variables 和 Lucide，避免 2026 年 7 月默认 primitive 变更影响 004A 的 `asChild` 接口。CLI 生成代码集中在 `src/components/ui`，自有主题行为放在独立 `ThemeProvider`；根入口只负责组合 Theme Provider、Router 和 Sonner。配置/生成源码不逐文件追求单测覆盖，但以 token 合约测试、Theme Provider 行为测试和代表性表单/overlay smoke test 验证整体可用性。

**Tech Stack:** React 19、Vite、TypeScript、Tailwind CSS v4、shadcn CLI 4.13.1、Radix UI 1.6.2、Lucide React 1.25.0、Sonner 2.0.7、Vitest、React Testing Library。

## Execution Status (2026-07-20)

- Status: implementation complete on `codex/004b-shadcn-baseline`; final branch review approved with no Critical, Important, or Minor findings.
- Commits: `8977ec5` through `c0b5a32` (configuration/components, semantic theme, system theme, smoke coverage, documentation, first-paint bootstrap, and regression tests).
- Verification: 29 test files / 208 tests passed; statements, branches, functions, and lines are all 100%; TypeScript fallback, Biome, production build, diff checks, CLI 4.13.1, and supported browser acceptance passed.
- Approved plan corrections applied during execution: `base` is verified through `shadcn info` rather than stored in `components.json`; the Vitest project selector is `@lyco/web`; Sonner places `theme="system"` after `{...props}`; registry diff allows Biome import normalization and the intentional semantic `PopoverTitle` `h2` repair.
- Browser limitation: the in-app browser cannot emulate `prefers-color-scheme`; live dark startup and computed tokens were checked in-browser, while initial light/dark and both change directions are covered by automated tests.
- Tooling fallback: `tsgo` was unavailable from the configured npm mirror, so the documented `tsc --noEmit` fallback was used successfully.

## Global Constraints

- shadcn CLI 固定为 `4.13.1`，通过 `apps/web` 的精确 devDependency 调用；README 和后续 ticket 禁止使用 `shadcn@latest`。
- primitive 固定为 `radix`；`base` 是 `shadcn init` 参数而非 `components.json` 字段，通过 `shadcn info` 与生成源码的 `radix-ui` imports 验证；不采用 2026 年 7 月成为默认值的 Base UI，也不混用两套 primitive。
- 配置固定为 `style: "new-york"`、`baseColor: "slate"`、`cssVariables: true`、`iconLibrary: "lucide"`、`rsc: false`、`tsx: true`。
- Tailwind CSS v4 不创建 `tailwind.config.*`；`components.json.tailwind.config` 保持空字符串。
- `components`、`ui`、`lib`、`utils`、`hooks` aliases 必须全部指向现有 `@/* -> src/*` TypeScript/Vite alias。
- 依赖精确固定为 `class-variance-authority@0.7.1`、`clsx@2.1.1`、`lucide-react@1.25.0`、`radix-ui@1.6.2`、`sonner@2.0.7`、`tailwind-merge@3.6.0`、`tw-animate-css@1.4.0`。
- Theme Provider 只支持系统主题：首次渲染读取 `prefers-color-scheme`，系统偏好变化时同步 `.dark` class；MVP 不提供持久化选择、context setter 或切换按钮。
- Phase 1 只生成 ticket 列出的 19 个组件；不得生成 Calendar、Command 或其他组件。
- 不定制 Apple Reminders 视觉，不新增独立 design-system package，不为生成组件增加未被业务消费的 variant。
- CLI 生成的 `apps/web/src/components/ui/**` 是可审查的 vendor-style 源码，排除出业务覆盖率统计；仍通过 smoke test、类型检查、Biome 和 production build 验证。
- 使用 `bun install --registry https://registry.npmmirror.com`；添加依赖也必须指定同一 registry。
- 自动测试统一用 `bun run test`，不是 `bun test`；覆盖率 statements / branches / functions / lines 均为 100%。
- 类型检查优先 `bunx tsgo -p apps/web/tsconfig.app.json`，不兼容时回退 `bunx tsc --noEmit -p apps/web/tsconfig.app.json`。
- Git 提交采用约定式提交，全英文、小写祈使句、末尾不加句号。

---

## Task 1: 固定配置、依赖与 Phase 1 组件集合

> Covers: 场景 3、4、5；建立稳定的生成输入和完整组件预算。

**Files:**
- Modify: `apps/web/components.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/package.json`
- Modify: `bun.lock`
- Replace: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/sheet.tsx`
- Create: `apps/web/src/components/ui/separator.tsx`
- Create: `apps/web/src/components/ui/scroll-area.tsx`
- Create: `apps/web/src/components/ui/tooltip.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/checkbox.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/switch.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/alert-dialog.tsx`
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/popover.tsx`
- Create: `apps/web/src/components/ui/sonner.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/avatar.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`

**Interfaces:**
- Produces: 后续 ticket 从 `@/components/ui/<component>` 导入 19 个固定组件。
- Produces: 004A 可使用 Radix API `SheetTrigger asChild`、`SheetContent side="left"` 和 `Button size="icon"`。
- Produces: 本地 `bunx shadcn` 始终解析到 `shadcn@4.13.1`。

- [ ] **Step 1: 写入完整 components.json 并向 CLI 暴露现有 alias**

将 `apps/web/components.json` 替换为：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils",
    "hooks": "@/hooks"
  },
  "registries": {}
}
```

将 `apps/web/tsconfig.json` 的 `compilerOptions` 更新为：

```json
"compilerOptions": {
  "composite": true,
  "baseUrl": ".",
  "paths": {
    "@/*": ["src/*"]
  }
}
```

保留现有 `files` 和 `references`；`tsconfig.app.json` 中同一 alias 不移动，确保应用类型检查和只读取入口 tsconfig 的 shadcn CLI 都解析到 `src/*`。

- [ ] **Step 2: 精确安装 CLI 与生成依赖**

```bash
bun add --cwd apps/web --exact class-variance-authority@0.7.1 clsx@2.1.1 lucide-react@1.25.0 radix-ui@1.6.2 sonner@2.0.7 tailwind-merge@3.6.0 --registry https://registry.npmmirror.com
bun add --cwd apps/web --dev --exact shadcn@4.13.1 tw-animate-css@1.4.0 --registry https://registry.npmmirror.com
bun install --registry https://registry.npmmirror.com
```

Expected: `apps/web/package.json` 中上述版本均无 `^`/`~`，`bun.lock` 更新成功。

- [ ] **Step 3: 预览 CLI 变更并确认 primitive**

```bash
cd apps/web
bunx shadcn --version
bunx shadcn info
bunx shadcn add button sheet separator scroll-area tooltip input textarea label checkbox select switch dialog alert-dialog dropdown-menu popover sonner badge avatar skeleton --dry-run
```

Expected: version 输出 `4.13.1`；info 显示 Radix、new-york、slate 和 Lucide，Resolved Paths 均落在 `apps/web/src`；`components.json` 保持 `cssVariables: true`；dry-run 只列出预算内组件及其依赖，不列出 Calendar/Command。

- [ ] **Step 4: 用固定 CLI 生成完整组件集合**

在 `apps/web` 目录运行：

```bash
bunx shadcn add button sheet separator scroll-area tooltip input textarea label checkbox select switch dialog alert-dialog dropdown-menu popover sonner badge avatar skeleton --overwrite --yes
```

Expected: 19 个 `.tsx` 文件存在；现有简化 Button 被官方 Radix/new-york 版本替换，并提供 `default`、`destructive`、`outline`、`secondary`、`ghost`、`link` variants 及 `default`、`xs`、`sm`、`lg`、`icon`、`icon-xs`、`icon-sm`、`icon-lg` sizes。

- [ ] **Step 5: 再次固定 CLI 自动写入的依赖版本**

```bash
bun add --cwd apps/web --exact class-variance-authority@0.7.1 clsx@2.1.1 lucide-react@1.25.0 radix-ui@1.6.2 sonner@2.0.7 tailwind-merge@3.6.0 --registry https://registry.npmmirror.com
bun add --cwd apps/web --dev --exact shadcn@4.13.1 tw-animate-css@1.4.0 --registry https://registry.npmmirror.com
```

Expected: CLI 没有遗留 individual `@radix-ui/react-*` packages，也没有 `@base-ui/react`、`tailwindcss-animate` 或浮动版本。Sonner 可能临时加入 `next-themes`，Task 3 在改为项目自己的系统 Theme Provider 后删除它。

- [ ] **Step 6: 验证预算边界、格式化并提交**

```bash
test "$(find apps/web/src/components/ui -maxdepth 1 -name '*.tsx' ! -name '*.test.tsx' | wc -l | tr -d ' ')" = "19"
test ! -f apps/web/src/components/ui/calendar.tsx
test ! -f apps/web/src/components/ui/command.tsx
rg 'from "radix-ui"' apps/web/src/components/ui
bunx @biomejs/biome check --write apps/web/components.json apps/web/tsconfig.json apps/web/package.json apps/web/src/components/ui
bunx tsgo -p apps/web/tsconfig.app.json
git add apps/web/components.json apps/web/tsconfig.json apps/web/package.json apps/web/src/components/ui bun.lock
git commit -m "chore(web): pin shadcn configuration and component set"
```

Expected: 19 个预算组件且无 Calendar/Command；生成组件使用统一 `radix-ui` imports；Biome 和 Web 类型检查无诊断。

---

## Task 2: 建立 Tailwind v4 light/dark 语义主题

> Covers: 场景 1；完整映射颜色、圆角、图表与侧边栏 token，并验证 light/dark 均无缺项。

**Files:**
- Modify: `apps/web/src/index.css`
- Replace: `apps/web/src/styles/index.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: Task 1 的 `tw-animate-css` 和 `shadcn` CSS exports。
- Produces: Tailwind utilities `bg-background`、`text-foreground`、`bg-primary`、`border-border`、`ring-ring`、图表与侧边栏颜色，以及 `rounded-sm/md/lg/xl`。

- [ ] **Step 1: 写失败的主题合约测试**

将 `apps/web/src/styles/index.test.tsx` 替换为：

```tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  resolve(process.cwd(), "apps/web/src/index.css"),
  "utf8",
);

const semanticTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
];

describe("shadcn theme contract", () => {
  it("imports Tailwind and animation utilities", () => {
    expect(styles).toContain('@import "tailwindcss"');
    expect(styles).toContain('@import "tw-animate-css"');
    expect(styles).toContain('@import "shadcn/tailwind.css"');
    expect(styles).toContain("@custom-variant dark");
  });

  it.each(semanticTokens)("maps the %s semantic token", (token) => {
    expect(styles).toContain(`--color-${token}: var(--${token});`);
    expect(styles.match(new RegExp(`--${token}:`, "g"))).toHaveLength(2);
  });

  it("defines radius, charts, and sidebar mappings", () => {
    for (const token of ["radius-sm", "radius-md", "radius-lg", "radius-xl"]) {
      expect(styles).toContain(`--${token}:`);
    }
    for (const token of [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ]) {
      expect(styles).toContain(`--color-${token}:`);
    }
  });
});
```

- [ ] **Step 2: 确认主题测试失败**

Run: `bun run test -- --project @lyco/web src/styles/index.test.tsx`

Expected: FAIL；当前 CSS 缺少 `tw-animate-css`、`shadcn/tailwind.css` 和标准语义 token。

- [ ] **Step 3: 写入完整 Tailwind v4 slate 基线**

将 `apps/web/src/index.css` 替换为：

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.984 0.003 247.858);
  --sidebar-foreground: oklch(0.129 0.042 264.695);
  --sidebar-primary: oklch(0.208 0.042 265.755);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.968 0.007 247.896);
  --sidebar-accent-foreground: oklch(0.208 0.042 265.755);
  --sidebar-border: oklch(0.929 0.013 255.508);
  --sidebar-ring: oklch(0.704 0.04 256.788);
}

.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.929 0.013 255.508);
  --primary-foreground: oklch(0.208 0.042 265.755);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.279 0.041 260.031);
  --accent-foreground: oklch(0.984 0.003 247.858);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      Roboto, "Helvetica Neue", Arial, sans-serif;
  }
}
```

- [ ] **Step 4: 让现有应用根布局消费语义 token**

在 `apps/web/src/App.tsx` 中只替换现有根布局 class：

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-border border-b p-4">
        <h1 className="text-lg font-semibold">LyCo-list</h1>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
```

保留原有 `Outlet` import，不修改路由页面内部布局；004A 后续会用响应式 AppShell 替换该临时根布局。

- [ ] **Step 5: 验证主题合约并提交**

```bash
bun run test -- --project @lyco/web src/styles/index.test.tsx
bunx @biomejs/biome check --write apps/web/src/index.css apps/web/src/styles/index.test.tsx apps/web/src/App.tsx
git add apps/web/src/index.css apps/web/src/styles/index.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): add complete shadcn semantic theme"
```

Expected: token 合约测试 PASS，light/dark 都包含全部语义值，Biome 无诊断。

---

## Task 3: 实现跟随系统主题的 Theme Provider

> Covers: 场景 2；首次加载和操作系统主题变化均同步根元素 `.dark` class。

**Files:**
- Modify: `apps/web/index.html`
- Create: `apps/web/src/index-html.test.ts`
- Create: `apps/web/src/components/ThemeProvider.tsx`
- Create: `apps/web/src/components/ThemeProvider.test.tsx`
- Modify: `apps/web/src/components/ui/sonner.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/package.json`
- Modify: `bun.lock`

**Interfaces:**
- Produces: `ThemeProvider({ children }: { children: ReactNode })`，无手动主题 API。
- Produces: `Toaster` 固定使用 Sonner 的 `theme="system"`，不依赖 `next-themes`。

- [ ] **Step 1: 写 Theme Provider 的失败测试**

创建 `apps/web/src/components/ThemeProvider.test.tsx`：

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeProvider";

type Listener = (event: MediaQueryListEvent) => void;

function installColorScheme(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const media = "(prefers-color-scheme: dark)";
  const query = {
    get matches() { return matches; },
    media,
    addEventListener: vi.fn((_type: "change", listener: Listener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: "change", listener: Listener) => listeners.delete(listener)),
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return {
    query,
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

describe("ThemeProvider", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it.each([
    [true, true],
    [false, false],
  ])("applies the initial system preference", (preference, expected) => {
    installColorScheme(preference);
    render(<ThemeProvider><p>内容</p></ThemeProvider>);
    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(expected);
  });

  it("tracks system changes and removes its listener", () => {
    const media = installColorScheme(false);
    const view = render(<ThemeProvider><p>内容</p></ThemeProvider>);
    media.change(true);
    expect(document.documentElement).toHaveClass("dark");
    media.change(false);
    expect(document.documentElement).not.toHaveClass("dark");
    view.unmount();
    expect(media.query.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
```

- [ ] **Step 2: 确认测试失败**

Run: `bun run test -- --project @lyco/web src/components/ThemeProvider.test.tsx`

Expected: FAIL，包含无法解析 `./ThemeProvider`。

- [ ] **Step 3: 实现最小 Theme Provider**

创建 `apps/web/src/components/ThemeProvider.tsx`：

```tsx
import { type ReactNode, useEffect } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = (matches: boolean) => root.classList.toggle("dark", matches);
    const handleChange = (event: MediaQueryListEvent) => syncTheme(event.matches);

    syncTheme(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return children;
}
```

- [ ] **Step 4: 在首次绘制前同步系统主题**

在 `apps/web/index.html` 的 `<head>` 内、应用模块脚本之前加入最小同步脚本：

```html
<script>
  document.documentElement.classList.toggle(
    "dark",
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
</script>
```

创建 `apps/web/src/index-html.test.ts`，从真实 HTML 中提取并执行该脚本；分别模拟 `matches=true` 与 `matches=false`，验证 `.dark` 被添加与移除，并验证该脚本位于 `/src/main.tsx` 之前。`ThemeProvider` 仍负责 React 启动后的首次同步、系统变化监听和 cleanup。

- [ ] **Step 5: 使 Sonner 复用系统主题且不引入第二套 provider**

将 CLI 生成的 `apps/web/src/components/ui/sonner.tsx` 替换为：

```tsx
import {
  CheckCircle2Icon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircle2Icon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group toast bg-background text-foreground border-border shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
      theme="system"
    />
  );
}

export { Toaster };
```

- [ ] **Step 6: 在根入口组合 Theme Provider 与 Toaster**

在 `apps/web/src/main.tsx` 增加 imports：

```tsx
import { ThemeProvider } from "./components/ThemeProvider";
import { Toaster } from "./components/ui/sonner";
```

把现有 render block 改为：

```tsx
createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
```

- [ ] **Step 7: 删除 Sonner 生成时的临时主题依赖**

```bash
bun remove --cwd apps/web next-themes
```

Expected: `apps/web/package.json` 和 `bun.lock` 不再包含 `next-themes`；ThemeProvider 与 Toaster 均不引用它。

- [ ] **Step 8: 验证、格式化、类型检查并提交**

```bash
bun run test -- --project @lyco/web src/components/ThemeProvider.test.tsx
bunx @biomejs/biome check --write apps/web/index.html apps/web/src/index-html.test.ts apps/web/src/components/ThemeProvider.tsx apps/web/src/components/ThemeProvider.test.tsx apps/web/src/components/ui/sonner.tsx apps/web/src/main.tsx
bunx tsgo -p apps/web/tsconfig.app.json
git add apps/web/index.html apps/web/src/index-html.test.ts apps/web/src/components/ThemeProvider.tsx apps/web/src/components/ThemeProvider.test.tsx apps/web/src/components/ui/sonner.tsx apps/web/src/main.tsx apps/web/package.json bun.lock
git commit -m "feat(web): follow system color scheme"
```

Expected: Theme Provider 与首屏 bootstrap 测试 PASS；深色系统首次绘制前已应用 `.dark`，浅色系统会移除 `.dark`；Toaster 的固定 `theme="system"` 位于 `{...props}` 之后且不可被调用方覆盖；类型检查和 Biome 无诊断；tsgo 不兼容时回退 `bunx tsc --noEmit -p apps/web/tsconfig.app.json`。

---

## Task 4: 添加代表性组件 smoke test 与覆盖率边界

> Covers: 场景 1、3；以一个表单组件和一个 overlay 组件验证语义 token、渲染和交互。

**Files:**
- Create: `apps/web/src/components/UiPreview.tsx`
- Create: `apps/web/src/components/UiPreview.test.tsx`
- Modify: `vitest.config.ts`
- Delete: `apps/web/src/components/ui/button.test.tsx`

**Interfaces:**
- Produces: `UiPreview` 仅作为组件基线验收 surface，不加入业务路由。
- Produces: 生成目录排除 coverage，但 smoke test 仍真实导入并执行 Input、Label、Button、Dialog。

- [ ] **Step 1: 先写代表性 smoke test**

创建 `apps/web/src/components/UiPreview.test.tsx`：

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UiPreview } from "./UiPreview";

describe("UiPreview", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("renders and edits a semantic form control", () => {
    render(<UiPreview />);
    const input = screen.getByLabelText("列表名称");
    fireEvent.change(input, { target: { value: "家庭" } });
    expect(input).toHaveValue("家庭");
    expect(input).toHaveClass("border-input");
  });

  it("opens and closes a semantic dialog", async () => {
    render(<UiPreview />);
    fireEvent.click(screen.getByRole("button", { name: "打开预览" }));
    expect(await screen.findByRole("dialog", { name: "组件预览" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "组件预览" })).not.toBeInTheDocument();
  });

  it("keeps semantic classes under the dark root class", () => {
    document.documentElement.classList.add("dark");
    render(<UiPreview />);
    expect(screen.getByRole("button", { name: "打开预览" })).toHaveClass("bg-primary");
    expect(screen.getByText("主题组件基线")).toHaveClass("text-foreground");
  });
});
```

- [ ] **Step 2: 确认 smoke test 失败**

Run: `bun run test -- --project @lyco/web src/components/UiPreview.test.tsx`

Expected: FAIL，包含无法解析 `./UiPreview`。

- [ ] **Step 3: 实现代表性 preview surface**

创建 `apps/web/src/components/UiPreview.tsx`：

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UiPreview() {
  return (
    <section className="space-y-4 rounded-lg border bg-background p-4 text-foreground">
      <h2 className="font-semibold text-foreground">主题组件基线</h2>
      <div className="space-y-2">
        <Label htmlFor="preview-list-name">列表名称</Label>
        <Input id="preview-list-name" defaultValue="个人" />
      </div>
      <Dialog>
        <DialogTrigger asChild><Button>打开预览</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>组件预览</DialogTitle>
            <DialogDescription>验证 overlay 使用相同语义主题。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">关闭</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 4: 明确生成源码的 coverage 边界**

在根 `vitest.config.ts` 的 `coverage.exclude` 末尾添加：

```ts
"apps/web/src/components/ui/**",
```

删除旧 `apps/web/src/components/ui/button.test.tsx`：它只适配 ticket 004 的手写 Button variants，已被官方生成 Button 和 `UiPreview` smoke test 取代。

- [ ] **Step 5: 运行 smoke 与全量覆盖率并提交**

```bash
bun run test -- --project @lyco/web src/components/UiPreview.test.tsx
bun run test
bunx @biomejs/biome check --write apps/web/src/components/UiPreview.tsx apps/web/src/components/UiPreview.test.tsx vitest.config.ts
git add apps/web/src/components/UiPreview.tsx apps/web/src/components/UiPreview.test.tsx apps/web/src/components/ui/button.test.tsx vitest.config.ts
git commit -m "test(web): add shadcn component smoke coverage"
```

Expected: smoke test PASS；全仓 tests PASS，四项 coverage 均为 100%；被排除的只有 CLI 生成 UI 目录，不包括 ThemeProvider 或 UiPreview。

---

## Task 5: 记录组件约束并完成全量验证

> Covers: 场景 1–5；让后续 ticket 使用固定工具链，并通过构建与手工主题验收收口。

**Files:**
- Modify: `apps/web/README.md`

**Interfaces:**
- Produces: 后续组件添加命令、固定配置、已安装/延后清单和复用规则的唯一前端说明。

- [ ] **Step 1: 更新前端 README**

将 `apps/web/README.md` 替换为：

````markdown
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
````

- [ ] **Step 2: 验证配置与生成结果稳定**

```bash
cd apps/web
bunx shadcn --version
bunx shadcn info
bunx shadcn add button --diff
cd ../..
```

Expected: version 为 `4.13.1`，info 显示固定 Radix/new-york/slate/Lucide 配置；Button diff 为空，或仅包含 Task 1 运行 Biome 后产生的 React type-only import 与 named import 排序差异；Popover diff 还允许 PopoverTitle 从生成的 `div` 改为与 `h2` props 一致的 `h2` 这一有意语义修复。不得出现其他 variants、sizes、classes 或 JSX 差异，也不得出现 Base UI 或浮动配置变化。

- [ ] **Step 3: 运行全量自动验证**

从仓库根目录运行：

```bash
bun run test
bunx tsgo -p apps/web/tsconfig.app.json
bunx @biomejs/biome check .
bun run --cwd apps/web build
```

Expected: 全部 tests PASS；四项 coverage 100%；类型检查、Biome、production build 均成功。tsgo 不兼容时使用 `bunx tsc --noEmit -p apps/web/tsconfig.app.json` 并记录回退原因。

- [ ] **Step 4: 运行 light/dark 浏览器验收**

```bash
bun run --cwd apps/web dev --host 127.0.0.1
```

打开 `http://127.0.0.1:5173` 并验证：

1. 系统浅色时，页面 background/foreground、Button、Input border/focus ring 使用 light token，无未解析 CSS variable。
2. 开发者工具将 `prefers-color-scheme` 切为 dark，无需刷新即在 `<html>` 添加 `dark`，背景、文本、边框和 focus ring 切换到 dark token。
3. 切回 light，无需刷新即移除 `dark`。
4. 检查 Console，无 CSS variable、hydration、Radix context 或可访问性错误。Input/Dialog 的交互由 Task 4 可重复执行的 `UiPreview.test.tsx` 验证。

- [ ] **Step 5: 格式化 README 并提交**

```bash
git diff --check -- apps/web/README.md
git add apps/web/README.md
git commit -m "docs(web): document stable shadcn workflow"
```

Expected: README 清楚记录固定版本、已安装/延后组件与复用规则。

---

## Self-Review

### 1. Ticket coverage

- 场景 1（完整主题基线）→ Task 2 完整 OKLCH token、raw CSS 合约测试；Task 5 浏览器验收。
- 场景 2（系统深色模式）→ Task 3 初始 light/dark、系统变化和 listener cleanup 测试；Task 5 无刷新浏览器验收。
- 场景 3（基础组件可复用）→ Task 1 生成 19 个组件；Task 4 Input/Dialog smoke；Task 5 build。
- 场景 4（alias 完整）→ Task 1 完整 components.json 与 `shadcn info`。
- 场景 5（生成结果稳定）→ Task 1 精确 CLI/依赖和 Radix base；Task 5 README 与 `shadcn add button --diff`。
- 测试要求 → Task 2 token contract、Task 3 Theme Provider、Task 4 表单/overlay smoke、Task 5 全量门禁。

### 2. Scope and dependency check

- 只生成 ticket 指定的 19 个组件；Calendar、Command 明确不存在并由命令验证。
- Theme Provider 不暴露手动 setter，不写 localStorage，不创建切换入口。
- 不增加业务页面、业务表单、状态管理或独立 design-system package。
- 004A 依赖的 Radix `asChild`、Sheet、Button icon size 在 Task 1 明确锁定。

### 3. Interface consistency

- components.json、README、CLI info 和依赖均统一为 shadcn 4.13.1 / Radix / new-york / slate / CSS variables / Lucide。
- ThemeProvider 只管理 `<html>.dark`；Sonner 单独以 `theme="system"` 跟随同一系统来源，不引入第二套 provider。
- token test 中的 18 个核心语义 token均在 `@theme inline`、`:root` 和 `.dark` 定义。
- 生成目录 coverage exclusion 与 ticket“无需为每个生成组件复制单元测试”一致，自有 ThemeProvider/UiPreview 仍计入 100%。
