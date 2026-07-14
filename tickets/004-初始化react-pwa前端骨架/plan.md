# 初始化 React PWA 前端骨架 Implementation Plan

> Ticket: `tickets/004-初始化react-pwa前端骨架/ticket.md`
> Plan: `tickets/004-初始化react-pwa前端骨架/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 中建立可运行的 React + Vite + TypeScript 前端骨架，集成 Tailwind CSS v4、TanStack Router 和至少一个 shadcn/ui 基础组件，实现基本页面切换，并满足 100% 测试覆盖率。

**Architecture:** 使用 Vite 作为构建工具，React 负责 UI 渲染，Tailwind CSS v4 通过 CSS-first 方式管理样式，TanStack Router 提供类型安全的前端路由，shadcn/ui 提供基础组件库。项目结构遵循标准 Vite + React 约定，路由配置集中在 `src/routes/` 目录，基础页面组件放在 `src/pages/` 目录，避免在骨架阶段引入业务逻辑或 API 集成。

## Global Constraints

- 包管理器：`bun` workspaces，安装依赖时使用 `--registry https://registry.npmmirror.com`。
- 代码规范：`biome.json` 统一配置，开发脚本 `bun check`，CI 使用 `bunx @biomejs/biome ci`。
- 类型检查：优先使用 `bunx tsgo`；若 tsgo 不兼容，回退到 `tsc --noEmit`。
- 测试框架：Vitest，覆盖率阈值 statements / branches / functions / lines 均为 100%。
- 前端：React + Vite + TypeScript + Tailwind CSS v4（CSS-first）+ shadcn/ui。
- 所有业务逻辑按 TDD 开发；脚手架代码（如路由配置、页面组件）也必须编写测试并满足 100% 覆盖率。
- Git 提交格式：`类型(范围): 描述`，英文、小写、祈使句、末尾不加句号。
- 共享包：`packages/shared` 提供类型和工具，前端通过 workspace 链接导入 `@lyco/shared`。
- 不包含：具体业务页面、API 集成、PWA service worker、认证状态与受保护路由。

---

### Task 1: 确认基础项目结构并清理占位代码

> Covers: Scenario 1（启动 Vite 开发服务器）

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/tsconfig.app.json`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/index.css`
- Delete: `apps/web/src/App.test.tsx`（若 ticket 001 已创建，将被路由测试替代）

**Interfaces:**
- Consumes: ticket 001 建立的 `apps/web` 最小 Vite + React + Tailwind 结构（本 ticket 在此基础上增量安装 Router、shadcn/ui 并补充路由与测试）。
- Produces: 可扩展的 React 项目骨架，路由入口在 `main.tsx`。

- [ ] **Step 1: 确认 `apps/web` 目录存在且基础文件完整**

检查以下文件是否存在：

```bash
ls apps/web/package.json
ls apps/web/vite.config.ts
ls apps/web/tsconfig.json
ls apps/web/tsconfig.app.json
ls apps/web/tsconfig.node.json
ls apps/web/index.html
ls apps/web/src/main.tsx
ls apps/web/src/App.tsx
ls apps/web/src/index.css
ls apps/web/vitest.config.ts
```

若 ticket 001 尚未创建这些文件，则先创建与 ticket 001 的 Task 7 一致的最小 Vite + React 项目结构。

- [ ] **Step 2: 更新 `apps/web/package.json` 添加路由依赖**

`apps/web/package.json`:

```json
{
  "name": "@lyco/web",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@lyco/shared": "workspace:*",
    "@tanstack/react-router": "^1.114.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.3",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.2.0",
    "vitest": "^3.0.0",
    "jsdom": "^26.0.0",
    "@testing-library/react": "^16.2.0",
    "@testing-library/dom": "^10.4.0"
  }
}
```

- [ ] **Step 3: 安装依赖**

Run: `bun install --registry https://registry.npmmirror.com`

Expected: 成功安装 `@tanstack/react-router` 和 `@lyco/shared` workspace 链接。

- [ ] **Step 4: 更新 `apps/web/vite.config.ts` 添加路径别名**

`apps/web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: 更新 `apps/web/tsconfig.app.json` 添加路径映射**

`apps/web/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "composite": true,
    "declaration": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 6: 清理 `App.tsx` 使其成为路由占位**

`apps/web/src/App.tsx`:

```typescript
import { Outlet } from "@tanstack/react-router";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 p-4">
        <h1 className="text-lg font-semibold">LyCo-list</h1>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 7: 提交**

```bash
git add apps/web package.json bun.lock
git commit -m "chore(web): set up tanstack router dependencies and path aliases"
```

---

### Task 2: 配置 Tailwind CSS v4 与全局样式

> Covers: Scenario 3（使用 Tailwind 渲染 shadcn/ui）

**Files:**
- Modify: `apps/web/src/index.css`
- Create: `apps/web/src/styles/index.css`（可选，若希望拆分入口）

**Interfaces:**
- Produces: Tailwind CSS v4 通过 `@import "tailwindcss"` 导入，支持 `bg-slate-50` 等工具类。

- [ ] **Step 1: 更新全局样式入口**

`apps/web/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-lyco-bg: #f8fafc;
  --color-lyco-text: #0f172a;
  --color-lyco-primary: #3b82f6;
  --color-lyco-primary-foreground: #ffffff;
}

