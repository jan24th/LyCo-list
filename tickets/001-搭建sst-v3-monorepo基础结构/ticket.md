---
Title: 搭建 SST v3 Monorepo 基础结构
ID: 001
Status: Archived
Labels: infra,monorepo
Estimate: 5
Depends: 
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

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
