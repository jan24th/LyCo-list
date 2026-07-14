---
Title: 实现任务与无级子任务 CRUD
ID: 009
Status: TODO
Labels: api,tasks
Estimate: 5
Depends: 008
PHASE: 1
CYCLE: 3
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现任务与无级子任务 CRUD

## 用户故事

作为用户，我希望创建任务和嵌套子任务，以便将工作拆分到任意深度。

## 范围

### 包含
- 实现任务的创建、读取、更新、删除（CRUD）接口
- 支持通过 `parentId` 创建嵌套子任务，表达无级层级关系
- 读取任务时返回层级结构
- 任务创建时初始化 `version` 字段

### 不包含
- 任务移动、完成、恢复等状态变更
- 乐观并发控制逻辑
- 提醒（reminder）与分配（assign）相关功能
- 通知创建与投递

## 验收标准

### 场景 1：创建任务

Given 已认证用户
When 用户 POST 一个任务到列表
Then 任务被创建并带有 version

### 场景 2：创建嵌套子任务

Given 一个已存在的任务
When 用户 POST 一个带有 parentId 的子任务
Then 子任务被关联到父任务

### 场景 3：读取任务层级

Given 任务包含嵌套子任务
When 用户获取该任务
Then 返回任务层级结构