body {
  background-color: var(--color-lyco-bg);
  color: var(--color-lyco-text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  margin: 0;
}
```

- [ ] **Step 2: 确认 `main.tsx` 导入全局样式**

`apps/web/src/main.tsx`:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: 创建 Tailwind 工具类渲染测试**

`apps/web/src/styles/index.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

function StyledBox() {
  return <div className="bg-slate-50 text-slate-900 p-4">Styled</div>;
}

describe("Tailwind CSS integration", () => {
  it("renders an element with Tailwind classes", () => {
    const { container } = render(<StyledBox />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveClass("bg-slate-50");
    expect(element).toHaveClass("text-slate-900");
  });
});
```

- [ ] **Step 4: 运行样式测试**

Run: `cd apps/web && bun test src/styles/index.test.tsx`

Expected: PASS，覆盖率 100%。

- [ ] **Step 5: 提交**

```bash
git add apps/web

git commit -m "feat(web): configure tailwind css v4 global styles"
```

---

### Task 3: 初始化 shadcn/ui 基础组件

> Covers: Scenario 3（使用 Tailwind 渲染 shadcn/ui）

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/button.test.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: Tailwind CSS v4、`clsx`、`tailwind-merge`。
- Produces: `Button` 组件和 `cn` 工具函数，供后续业务页面使用。

- [ ] **Step 1: 安装 shadcn/ui 依赖工具**

Run: `cd apps/web && bun add clsx tailwind-merge --registry https://registry.npmmirror.com`

Expected: `package.json` 中新增 `clsx` 和 `tailwind-merge`。

- [ ] **Step 2: 创建 `components.json` 配置**

`apps/web/components.json`:

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
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 3: 创建 `cn` 工具函数**

`apps/web/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: 创建 Button 组件**

`apps/web/src/components/ui/button.tsx`:

```typescript
import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost";
  size?: "default" | "sm";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          "disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-lyco-primary text-lyco-primary-foreground hover:bg-blue-600",
          variant === "ghost" && "hover:bg-slate-100",
          size === "default" && "h-9 px-4 py-2 text-sm",
          size === "sm" && "h-8 px-3 text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
```

- [ ] **Step 5: 编写 Button 组件测试**

`apps/web/src/components/ui/button.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders default variant", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toHaveClass("bg-lyco-primary");
  });

  it("renders ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button).toHaveClass("hover:bg-slate-100");
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await screen.getByRole("button", { name: "Click" }).click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("forwards ref", () => {
    let refValue: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          refValue = el;
        }}
      >
        Ref
      </Button>,
    );
    expect(refValue).toBeInstanceOf(HTMLButtonElement);
  });
});
```

- [ ] **Step 6: 运行 Button 测试**

Run: `cd apps/web && bun test src/components/ui/button.test.tsx`

Expected: PASS，覆盖率 100%。

- [ ] **Step 7: 提交**

```bash
git add apps/web

git commit -m "feat(web): add shadcn button component and cn utility"
```

---

### Task 4: 建立 TanStack Router 路由骨架

> Covers: Scenario 2（使用 TanStack Router 导航）

**Files:**
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/routes/about.tsx`
- Create: `apps/web/src/routeTree.gen.ts`（由 TanStack Router 生成）
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/routes/index.test.tsx`
- Create: `apps/web/src/routes/about.test.tsx`

**Interfaces:**
- Consumes: `App` layout 组件、`Button` 组件。
- Produces: `routeTree` 配置，支持 `/` 和 `/about` 路由切换。

- [ ] **Step 1: 创建根路由布局**

`apps/web/src/routes/__root.tsx`:

```typescript
import { createRootRoute, Outlet } from "@tanstack/react-router";
import App from "@/App";

export const Route = createRootRoute({
  component: () => (
    <App>
      <Outlet />
    </App>
  ),
});
```

- [ ] **Step 2: 创建首页路由**

`apps/web/src/routes/index.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h2 className="text-xl font-bold">今天</h2>
      <p className="mt-2 text-slate-600">智能列表占位页</p>
      <Link to="/about" className="mt-4 inline-block">
        <Button>关于</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: 创建关于页路由**

`apps/web/src/routes/about.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div>
      <h2 className="text-xl font-bold">关于 LyCo-list</h2>
      <p className="mt-2 text-slate-600">家庭/小团队共享待办应用</p>
      <Link to="/" className="mt-4 inline-block">
        <Button variant="ghost">返回</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: 更新应用入口挂载路由**

`apps/web/src/main.tsx`:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- [ ] **Step 5: 生成路由树**

Run: `cd apps/web && bunx @tanstack/react-router-cli generate`

Expected: 生成 `apps/web/src/routeTree.gen.ts` 文件。

- [ ] **Step 6: 编写路由集成测试**

`apps/web/src/routes/index.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

