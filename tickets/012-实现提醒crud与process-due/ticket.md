---
Title: 实现提醒 CRUD 与 process-due
ID: 012
Status: TODO
Labels: api,reminders
Estimate: 5
Depends: 009
PHASE: 1
CYCLE: 4
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现提醒 CRUD 与 process-due

## 用户故事

作为用户，我希望设置提醒并处理到期提醒，以便在正确的时间收到通知。

## 范围

### 包含
- 实现提醒的创建、读取、更新、删除（CRUD）接口
- 提醒存储到期时间（due time）和 IANA 时区
- 更新提醒时通过 `version` 进行条件检查
- 实现 process-due 任务，扫描到期提醒并创建对应通知

### 不包含
- 任务分配与分配通知
- 任务移动、完成、恢复等状态变更
- 通知的实际投递渠道

## 验收标准

### 场景 1：创建提醒

Given 一个已存在的任务
When 用户创建提醒
Then 提醒以到期时间和时区存储

### 场景 2：更新提醒

Given 一个已存在的提醒
When 用户更新它
Then 修改通过 version 检查后持久化

### 场景 3：处理到期提醒

Given 提醒已过期
When process-due 任务运行
Then 为这些提醒创建通知
