Title: 搭建 SST v3 Monorepo 基础结构
Old-ID: 001
Status: resolved
Labels: infra,monorepo
Estimate: 5
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md

# 搭建 SST v3 Monorepo 基础结构

## 用户故事

作为开发者，我希望拥有一个可运行的 SST v3 monorepo，以便能够构建和部署 LyCo-list 的 API 和 Web 应用。

## 范围

### 包含

- Bun workspace、SST v3 根配置、共享工具链
- 最小可运行的 `apps/web` 和 `apps/api`
- 占位 health Lambda 和 StaticSite
- CI 工作流
- Bruno 集合占位（含 health 请求）

### 不包含

- Cognito 配置与认证（ticket 002）
- DynamoDB 表与 schema（ticket 003）
- React PWA 骨架（ticket 004）
- 真实业务接口与业务逻辑

## 验收标准

### 场景 1：安装工作区依赖

Given 仓库已克隆
When 我运行 `bun install --registry https://registry.npmmirror.com`
Then 所有工作区依赖都成功安装且无错误

### 场景 2：代码规范与类型检查

Given monorepo 已安装
When 我运行 `bun check`
Then Biome 格式化与检查全部通过

When 我运行 `bun typecheck`
Then 所有包的 TypeScript 类型检查通过

### 场景 3：测试通过且覆盖率达 100%

Given monorepo 已安装
When 我运行 `bun test`
Then 所有测试通过
And statements / branches / functions / lines 覆盖率均达到 100%

### 场景 4：启动本地开发环境

Given monorepo 已安装
When 我运行 `sst dev`
Then 本地开发环境启动
And API Gateway 暴露 `/api/health` 返回 `200 { ok: true }`
And StaticSite 暴露前端 URL

### 场景 5：共享包可导入

Given monorepo 已安装
When 我从 `packages/shared` 导入 `buildResponse`
Then 该导入在 `apps/web` 和 `apps/api` 中都能解析并正常工作

### 场景 6：Bruno 集合包含 health 请求

Given monorepo 已安装
When 我打开 `bruno/lyco-list/health/get health.bru`
Then 请求文件包含正确的 `GET /api/health` 配置

## 后续工单

- Cognito User Pool / Hosted UI / 关闭公开注册 → ticket 002
- DynamoDB 单表、实体 schema、cursor 工具 → ticket 003
- React PWA 骨架（Router/Query/Store/Form）→ ticket 004

## 计划实施备注

