---
Title: 搭建 SST v3 Monorepo 基础结构
ID: 001
Status: Ready
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
