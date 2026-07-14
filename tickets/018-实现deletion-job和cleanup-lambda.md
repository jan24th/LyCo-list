---
Title: 实现 DELETION_JOB 和 Cleanup Lambda
ID: 018
Status: TODO
Labels: api,cleanup
Estimate: 5
Depends: 003,008,009
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 实现 DELETION_JOB 和 Cleanup Lambda

## User Story

作为运维人员，我希望有一个定时清理任务来永久删除软删除项，以便自动回收存储空间。

## Acceptance Criteria

### Scenario 1: 清理软删除项

Given 项目已标记删除且 TTL 已过期
When Cleanup Lambda 运行
Then 这些项目被永久删除

### Scenario 2: 从 cursor 恢复

Given 清理任务被中断
When 它恢复运行
Then 从上一次的 cursor 继续

### Scenario 3: 重试未处理项

Given 批量删除返回 UnprocessedItems
When 清理运行
Then 重试未处理项
