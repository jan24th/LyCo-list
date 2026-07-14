---
Title: 实现任务与无级子任务 CRUD
ID: 009
Status: TODO
Labels: api,tasks
Estimate: 5
Depends: 008
PHASE: 1
CYCLE: 1
Source: 2026-07-13-lyco-list-design.md
---

# 实现任务与无级子任务 CRUD

## User Story

作为用户，我希望创建任务和嵌套子任务，以便将工作拆分到任意深度。

## Acceptance Criteria

### Scenario 1: 创建任务

Given 已认证用户
When 用户 POST 一个任务到列表
Then 任务被创建并带有 version

### Scenario 2: 创建嵌套子任务

Given 一个已存在的任务
When 用户 POST 一个带有 parentId 的子任务
Then 子任务被关联到父任务

### Scenario 3: 读取任务层级

Given 任务包含嵌套子任务
When 用户获取该任务
Then 返回任务层级结构