- 设计文档要求 Lambda 使用 Node.js 24 runtime，但当前 SST v3 与 AWS 区域对 `nodejs24.x` 支持可能不完全；计划保守使用 `nodejs22.x` 占位，待支持成熟后在 ticket 002/003 中统一升级。
- `sst dev` 完整验证（Scenario 4）需要有效的 AWS 凭证与 `ap-southeast-1` 访问权限；无凭证时无法本地调用 `/api/health` 或部署 StaticSite，但代码结构与配置保持完整可部署。
- `apps/api` 的占位 health Lambda 目录结构为 `src/health/index.ts`（与历史决策一致，便于后续按域扩展为 `src/<domain>/index.ts`）。
- health handler 引入 `@types/aws-lambda` 并显式标注 `APIGatewayProxyHandlerV2` 类型，不引入 `aws-lambda` 运行时包。
- Bruno 集合根文件使用 `collection.bru`。
- 根目录添加 `tsconfig.json` 使用 TypeScript project references；各子包补充 `composite` / `declaration` 配置以支持 `tsc --build --noEmit`。
- `packages/shared` 在 `buildResponse` 之外增加 `errorResponse(message, code?)` helper，供后续业务接口统一返回错误体。
- 本 ticket 不创建 `.env.example`（环境变量由 SST 注入，无需本地手动配置）。
- **Vitest workspace 实现调整**：计划原稿使用 `vitest.workspace.ts` 与根 `vitest.config.ts` fallback；实际实现改用 `vitest.config.ts` 中的 `test.projects` 字段聚合 `apps/*/vitest.config.ts` 与 `packages/*/vitest.config.ts`。原因：Vitest 3.2 已弃用 workspace 文件，且空 workspace 会报错。子包 `vitest.config.ts` 独立配置，不再导入根配置（避免 TypeScript `rootDir` 越界检查）。
- **测试命令区分**：`bun test` 会启动 Bun 原生测试运行器，不加载 `jsdom` 且无法识别 `vitest.config.ts`。CI 与文档统一使用 `bun run test` 执行 `vitest run --coverage --passWithNoTests`。
- **覆盖率配置调整**：根 `vitest.config.ts` 设置 `coverage.all: false` 并排除 `.sst/**`、`node_modules/**`、`*vite.config.ts`、`*sst.config.ts`、`*test-setup.ts` 等，防止 SST 平台文件和配置文件污染覆盖率报告。
- **前端测试依赖**：`apps/web` 额外引入 `@testing-library/jest-dom` 与 `src/test-setup.ts`，以支持 `toBeInTheDocument` 等 DOM matcher；未在原计划列出。
- **TypeScript 模块解析调整**：`apps/api` 的 `tsconfig.json` 从计划的 `NodeNext` 改为 `ESNext + bundler`，避免 NodeNext 下相对导入必须带 `.js` 扩展以及 `vitest.config.ts` 越界引用根配置的问题；`packages/shared` 保持 `NodeNext` 并在相对导入中显式使用 `.js` 扩展（`./response.js`、`./index.js`）。
- **CI 工具版本**：`oven-sh/setup-bun` 固定为 `v2.2.0`（非浮动的 `v2`），因为 v2.2.0 将 action runtime 升级到 Node 24，避免 GitHub Actions 的 Node 20 弃用警告。
- **根依赖补充**：新增 `@types/node` 作为根 devDependency，满足 `apps/api` 的 `types: ["node"]` 和 `tsc --build` 需要。
- **Git 忽略补充**：`.gitignore` 增加 `*.tsbuildinfo`，避免 TypeScript 构建信息文件被提交。

## Plan

# 搭建 SST v3 Monorepo 基础结构 Implementation Plan

> Ticket: `tickets/001-搭建sst-v3-monorepo基础结构/ticket.md`
> Plan: `tickets/001-搭建sst-v3-monorepo基础结构/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建一个基于 Bun workspace、SST v3、Biome、Vitest 的 LyCo-list monorepo 基础结构，包含可运行的 `apps/web`、`apps/api`、共享 `packages/shared`、Bruno 集合占位和 CI 工作流，并满足 100% 测试覆盖率。

**Architecture:** 根目录使用 `bun` workspaces 管理 `apps/web`、`apps/api` 和 `packages/shared`；`sst.config.ts` 定义 `ApiGatewayV2` 路由 `/api/health` 到 `apps/api` 的 Lambda，并部署 `StaticSite` 作为前端；`packages/shared` 提供 `buildResponse` 与 `errorResponse` 工具；`biome.json` 和 `vitest.workspace.ts` 提供统一的代码规范与测试覆盖率阈值。

## Global Constraints

- 包管理器：`bun` workspaces，安装依赖时使用 `--registry https://registry.npmmirror.com`。
- 代码规范：`biome.json` 统一配置，开发脚本 `bun check`，CI 使用 `bunx @biomejs/biome ci`。
- 类型检查：优先使用 `bunx tsgo`；若 tsgo 不兼容，回退到 `tsc --noEmit`。
- 测试框架：Vitest，覆盖率阈值 statements / branches / functions / lines 均为 100%。
- 前端：React + Vite + TypeScript + Tailwind CSS v4（CSS-first）+ shadcn/ui。
- 后端：AWS Lambda (Node.js 24) + API Gateway HTTP API v2，原生 Lambda handler，无框架。
- 部署：SST v3，根 `sst.config.ts` 配置 `ApiGatewayV2` + `StaticSite`。
- 共享包：`packages/shared` 提供 `buildResponse` 和 `errorResponse(message, code?)`，每个 Lambda 独立打包。
- API 测试集合：`bruno/` 目录，含 `acc` / `prod` 环境（对应 `acc.bru` / `prod.bru`）和 `GET /api/health` 请求。
- 域名与 Cognito：ticket 001 中仅使用 `sst.Secret` 占位（placeholder 值），真实值在 ticket 002 中替换。
- 所有业务逻辑按 TDD 开发；脚手架代码（如 `buildResponse`、health handler）也必须编写测试并满足 100% 覆盖率。
- Git 提交格式：`类型(范围): 描述`，英文、小写、祈使句、末尾不加句号。

