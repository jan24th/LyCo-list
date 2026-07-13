---
Title: IndexedDB 数据模型与数据访问层
Status: TODO
Labels: frontend, data-layer
Estimate: 8
PHASE: 1
CYCLE: 2
---

# IndexedDB 数据模型与数据访问层

## User Story

As a 用户，I want 我的任务和列表保存在本地，So that 数据在浏览器会话之间持久化并且应用可以离线工作。

## Acceptance Criteria

### Scenario 1: 定义 Dexie.js 数据模型

Given 应用首次启动
When Dexie.js 初始化 IndexedDB 数据库
Then 存在 `lists` 和 `tasks` 表并带有正确的索引

### Scenario 2: 存储列表和任务

Given 用户创建列表或任务
When mutation 完成
Then 记录被写入 IndexedDB 并在页面刷新后仍然存在

### Scenario 3: 查询任务和列表

Given IndexedDB 中存在任务和列表
When 应用查询某个列表或任务
Then 返回符合预期结构的结果

### Scenario 4: 处理嵌套任务

Given 一个任务通过 `parentId` 拥有子任务
When 查询父任务
Then 可以高效地获取相关子任务

### Scenario 5: 与 TanStack Query 集成

Given 存在数据访问函数
When 它被包装为 TanStack Query 的 `queryFn`
Then 组件可以从缓存读取数据，mutation 可以使过期数据失效
