---
Title: 实现 Assign 事务与幂等分配通知
ID: 011
Status: TODO
Labels: api,tasks,notifications
Estimate: 5
Depends: 007,009
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现 Assign 事务与幂等分配通知

## 用户故事

作为用户，我希望将任务分配给其他人并生成确定性通知，以便分配可靠且不会重复。

## 范围

### 包含
- 实现任务 assignee 的更新
- 使用事务保证任务分配更新与通知创建的原子性
- 基于确定性规则生成通知 ID，保证重试幂等
- 事务失败时回滚，不创建通知

### 不包含
- 任务与提醒的基础 CRUD
- 任务移动、完成、恢复
- 通知的实际投递渠道（如推送、邮件）

## 验收标准

### 场景 1：将任务分配给用户

Given 一个已存在的任务
When 用户将任务分配给另一个用户
Then 任务 assignee 被更新

### 场景 2：确定性通知 ID

Given 分配操作被重试
When 事务再次执行
Then 通知 ID 是确定性的，不会创建重复通知

### 场景 3：失败时回滚事务

Given 分配更新失败
When 事务执行
Then 不会创建通知