---

### Task 1: 初始化 Bun Workspace 与根项目配置

> Covers: Scenario 1（安装工作区依赖）

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Modify: `README.md`（后续 Task 10 补充）

**Interfaces:**
- Produces: workspace 定义 `apps/*`、`packages/*`，根脚本 `check`、`typecheck`、`test`。

- [ ] **Step 1: 创建根 `package.json`**

```json
{
  "name": "lyco-list",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "check": "bunx @biomejs/biome check",
    "check:fix": "bunx @biomejs/biome check --write",
    "typecheck": "tsc --build --noEmit",
    "test": "vitest run",
    "dev": "sst dev"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "sst": "^3.7.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 `.gitignore`**

```gitignore
# Dependencies
node_modules
bun.lockb

# Build outputs
dist
dist-ssr
.output

# SST
.sst
*.sst.*

# Environment files
.env
.env.*

# Logs
*.log
logs

# IDE
.vscode
.idea
*.swp

# OS
.DS_Store
Thumbs.db

# Testing
coverage
```

- [ ] **Step 3: 创建根 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "composite": true
  },
  "references": [
    { "path": "./apps/api" },
    { "path": "./apps/web" },
    { "path": "./packages/shared" }
  ],
  "include": [],
  "exclude": ["node_modules", "dist", ".sst", "coverage"]
}
```

- [ ] **Step 4: 运行 `bun install` 初始化 lockfile**

Run: `bun install --registry https://registry.npmmirror.com`

Expected: 成功生成 `bun.lock` 且无错误。

- [ ] **Step 5: 提交**

```bash
git add package.json tsconfig.json .gitignore bun.lock
git commit -m "chore(repo): initialize bun workspace with sst, biome, vitest"
```

---

### Task 2: 配置 Biome 代码规范

> Covers: Scenario 2（`bun check` 通过）

**Files:**
- Create: `biome.json`
- Modify: `package.json`（根脚本已存在）

**Interfaces:**
- Produces: `bun check` 命令格式化并检查所有 `apps/`、`packages/`、`bruno/` 之外的 TypeScript/JSON 文件。

- [ ] **Step 1: 创建 `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "off"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      ".sst",
      "coverage",
      "bun.lock",
      "sst-env.d.ts"
    ]
  }
}
```

- [ ] **Step 2: 运行 `bun check` 验证配置本身可解析**

Run: `bun check`

Expected: 当前仓库无 TS/JS 源码，`biome` 仅扫描配置文件，返回 `0` 且无错误。

- [ ] **Step 3: 提交**

```bash
git add biome.json
git commit -m "chore(repo): add biome configuration"
```

---

### Task 3: 配置 Vitest 与 100% 覆盖率阈值

> Covers: Scenario 3（`bun test` 通过且覆盖率 100%）

**Files:**
- Create: `vitest.workspace.ts`
- Create: `vitest.config.ts`（根目录 fallback，与 workspace 并存）
- Modify: `package.json`（根 scripts）

**Interfaces:**
- Produces: `bun test` 运行所有子包测试，覆盖率阈值强制为 100%。

- [ ] **Step 1: 创建 `vitest.workspace.ts`**

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/*/vitest.config.ts",
  "packages/*/vitest.config.ts",
]);
```

- [ ] **Step 2: 创建 `vitest.config.ts` 作为覆盖率默认模板**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/vitest.config.ts",
      ],
    },
  },
});
```

- [ ] **Step 3: 更新根 `package.json` 测试脚本**

修改 `scripts.test` 为：

```json
"test": "vitest run --coverage"
```

- [ ] **Step 4: 安装测试依赖**

Run: `bun add -d @vitest/coverage-v8 --registry https://registry.npmmirror.com`

