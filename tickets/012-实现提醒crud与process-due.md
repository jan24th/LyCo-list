---
Title: 实现提醒 CRUD 与 process-due
ID: 012
Status: TODO
Labels: api,reminders
Estimate: 5
Depends: 009
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 实现提醒 CRUD 与 process-due

## User Story

作为用户，我希望设置提醒并处理到期提醒，以便在正确的时间收到通知。

## Acceptance Criteria

### Scenario 1: 创建提醒

Given 一个已存在的任务
When 用户创建提醒
Then 提醒以到期时间和时区存储

### Scenario 2: 更新提醒

Given 一个已存在的提醒
When 用户更新它
Then 修改通过 version 检查后持久化

### Scenario 3: 处理到期提醒

Given 提醒已过期
When process-due 任务运行
Then 为这些提醒创建通知
