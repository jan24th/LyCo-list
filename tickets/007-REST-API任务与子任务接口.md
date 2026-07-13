---
Title: REST API 任务与子任务接口
Status: TODO
Labels: backend, api
Estimate: 5
PHASE: 1
CYCLE: 3
Depends: 002-后端脚手架, 005-Prisma数据模型, 006-REST-API列表接口
---

# REST API 任务与子任务接口

## User Story

As a 前端应用，I want 通过 REST API 管理任务和子任务，So that 用户可以创建、更新、完成和删除任务。

## Acceptance Criteria

### Scenario 1: 创建任务

Given 请求体包含 title、listId 等必要字段
When 调用 `POST /api/tasks`
Then 返回新创建的任务对象，HTTP 状态 201

### Scenario 2: 获取任务列表

Given 数据库中存在任务
When 调用 `GET /api/tasks`
Then 返回任务数组，支持按 listId 过滤

### Scenario 3: 获取任务详情

Given 任务存在
When 调用 `GET /api/tasks/:id`
Then 返回任务详情，包含 reminders 和 children

### Scenario 4: 更新任务

Given 任务存在
When 调用 `PATCH /api/tasks/:id`
Then 返回更新后的任务对象

### Scenario 5: 切换任务完成状态

Given 任务存在
When 调用 `POST /api/tasks/:id/complete`
Then 任务完成状态切换并返回更新后的任务

### Scenario 6: 移动任务

Given 任务存在
When 调用 `POST /api/tasks/:id/move` 并传入新 listId
Then 任务及其子任务移动到新列表

### Scenario 7: 删除任务与级联规则

Given 任务存在
When 调用 `DELETE /api/tasks/:id`
Then 非空父任务被拒绝删除，叶子任务被删除

### Scenario 8: 创建子任务

Given 父任务存在
When 调用 `POST /api/tasks` 并传入 `parentId`
Then 新任务作为子任务创建，并返回包含 parentId 的任务对象

### Scenario 9: TDD 开发与 100% 覆盖率

Given 项目要求 TDD
When 为任务接口编写测试
Then 测试先失败，实现后通过，覆盖率达到 100%

## References

- [Hono Routing](https://hono.dev/docs/api/routing)
- [Prisma Nested Writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes)