Expected: `package.json` 中新增 `@vitest/coverage-v8`。

- [ ] **Step 5: 运行 `bun test` 验证无配置错误**

Run: `bun test`

Expected: 因无测试文件，Vitest 报告 `No test files found` 但进程返回 `0`（若报错则调整 workspace 模式）。

- [ ] **Step 6: 提交**

```bash
git add vitest.workspace.ts vitest.config.ts package.json
git commit -m "chore(test): configure vitest workspace with 100% coverage thresholds"
```

---

### Task 4: 创建共享包 `packages/shared` 与 `buildResponse`

> Covers: Scenario 5（共享包可导入）、Scenario 3（覆盖率 100%）

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/response.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/response.test.ts`

**Interfaces:**
- Produces: `buildResponse(statusCode: number, body: Record<string, unknown>) => { statusCode: number; headers: Record<string, string>; body: string }` 与 `errorResponse(message: string, code?: string) => { statusCode: number; headers: Record<string, string>; body: string }`（均从 `@lyco/shared` 导出）。
- Consumes: 被 `apps/api` 的 health Lambda 使用。

- [ ] **Step 1: 创建 `packages/shared/package.json`**

```json
{
  "name": "@lyco/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run --coverage"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 `packages/shared/src/response.ts`**

```typescript
export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function buildResponse(
  statusCode: number,
  body: Record<string, unknown>,
): ApiResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  message: string,
  code?: string,
  statusCode = 500,
): ApiResponse {
  return buildResponse(statusCode, {
    error: message,
    ...(code ? { code } : {}),
  });
}
```

- [ ] **Step 4: 创建 `packages/shared/src/index.ts`**

```typescript
export {
  buildResponse,
  errorResponse,
  type ApiResponse,
} from "./response";
```

- [ ] **Step 5: 创建 `packages/shared/vitest.config.ts`**

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default mergeConfig(rootConfig, defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
}));
```

- [ ] **Step 6: 编写 `response` 测试（TDD）**

`packages/shared/src/response.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildResponse, errorResponse } from "./response";

describe("buildResponse", () => {
  it("returns a JSON API response with the given status code", () => {
    const result = buildResponse(200, { ok: true });

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.body).toBe(JSON.stringify({ ok: true }));
  });

  it("serializes nested objects", () => {
    const result = buildResponse(201, { nested: { value: 1 } });

    expect(result.body).toBe(JSON.stringify({ nested: { value: 1 } }));
  });
});

describe("errorResponse", () => {
  it("returns a 500 error body by default", () => {
    const result = errorResponse("something went wrong");

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: "something went wrong",
    });
  });

  it("includes a code when provided", () => {
    const result = errorResponse("conflict", "CONFLICT", 409);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: "conflict",
      code: "CONFLICT",
    });
  });
});
```

- [ ] **Step 7: 运行 `packages/shared` 测试并确认失败**

Run: `cd packages/shared && bun test`

Expected: 失败（`buildResponse` / `errorResponse` 未定义），实际此处实现已存在，因此应通过。TDD 原则：先写测试，测试文件创建时实现尚未存在；但在计划执行时，Step 6 和 Step 3 实际由同一实现者完成，因此只需在提交前确认测试通过。

- [ ] **Step 8: 运行 `packages/shared` 测试并确认通过 + 100% 覆盖**

Run: `cd packages/shared && bun test`

Expected: 4 个测试通过，覆盖率 100%。

- [ ] **Step 9: 运行根 `bun check` 确保格式正确**

Run: `bun check`

Expected: 无错误。

- [ ] **Step 10: 提交**

```bash
git add packages/shared
git commit -m "feat(shared): add buildResponse and errorResponse utilities"
```

---

### Task 5: 创建后端 `apps/api` 与占位 health Lambda

> Covers: Scenario 4（`/api/health` 返回 `200 { ok: true }`）、Scenario 3（覆盖率 100%）

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/health/index.ts`
- Create: `apps/api/src/health/index.test.ts`
- Modify: `packages/shared`（已存在）

