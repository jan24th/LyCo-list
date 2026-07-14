---
Title: 搭建 SST v3 Monorepo 基础结构
ID: 001
Status: Ready
Labels: infra,monorepo
Estimate: 5
Depends: 
PHASE: 1
CYCLE: 1
Source: 2026-07-13-lyco-list-design.md
Plan: .lychee/artifacts/plans/001-搭建sst-v3-monorepo基础结构.md
---

# 搭建 SST v3 Monorepo 基础结构

## User Story

作为开发者，我希望拥有一个可运行的 SST v3 monorepo，以便能够构建和部署 LyCo-list 的 API 和 Web 应用。

## Scope

- **包含**：Bun workspace、SST v3 根配置、共享工具链、最小可运行的 `apps/web` 和 `apps/api`、占位 health Lambda、占位 StaticSite、CI 工作流、Bruno 集合占位（含 health 请求）。
- **不包含**：Cognito（ticket 002）、DynamoDB 表与 schema（ticket 003）、React PWA 骨架（ticket 004）、真实业务接口。

## Decisions

| 项 | 决策 |
|---|---|
| `apps/web` | Vite + React + TypeScript + Tailwind CSS v4（CSS-first）+ shadcn/ui 初始化（`components.json`），不添加路由/状态/表单/API client，不添加示例组件 |
| `apps/api` | `package.json` + `tsconfig.json` + `src/health/index.ts` 返回 `200 { ok: true }` |
| `packages/shared` | `buildResponse` helper + 最小错误响应结构 |
| SST 资源 | `ApiGatewayV2` + `GET /api/health` 路由；`StaticSite` 占位 |
| 环境变量 | `VITE_API_URL` = `api.url`；`VITE_USER_POOL_ID` / `VITE_USER_POOL_CLIENT_ID` 用 `sst.Config.String` 占位，默认值 `todo-in-ticket-002` |
| 工具链 | 根目录 `biome.json` + `tsconfig.json`（references）+ `vitest.workspace.ts`；每个包有自己的 `tsconfig.json` 继承根配置 |
| CI | `.github/workflows/ci.yml`：安装依赖、Biome 检查、类型检查、测试 |
| 测试 | 测试 `buildResponse` 和 health handler，health handler 采用直接调用方式（不引入 `@types/aws-lambda`） |
| 覆盖率 | 全局 100%（statements/branches/functions/lines），从本 ticket 开始生效 |
| 域名/Region | 默认 `ap-southeast-1`，SST app name `lyco-list`，stage 为 `dev` / `prod` |

## Generated Files

```
LyCo-list/
├── package.json                    # workspaces + scripts (check, typecheck, test, coverage)
├── bun.lock
├── biome.json
├── tsconfig.json
├── vitest.workspace.ts
├── sst.config.ts                   # ApiGatewayV2 + StaticSite + Config placeholders
├── .env.example
├── .github/workflows/ci.yml
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── components.json
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── index.css
│   │   │   └── vite-env.d.ts
│   │   └── .env.example
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           └── health/
│               ├── index.ts
│               └── index.test.ts
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts
│           ├── response.ts
│           └── response.test.ts
└── bruno/                          # health API 请求集合占位
    ├── lyco-list/
    │   ├── bruno.json
    │   ├── environments/
    │   │   ├── development.bru
    │   │   └── production.bru
    │   └── health/
    │       └── get health.bru
```

## Acceptance Criteria

### Scenario 1: 安装工作区依赖

Given 仓库已克隆
When 我运行 `bun install --registry https://registry.npmmirror.com`
Then 所有工作区依赖都成功安装且无错误

### Scenario 2: 代码规范与类型检查

Given monorepo 已安装
When 我运行 `bun check`
Then Biome 格式化与检查全部通过

When 我运行 `bun typecheck`
Then 所有包的 TypeScript 类型检查通过

### Scenario 3: 测试通过且覆盖率达 100%

Given monorepo 已安装
When 我运行 `bun test`
Then 所有测试通过
And statements / branches / functions / lines 覆盖率均达到 100%

### Scenario 4: 启动本地开发环境

Given monorepo 已安装
When 我运行 `sst dev`
Then 本地开发环境启动
And API Gateway 暴露 `/api/health` 返回 `200 { ok: true }`
And StaticSite 暴露前端 URL

### Scenario 5: 共享包可导入

Given monorepo 已安装
When 我从 `packages/shared` 导入 `buildResponse`
Then 该导入在 `apps/web` 和 `apps/api` 中都能解析并正常工作

### Scenario 6: Bruno 集合包含 health 请求

Given monorepo 已安装
When 我打开 `bruno/lyco-list/health/get health.bru`
Then 请求文件包含正确的 `GET /api/health` 配置

## Open Questions / Next Tickets

- Cognito User Pool / Hosted UI / 关闭公开注册 → ticket 002
- DynamoDB 单表、实体 schema、cursor 工具 → ticket 003
- React PWA 骨架（Router/Query/Store/Form）→ ticket 004

## Notes

- 本 ticket 为纯基础设施与脚手架，不包含业务逻辑，因此不写业务级失败测试；但 `buildResponse` 和 health handler 仍需通过测试并满足 100% 覆盖率。
- `VITE_USER_POOL_ID` 和 `VITE_USER_POOL_CLIENT_ID` 当前为占位值，ticket 002 部署 Cognito 后替换为真实 ID。
- Bruno 集合在此 ticket 仅提供 health 请求示例和 development/production 环境文件，后续 ticket 逐步填充。
