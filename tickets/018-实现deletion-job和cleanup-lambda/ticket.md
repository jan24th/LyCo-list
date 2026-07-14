---
Title: 实现 DELETION_JOB 和 Cleanup Lambda
ID: 018
Status: TODO
Labels: api,cleanup
Estimate: 5
Depends: 003,008,009
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现 DELETION_JOB 和 Cleanup Lambda

## 用户故事

作为运维人员，我希望有一个定时清理任务来永久删除软删除项，以便自动回收存储空间。

## 范围

### 包含
- 实现 Cleanup Lambda 函数，扫描并清理 TTL 已过期的软删除项
- 清理任务的中断恢复机制，支持从上一次 cursor 继续执行
- 批量删除时处理 UnprocessedItems 并重试
- 使用 SST Cron 或 EventBridge 调度触发清理任务

### 不包含
- 手动删除接口或 UI 操作
- 未过期的项目清理
- 非 DynamoDB 存储的清理

## 验收标准

### 场景 1：清理软删除项

Given 项目已标记删除且 TTL 已过期
When Cleanup Lambda 运行
Then 这些项目被永久删除

### 场景 2：从 cursor 恢复

Given 清理任务被中断
When 它恢复运行
Then 从上一次的 cursor 继续

### 场景 3：重试未处理项

Given 批量删除返回 UnprocessedItems
When 清理运行
Then 重试未处理项
