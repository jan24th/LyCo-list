---
Title: 搭建 SST v3 Monorepo 基础结构
ID: 001
Status: TODO
Labels: infra,monorepo
Estimate: 5
Depends: 
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 搭建 SST v3 Monorepo 基础结构

## User Story

作为开发者，我希望拥有一个可运行的 SST v3 monorepo，以便能够构建和部署 LyCo-list 的 API 和 Web 应用。

## Acceptance Criteria

### Scenario 1: 安装工作区依赖

Given 仓库已克隆
When 我运行 `bun install`
Then 所有工作区依赖都成功安装且无错误

### Scenario 2: 启动本地开发环境

Given monorepo 已安装
When 我运行 `sst dev`
Then 本地开发环境启动并暴露 API 和 Web URL

### Scenario 3: 共享包可导入

Given monorepo 已安装
When 我从 `packages/shared` 导入类型
Then 该导入在 `apps/web` 和 `apps/api` 中都能解析
