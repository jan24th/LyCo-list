---
Title: 实现 Users Assignee 列表接口
ID: 007
Status: TODO
Labels: api,users
Estimate: 2
Depends: 003,006
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 实现 Users Assignee 列表接口

## User Story

作为用户，我希望列出可分配的用户，以便将任务分配给其他人。

## Acceptance Criteria

### Scenario 1: 列出 assignee

Given 已认证用户
When 用户调用 GET /users/assignees
Then 返回可分配用户列表

### Scenario 2: 分页返回 assignee

Given assignee 数量超过页大小
When 用户请求第一页
Then 返回下一页的 cursor