**Interfaces:**
- Consumes: `buildResponse` from `@lyco/shared`。
- Produces: `handler` 函数，符合 AWS Lambda `APIGatewayProxyHandlerV2` 签名，返回 `200 { ok: true }`。

- [ ] **Step 1: 创建 `apps/api/package.json`**

```json
{
  "name": "@lyco/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lyco/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.149",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 3: 创建 `apps/api/vitest.config.ts`**

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default mergeConfig(rootConfig, defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
}));
```

- [ ] **Step 4: 编写 health handler 测试（TDD）**

`apps/api/src/health/index.test.ts`:

```typescript
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handler } from "./index";

describe("health handler", () => {
  it("returns 200 with ok: true", async () => {
    const result = await handler();

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(result.body ?? "{}")).toEqual({ ok: true });
  });

  it("is typed as APIGatewayProxyHandlerV2", () => {
    const typed: APIGatewayProxyHandlerV2 = handler;
    expect(typed).toBeDefined();
  });
});
```

- [ ] **Step 5: 运行 health 测试并确认失败**

Run: `cd apps/api && bun test src/health/index.test.ts`

Expected: FAIL with `Cannot find module './index'` 或 `handler is not a function`。

- [ ] **Step 6: 创建 `apps/api/src/health/index.ts`**

```typescript
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { buildResponse } from "@lyco/shared";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return buildResponse(200, { ok: true });
};
```

- [ ] **Step 7: 运行 health 测试并确认通过 + 100% 覆盖**

Run: `cd apps/api && bun test src/health/index.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 8: 重新安装依赖以解析 workspace 链接**

Run: `bun install --registry https://registry.npmmirror.com`

Expected: 无错误，`@lyco/shared` 链接到 workspace。

- [ ] **Step 9: 运行根检查**

Run: `bun check`

Expected: 无错误。

- [ ] **Step 10: 提交**

```bash
git add apps/api package.json bun.lock
git commit -m "feat(api): add placeholder health lambda"
```

---

### Task 6: 创建 SST v3 根配置

> Covers: Scenario 4（`sst dev` 启动本地环境并暴露 `/api/health` 与前端 URL）

**Files:**
- Create: `sst.config.ts`
- Modify: `package.json`（确保 `sst` 已安装）

**Interfaces:**
- Consumes: `apps/api/src/health/index.handler`。
- Produces: `ApiGatewayV2` 暴露 `api.url`，`StaticSite` 暴露 `web.url`。

- [ ] **Step 1: 确认 `sst` 已作为根 devDependency**

根 `package.json` 中应包含 `"sst": "^3.7.0"`。若不存在，运行：

Run: `bun add -d sst --registry https://registry.npmmirror.com`

- [ ] **Step 2: 创建 `sst.config.ts`**

```typescript
/// <reference types="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "lyco-list",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-1",
        },
      },
    };
  },
  async run() {
    const userPoolId = new sst.Secret("USER_POOL_ID", "todo-in-ticket-002");
    const userPoolClientId = new sst.Secret(
      "USER_POOL_CLIENT_ID",
      "todo-in-ticket-002",
    );

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["content-type", "authorization"],
      },
    });

    api.route("GET /api/health", {
      handler: "apps/api/src/health/index.handler",
      runtime: "nodejs22.x",
      environment: {
        USER_POOL_ID: userPoolId.value,
        USER_POOL_CLIENT_ID: userPoolClientId.value,
      },
    });

    const web = new sst.aws.StaticSite("Web", {
      path: "apps/web",
      build: {
        command: "bun run build",
        output: "dist",
      },
      environment: {
        VITE_API_URL: api.url,
        VITE_USER_POOL_ID: userPoolId.value,
        VITE_USER_POOL_CLIENT_ID: userPoolClientId.value,
      },
    });

    return {
      api: api.url,
      web: web.url,
    };
  },
});
```

**注意：** 设计文档要求 Node.js 24 runtime，但 SST v3 当前 `nodejs24.x` runtime 可能尚未普遍可用。若 `sst dev` 报错，将 runtime 改为 `nodejs22.x`，并在 ticket 描述中备注 Node.js 24 待 SST/区域支持后切换。本计划保守使用 `nodejs22.x`。

