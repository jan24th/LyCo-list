---
Title: Prisma 数据模型
Status: TODO
Labels: backend, data-layer
Estimate: 5
PHASE: 1
CYCLE: 1
---

# Prisma 数据模型

## User Story

As a 后端开发者，I want 清晰的数据模型定义，So that 任务、列表、提醒和子任务关系可以在数据库中正确表达。

## Acceptance Criteria

### Scenario 1: 定义 List 模型

Given 后端项目已搭建
When 在 Prisma schema 中定义 `List` 模型
Then 模型包含 id、name、color、icon、order、createdAt、updatedAt 字段

### Scenario 2: 定义 Task 模型

Given Prisma schema 存在
When 定义 `Task` 模型
Then 模型包含 title、notes、listId、parentId、isCompleted、isFlagged、priority、dueDate、dueTime、order 字段，并正确关联 List 和自引用

### Scenario 3: 定义 Reminder 模型

Given Prisma schema 存在
When 定义 `Reminder` 模型
Then 模型包含 taskId、triggerAt、recurrence、nextTriggerAt、isEnabled 字段，并在关联的 Task 被删除时级联删除

### Scenario 4: 生成并运行 migration

Given schema 已定义
When 运行 `prisma migrate dev`
Then 数据库表结构正确创建

### Scenario 5: 为迁移和 seed 工具函数编写测试

Given 项目要求 TDD 和 100% 覆盖率
When 为数据库初始化、迁移运行和 seed 相关的工具函数编写测试
Then 测试先失败，实现后通过，覆盖率达到 100%

### Scenario 6: 创建数据库 seed

Given 数据库表已创建
When 创建 seed 脚本
Then 开发环境可以填充示例数据

## References

- [Prisma Schema](https://www.prisma.io/docs/orm/prisma-schema)
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- [Prisma Relations](https://www.prisma.io/docs/orm/prisma-schema/relations)
