---
Title: 实现列表 CRUD、软删除和恢复
ID: 008
Status: COMPLETED
Labels: api,lists
Estimate: 5
Depends: 003,006
PHASE: 1
CYCLE: 3
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现列表 CRUD、软删除和恢复

## 用户故事

作为用户，我希望创建、读取、更新、删除和恢复列表，以便组织我的任务。

## 范围

### 包含
- 实现列表的创建、读取、更新、删除与恢复 API
- 软删除机制：删除时写入 `deletedAt`，`version` 递增 1
- 恢复机制：清除 `deletedAt`，`version` 递增 1
- 基于 `expectedVersion` 的乐观锁与 `409` 冲突处理
- 列表查询分页（`limit`/`cursor`）并过滤已软删除列表

### 不包含
- 列表内任务的增删改查
- 列表的硬删除与数据清理（由 018 负责）
- 软删除时写入 `undoUntil`、`deletionVersion` 或创建 `DELETION_JOB`
- 恢复时的过期检查与 `410 GONE`（本期不实现撤销期限）
- 列表分享、权限与协作功能

## 验收标准

### 场景 1：创建列表

Given 已认证用户
When 用户 POST 一个新列表
Then 列表被创建并带有 `version`、`createdAt`、`updatedAt`、`createdBy`、`updatedBy`

### 场景 2：查询列表分页

Given 已存在多个列表
When 用户 GET `/api/lists` 并携带 `limit` 和 `cursor`
Then 返回未删除列表及不透明 `nextCursor`；默认 `limit=50`，最大 `limit=100`

### 场景 3：软删除列表

Given 一个已存在的列表
When 用户 DELETE 它并携带 `expectedVersion`
Then 列表被写入 `deletedAt` 并递增 `version`，但仍保留在数据库中

### 场景 4：软删除后读取过滤

Given 一个已软删除的列表
When 用户 GET `/api/lists`
Then 返回结果中不包含该列表

### 场景 5：恢复已删除的列表

Given 一个软删除的列表
When 用户 POST `/api/lists/{id}/restore` 并携带 `expectedVersion`
Then 列表清除 `deletedAt` 并递增 `version`，重新出现在查询结果中

### 场景 6：旧版本冲突

Given 列表 version 为 1
When 同时发送两个 `expectedVersion` 为 1 的更新
Then 一个成功，另一个返回 409

### 场景 7：删除与恢复的版本冲突

Given 列表 version 已被其他端更新
When 用户基于旧 version 提交删除或恢复
Then 后端返回 409

## 测试要求

- 使用 Vitest 编写集成测试，当前环境使用 AWS SDK mock 模拟 DynamoDB 客户端。
- 覆盖创建成功、字段校验、查询空列表、查询分页与 cursor、更新成功与 409、删除成功与读取过滤、恢复成功、删除/恢复 409。
- 覆盖率须达到 statements / branches / functions / lines 100%。
- 备注：项目后续应迁移至 DynamoDB Local 集成测试；本次 ticket 先保证业务逻辑覆盖。
