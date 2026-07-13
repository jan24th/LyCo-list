---
Title: REST API 搜索导入导出
Status: TODO
Labels: backend, api
Estimate: 5
PHASE: 1
CYCLE: 3
Depends: 002-后端脚手架, 005-Prisma数据模型, 007-REST-API任务与子任务接口
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-todo-design.md
---

# REST API 搜索导入导出

## User Story

As a 用户，I want 搜索任务并备份/恢复数据，So that 我可以快速查找任务并在设备间迁移数据。

## Acceptance Criteria

### Scenario 1: 搜索任务

Given 数据库中存在任务
When 调用 `GET /api/search?q=keyword`
Then 返回标题或备注匹配关键词的任务数组

### Scenario 2: 导出数据库

Given 数据库中存在数据
When 调用 `POST /api/export`
Then 返回包含 schema 版本的 JSON 数据

### Scenario 3: 导入数据库

Given 通过 multipart/form-data 上传有效的 `.lyco.json` 文件
When 调用 `POST /api/import`
Then 数据库内容被替换为导入的数据

### Scenario 4: 导入旧版本数据自动迁移

Given 通过 multipart/form-data 上传 schema 版本较旧的 `.lyco.json` 文件
When 调用 `POST /api/import`
Then 后端自动迁移数据到最新 schema

### Scenario 5: 拒绝损坏的导入

Given 导入文件无效
When 调用 `POST /api/import`
Then 返回 400 错误，数据库不被修改

### Scenario 6: TDD 开发与 100% 覆盖率

Given 项目要求 TDD
When 为搜索/导入/导出接口编写测试
Then 测试先失败，实现后通过，覆盖率达到 100%

## References

- [Hono File Upload](https://hono.dev/docs/api/helpers/form)
- [Prisma Full-Text Search](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search)
