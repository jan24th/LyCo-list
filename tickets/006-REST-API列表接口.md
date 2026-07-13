---
Title: REST API 列表接口
Status: TODO
Labels: backend, api
Estimate: 3
PHASE: 1
CYCLE: 3
Depends: 002-后端脚手架, 005-Prisma数据模型
---

# REST API 列表接口

## User Story

As a 前端应用，I want 通过 REST API 管理自定义列表，So that 可以创建、读取、更新和删除列表。

## Acceptance Criteria

### Scenario 1: 创建列表

Given 请求体包含 name、color、icon、order
When 调用 `POST /api/lists`
Then 返回新创建的列表对象，HTTP 状态 201

### Scenario 2: 获取所有列表

Given 数据库中存在列表
When 调用 `GET /api/lists`
Then 返回所有列表数组，按 order 排序

### Scenario 3: 更新列表

Given 列表存在
When 调用 `PATCH /api/lists/:id`
Then 返回更新后的列表对象

### Scenario 4: 删除空列表

Given 列表为空（无任务）
When 调用 `DELETE /api/lists/:id`
Then 列表被删除，返回 204

### Scenario 5: 拒绝删除非空列表

Given 列表包含任务
When 调用 `DELETE /api/lists/:id`
Then 返回 409 或 400 错误，列表不被删除

### Scenario 6: TDD 开发与 100% 覆盖率

Given 项目要求 TDD
When 为列表接口编写测试
Then 测试先失败，实现后通过，所有分支覆盖 100%

## References

- [Hono Routing](https://hono.dev/docs/api/routing)
- [Prisma CRUD](https://www.prisma.io/docs/orm/prisma-client/queries/crud)
