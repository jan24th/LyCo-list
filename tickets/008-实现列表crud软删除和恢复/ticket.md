---
Title: 实现列表 CRUD、软删除和恢复
ID: 008
Status: TODO
Labels: api,lists
Estimate: 5
Depends: 003,006
PHASE: 1
CYCLE: 3
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现列表 CRUD、软删除和恢复

## 用户故事

作为用户，我希望创建、读取、更新、删除和恢复列表，以便组织我的任务。

## 范围

### 包含
- 实现列表的创建、读取、更新、删除与恢复 API
- 软删除机制：标记删除并保留数据
- 基于 expectedVersion 的乐观锁与 409 冲突处理

### 不包含
- 列表内任务的增删改查
- 列表的硬删除与数据清理
- 列表分享、权限与协作功能

## 验收标准

### 场景 1：创建列表

Given 已认证用户
When 用户 POST 一个新列表
Then 列表被创建并带有 version

### 场景 2：软删除列表

Given 一个已存在的列表
When 用户删除它
Then 列表被标记为已删除但仍保留在数据库中

### 场景 3：恢复已删除的列表

Given 一个软删除的列表
When 用户恢复它
Then 列表重新变为活跃状态

### 场景 4：旧版本冲突

Given 列表 version 为 1
When 同时发送两个 expectedVersion 为 1 的更新
Then 一个成功，另一个返回 409
