---
Title: 实现 Assign 事务与幂等分配通知
ID: 011
Status: TODO
Labels: api,tasks,notifications
Estimate: 5
Depends: 007,009
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 实现 Assign 事务与幂等分配通知

## User Story

作为用户，我希望将任务分配给其他人并生成确定性通知，以便分配可靠且不会重复。

## Acceptance Criteria

### Scenario 1: 将任务分配给用户

Given 一个已存在的任务
When 用户将任务分配给另一个用户
Then 任务 assignee 被更新

### Scenario 2: 确定性通知 ID

Given 分配操作被重试
When 事务再次执行
Then 通知 ID 是确定性的，不会创建重复通知

### Scenario 3: 失败时回滚事务

Given 分配更新失败
When 事务执行
Then 不会创建通知
