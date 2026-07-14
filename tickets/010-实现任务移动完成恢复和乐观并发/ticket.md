---
Title: 实现任务移动、完成、恢复和乐观并发
ID: 010
Status: TODO
Labels: api,tasks
Estimate: 5
Depends: 009
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现任务移动、完成、恢复和乐观并发

## 用户故事

作为用户，我希望移动、完成和恢复任务，并检测冲突，以便跨设备安全地修改任务。

## 范围

### 包含
- 实现任务在列表之间的移动
- 实现任务完成状态切换并记录完成时间戳
- 实现已完成任务恢复为活跃状态
- 实现基于 `expectedVersion` 的乐观并发控制

### 不包含
- 任务与子任务的基础 CRUD
- 任务分配与通知创建
- 提醒 CRUD 与到期处理

## 验收标准

### 场景 1：移动任务到另一个列表

Given 列表 A 中有一个任务
When 用户将其移动到列表 B
Then 任务属于列表 B

### 场景 2：完成任务

Given 一个活跃的任务
When 用户将其标记为完成
Then 任务被完成并记录时间戳

### 场景 3：恢复已完成的任务

Given 一个已完成的任务
When 用户恢复它
Then 任务重新变为活跃状态

### 场景 4：乐观并发冲突

Given 任务 version 为 2
When 发送 expectedVersion 为 1 的更新
Then API 返回 409