- [ ] **Step 3: 运行 `sst install` 以下载 provider**

Run: `bunx sst install`

Expected: 成功安装 SST 平台类型定义与 provider，生成 `.sst/platform/` 与 `.sst/types/`。

- [ ] **Step 4: 验证 `sst dev` 可启动（本地 dry-run 或真实部署）**

Run: `bunx sst dev --stage dev`

Expected: 控制台输出 API URL 与 Web URL，`/api/health` 可访问返回 `200 { ok: true }`。由于需要 AWS 凭证，若本地无凭证则该步骤在 plan 中标记为可选，但需在具备 AWS 环境后验证。

- [ ] **Step 5: 运行 `bun check` 确保无格式问题**

Run: `bun check`

Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add sst.config.ts
git commit -m "feat(infra): add sst v3 config with api gateway and static site"
```

---

### Task 7: 创建前端 `apps/web`

> Covers: Scenario 4（StaticSite 暴露前端 URL）、Scenario 2（`bun check` 与 `bun typecheck` 通过）

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.app.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/App.test.tsx`
- Create: `apps/web/components.json`（shadcn/ui 配置）
- Modify: `vitest.config.ts`（根 coverage exclude，新增 `apps/web/**` 默认 exclude 已覆盖）

**Interfaces:**
- Produces: `App` 组件渲染占位文本；`Vite` 构建输出到 `dist/`；`StaticSite` 可引用。
- Consumes: 环境变量 `VITE_API_URL`、`VITE_USER_POOL_ID`、`VITE_USER_POOL_CLIENT_ID`。

- [ ] **Step 1: 创建 `apps/web/package.json`**

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
    "react-dom": "^19.0.0"
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

- [ ] **Step 2: 创建 `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "composite": true
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 3: 创建 `apps/web/tsconfig.app.json`**

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
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 `apps/web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "composite": true,
    "declaration": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 创建 `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 6: 创建 `apps/web/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LyCo-list</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: 创建 `apps/web/src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USER_POOL_ID: string;
  readonly VITE_USER_POOL_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 8: 创建 Tailwind CSS v4 入口 `apps/web/src/index.css`**

```css
@import "tailwindcss";

@theme {
  --color-lyco-bg: #f8fafc;
  --color-lyco-text: #0f172a;
}

body {
  background-color: var(--color-lyco-bg);
  color: var(--color-lyco-text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  margin: 0;
}
```

- [ ] **Step 9: 创建 `apps/web/src/main.tsx`**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
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

- [ ] **Step 10: 创建 `apps/web/src/App.tsx`**

```typescript
export default function App() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">LyCo-list</h1>
      <p className="mt-2 text-sm">PWA 待办应用</p>
    </main>
  );
}
```

- [ ] **Step 11: 创建 `apps/web/components.json`（shadcn/ui 占位）**

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

- [ ] **Step 12: 创建 `apps/web/vitest.config.ts`**

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";
import viteConfig from "./vite.config";

export default mergeConfig(
  rootConfig,
  mergeConfig(viteConfig, defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    },
  })),
);
```

- [ ] **Step 13: 编写 `App` 测试（TDD）**

`apps/web/src/App.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);

    expect(screen.getByText("LyCo-list")).toBeInTheDocument();
    expect(screen.getByText("PWA 待办应用")).toBeInTheDocument();
  });
});
```

- [ ] **Step 14: 运行 web 测试并确认失败**

Run: `cd apps/web && bun test src/App.test.tsx`

Expected: FAIL（组件不存在或测试依赖未安装）。

- [ ] **Step 15: 安装 web 依赖并再次运行测试**

Run: `bun install --registry https://registry.npmmirror.com`

Run: `cd apps/web && bun test src/App.test.tsx`

Expected: PASS，覆盖率 100%。

- [ ] **Step 16: 运行 `bun check` 与 `bun typecheck`**

Run: `bun check`

Run: `bun typecheck`

Expected: 均无错误。

- [ ] **Step 17: 提交**

```bash
git add apps/web package.json bun.lock
git commit -m "feat(web): initialize vite react app with tailwind v4 and tests"
```

---

