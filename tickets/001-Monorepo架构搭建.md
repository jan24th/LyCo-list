---
Title: Monorepo 架构搭建
Status: TODO
Labels: frontend, backend, setup
Estimate: 5
PHASE: 1
CYCLE: 1
---

# Monorepo 架构搭建

## User Story

As a 开发者，I want 统一的前后端 monorepo 结构，So that 前端、后端和共享包可以协同开发并使用一致的依赖与规范。

## Acceptance Criteria

### Scenario 1: 创建目录结构

Given 仓库为空
When 创建 `apps/web`、`apps/api`、`packages/shared`、`bruno` 目录
Then 目录结构符合设计文档约定

### Scenario 2: 配置 Bun workspace

Given 目录结构已创建
When 配置根目录 `package.json` 的 workspaces
Then 在子包中可以通过 `bun install` 安装共享依赖

### Scenario 3: 配置 Biome

Given 项目存在多个子包
When 创建根目录 `biome.json` 并配置规则
Then Biome 可以一次性检查所有子包的格式与规范

### Scenario 4: 配置 Vitest

Given 项目要求 100% 覆盖率
When 在每个子包中配置 Vitest 并设置覆盖率阈值
Then 运行 `bunx vitest run --coverage` 时失败门槛生效

### Scenario 5: 配置 tsgo 类型检查

Given 项目使用 TypeScript
When 安装 tsgo 并配置类型检查脚本
Then 运行 `bunx tsgo`（或 `tsc --noEmit` 回退）时所有子包无类型错误

### Scenario 6: 验证提交前检查

Given 已配置 Biome、tsgo 和 Vitest
When 添加根目录脚本 `check`、`typecheck`、`test`、`coverage`
Then 开发者可以一键运行格式检查、类型检查和测试

## References

- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [Biome Configuration](https://biomejs.dev/reference/configuration/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
- [tsgo](https://github.com/microsoft/typescript-go)