function renderRouter(initialUrl: string) {
  const router = createRouter({ routeTree, history: undefined });
  router.navigate({ to: initialUrl });
  return render(<RouterProvider router={router} />);
}

describe("Home route", () => {
  it("renders the home page content", () => {
    renderRouter("/");
    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关于" })).toBeInTheDocument();
  });

  it("navigates to about page", async () => {
    renderRouter("/");
    await screen.getByRole("button", { name: "关于" }).click();
    expect(screen.getByText("关于 LyCo-list")).toBeInTheDocument();
  });
});
```

`apps/web/src/routes/about.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

function renderRouter(initialUrl: string) {
  const router = createRouter({ routeTree, history: undefined });
  router.navigate({ to: initialUrl });
  return render(<RouterProvider router={router} />);
}

describe("About route", () => {
  it("renders the about page content", () => {
    renderRouter("/about");
    expect(screen.getByText("关于 LyCo-list")).toBeInTheDocument();
  });

  it("navigates back to home", async () => {
    renderRouter("/about");
    await screen.getByRole("button", { name: "返回" }).click();
    expect(screen.getByText("今天")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: 运行路由测试**

Run: `cd apps/web && bun test src/routes/index.test.tsx src/routes/about.test.tsx`

Expected: PASS，覆盖率 100%。

- [ ] **Step 8: 提交**

```bash
git add apps/web

git commit -m "feat(web): add tanstack router with home and about routes"
```

---

### Task 5: 最终验证与文档同步

> Covers: 所有验收标准的端到端验证

**Files:**
- Modify: `apps/web/README.md`（可选）
- Modify: `tickets/004-初始化react-pwa前端骨架/ticket.md`（如需补充备注）

**Interfaces:**
- Produces: 通过 `bun dev`、`bun check`、`bun typecheck`、`bun test` 的前端骨架。

- [ ] **Step 1: 运行完整验证序列**

Run:

```bash
bun install --registry https://registry.npmmirror.com
bun check
bun typecheck
bun test
```

Expected:
- `bun install` 成功。
- `bun check` 成功。
- `bun typecheck` 成功。
- `bun test` 所有测试通过，覆盖率 100%。

- [ ] **Step 2: 启动 Vite 开发服务器验证**

Run: `cd apps/web && bun dev`

Expected: 开发服务器在 `http://localhost:5173` 启动，浏览器可访问首页并点击"关于"跳转到 `/about`。

- [ ] **Step 3: 验证 shadcn/ui 按钮渲染**

在浏览器中确认首页的"关于"按钮和关于页的"返回"按钮均按 Tailwind 样式渲染。

- [ ] **Step 4: 添加前端 README 说明**

`apps/web/README.md`:

```markdown
# LyCo-list Web

React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + TanStack Router。

## 命令

```bash
bun dev      # 启动开发服务器
bun build    # 生产构建
bun test     # 运行测试（100% 覆盖率）
bun typecheck
```
```

- [ ] **Step 5: 提交最终文档**

```bash
git add apps/web README.md

git commit -m "docs(web): add frontend readme and verify skeleton"
```

---

## Self-Review

### 1. Ticket coverage

- Scenario 1（启动 Vite 开发服务器）→ Task 1、Task 5。
- Scenario 2（使用 TanStack Router 导航）→ Task 4、Task 5。
- Scenario 3（使用 Tailwind 渲染 shadcn/ui）→ Task 2、Task 3、Task 5。

### 2. Placeholder scan

计划无 `TBD`、`TODO`、`implement later`、`fill in details` 或类似模糊描述；每个步骤包含实际代码或命令。

### 3. Type consistency

- `App.tsx` 使用 `Outlet` 作为路由占位，与 `__root.tsx` 一致。
- `Button` 组件使用 `cn` 工具，与 `components.json` 配置一致。
- `main.tsx` 使用 `createRouter` + `RouterProvider`，与 `routeTree.gen.ts` 生成格式一致。
- 路由测试使用 `createRouter` 和 `RouterProvider`，与主入口一致。

### 4. Plan reliability

本计划假设 ticket 001 已完成基础 workspace 和 `apps/web` 最小结构。若 ticket 001 尚未完成，则 Task 1 中需要先创建基础文件。路由生成步骤依赖 TanStack Router CLI，已提供精确命令。`@/` 路径别名在 `tsconfig.app.json` 和 `vite.config.ts` 中一致配置。shadcn/ui 仅引入 Button 组件，避免引入过多业务无关组件。

---

## Execution Handoff

Plan complete and saved to `tickets/004-初始化react-pwa前端骨架/plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you like?