### Task 8: 创建 Bruno API 集合

> Covers: Scenario 6（Bruno 集合包含 health 请求）

**Files:**
- Create: `bruno/lyco-list/collection.bru`
- Create: `bruno/lyco-list/environments/acc.bru`
- Create: `bruno/lyco-list/environments/prod.bru`
- Create: `bruno/lyco-list/health/get health.bru`
- Create: `bruno/.gitignore`

**Interfaces:**
- Produces: Bruno 集合，含 `acc` / `prod` 环境变量 `baseUrl`、`accessToken`；`health` 请求 `GET /api/health`。

- [ ] **Step 1: 创建 `bruno/lyco-list/collection.bru`**

```
name: lyco-list
vars {
  baseUrl: {{baseUrl}}
  accessToken: {{accessToken}}
}
auth {
  mode: bearer
}
auth:bearer {
  token: {{accessToken}}
}
```

- [ ] **Step 2: 创建 `bruno/lyco-list/environments/acc.bru`**

```
vars {
  baseUrl: https://api.acc.jan24th.today
  accessToken: 
}
```

- [ ] **Step 3: 创建 `bruno/lyco-list/environments/prod.bru`**

```
vars {
  baseUrl: https://api.jan24th.today
  accessToken: 
}
```

- [ ] **Step 4: 创建 `bruno/lyco-list/health/get health.bru`**

```
meta {
  name: get health
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/health
  body: none
  auth: inherit
}
```

- [ ] **Step 5: 创建 `bruno/.gitignore`**

```gitignore
# Bruno local environment files may contain tokens
environments/local.bru
```

- [ ] **Step 6: 运行 `bun check` 确保 Bruno 文件不影响 lint**

Run: `bun check`

Expected: 无错误（Biome 不处理 `.bru` 文件）。

- [ ] **Step 7: 提交**

```bash
git add bruno
git commit -m "chore(bruno): initialize api collection with health request"
```

---

### Task 9: 创建 GitHub CI 工作流

> Covers: Scenario 2（CI 代码规范与类型检查）、Scenario 3（CI 测试与覆盖率）

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/README.md`（可选，Task 10 补充）

**Interfaces:**
- Produces: CI 在 PR/push 时运行 `bun install`、`bun check`、`bun typecheck`、`bun test`。

- [ ] **Step 1: 创建 `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    name: Lint and Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --registry https://registry.npmmirror.com
      - run: bunx @biomejs/biome ci

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --registry https://registry.npmmirror.com
      - run: bun typecheck

  test:
    name: Test and Coverage
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --registry https://registry.npmmirror.com
      - run: bun test
```

- [ ] **Step 2: 验证 CI YAML 格式**

Run: `bunx @biomejs/biome check .github/workflows/ci.yml`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): add github actions workflow for check, typecheck and test"
```

---

### Task 10: 最终验证、文档同步与收尾

> Covers: 所有验收标准的端到端验证

**Files:**
- Modify: `README.md`
- Modify: `tickets/001-搭建sst-v3-monorepo基础结构/ticket.md`（若需补充备注）

**Interfaces:**
- Produces: 可运行的 monorepo，所有验收标准通过。

- [ ] **Step 1: 更新 `README.md` 描述项目结构与常用命令**

`README.md` 内容：

```markdown
# LyCo-list

对标 Apple Reminders 的家庭/小团队共享 PWA 待办应用。

## 技术栈

- 包管理：Bun workspaces
- 前端：React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui
- 后端：AWS Lambda (Node.js) + API Gateway HTTP API v2
- 基础设施：SST v3
- 测试：Vitest（100% 覆盖率）
- 代码规范：Biome

## 项目结构

```
LyCo-list/
├── apps/
│   ├── web/                # React PWA 前端
│   └── api/                # Lambda 函数
├── packages/
│   └── shared/             # 共享类型、schema、工具
├── bruno/                  # Bruno API 集合
├── sst.config.ts           # SST 根配置
└── biome.json              # 代码规范配置
```

## 常用命令

```bash
# 安装依赖
bun install --registry https://registry.npmmirror.com

# 代码检查与格式化
bun check
bun check:fix

# 类型检查
bun typecheck

# 测试（100% 覆盖率）
bun test

# 本地开发
sst dev
```

## 环境要求

- Bun 1.2+
- AWS 凭证（用于 `sst dev` / `sst deploy`）
- 可选：tsgo（类型检查加速）
```

- [ ] **Step 2: 运行完整本地验证序列**

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
- `bun typecheck` 成功（或明确说明 tsgo 不可用时回退到 `tsc --noEmit`）。
- `bun test` 所有测试通过，覆盖率 100%。

- [ ] **Step 3: 验证 `/api/health` 本地可访问（若具备 AWS 环境）**

Run: `bunx sst dev --stage dev`

Wait until `Api` URL is printed, then:

Run: `curl -s $(bunx sst state print --stage dev | jq -r '.api')/api/health`

Expected: `{"ok":true}`，HTTP 200。

若无法运行 `sst dev`，在 ticket 备注中记录：需要 AWS 凭证与 ap-southeast-1 权限才能完整验证 Scenario 4。

- [ ] **Step 4: 验证 `apps/web` 可导入 `@lyco/shared`**

在 `apps/web/src/App.tsx` 中添加临时导入：

```typescript
import { buildResponse } from "@lyco/shared";
```

运行 `bun typecheck` 应通过。完成后保留该导入或移除（推荐保留一个引用以验证 workspace 链接）。

- [ ] **Step 5: 检查并清理临时文件**

确认未提交 `.env`、`.sst/`、`*sst*` 临时文件或测试覆盖率报告目录 `coverage/`。

- [ ] **Step 6: 提交最终文档与调整**

```bash
git add README.md
git commit -m "docs(readme): document project structure and commands"
```

- [ ] **Step 7: 同步 ticket 备注（如需要）**

若 `sst dev` 需要 AWS 凭证或 Node.js 24 runtime 暂不可用，打开 `tickets/001-搭建sst-v3-monorepo基础结构/ticket.md` 并在 `Open Questions` 或 `References` 末尾添加：

```markdown
## 计划实施备注
- Node.js 24 runtime 需等待 SST v3/区域支持，当前使用 `nodejs22.x` 占位。
- `sst dev` 完整验证需要有效的 AWS 凭证与 ap-southeast-1 访问权限；无凭证时无法验证 Scenario 4 的本地 API 调用。
```

---

## Self-Review

### 1. Ticket coverage

- Scenario 1（`bun install` 成功）→ Task 1。
- Scenario 2（`bun check` 与 `bun typecheck` 通过）→ Task 2、Task 7、Task 10。
- Scenario 3（`bun test` 通过且 100% 覆盖率）→ Task 3、Task 4、Task 5、Task 7、Task 10。
- Scenario 4（`sst dev` 启动，`/api/health` 与前端 URL 暴露）→ Task 6、Task 7、Task 10。
- Scenario 5（`@lyco/shared` 在 web 和 api 可导入）→ Task 4、Task 5、Task 7、Task 10。
- Scenario 6（Bruno 集合含 health 请求）→ Task 8。

### 2. Placeholder scan

计划无 `TBD`、`TODO`、`implement later`、`fill in details` 或类似模糊描述；每个步骤包含实际代码或命令。

### 3. Type consistency

- `buildResponse` 与 `errorResponse` 在 `packages/shared/src/response.ts` 中签名一致，在 `apps/api` 和 `apps/web` 中引用名称一致。
- `handler` 在 `apps/api/src/health/index.ts` 中定义并显式标注 `APIGatewayProxyHandlerV2` 类型，在测试文件中引用一致。

### 4. Plan reliability

本计划所有任务依赖顺序合理：Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10。`packages/shared` 在 `apps/api` 之前完成；`apps/web` 在 SST 配置之后完成（StaticSite 引用 `apps/web` 路径）；CI 在所有代码就绪后添加。高风险点 `sst dev` 已在 Task 6 和 Task 10 中明确说明需 AWS 凭证与 runtime 兼容性。

---

## Execution Handoff

Plan complete and saved to `tickets/001-搭建sst-v3-monorepo基础结构/plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you like?
