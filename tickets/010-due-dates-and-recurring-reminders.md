---
Title: 截止日期与重复提醒
Status: TODO
Labels: frontend, features, scheduling
Estimate: 8
PHASE: 1
CYCLE: 1
---

# 截止日期与重复提醒

## User Story

As a 用户，I want 为任务设置截止日期和重复提醒，So that 我可以跟踪截止期限和重复习惯。

## Acceptance Criteria

### Scenario 1: 设置截止日期

Given 任务存在
When 用户选择截止日期
Then 任务以 UTC 存储该日期并以本地时区显示

### Scenario 2: 设置截止时间

Given 任务有截止日期
When 用户选择截止时间
Then 可以为该具体日期和时间安排提醒

### Scenario 3: 重复频率

Given 任务存在
When 用户将提醒设置为每天、每周、每两周、每月、每年或工作日重复
Then 重复规则被存储并正确计算下一次出现时间

### Scenario 4: 重复任务完成后推进

Given 任务拥有重复提醒
When 用户标记任务完成
Then 任务保持活跃状态，截止日期和提醒推进到下一次计划出现时间

### Scenario 5: 一次性提醒完成后禁用

Given 任务有一次性提醒
When 提醒触发且用户完成任务
Then 提醒被禁用，不再触发

### Scenario 6: 在今天就绪和计划列表中显示到期任务

Given 任务有截止日期
When 用户打开今天就绪或计划列表
Then 如果任务符合列表过滤条件则显示

### Scenario 7: 一致地存储时区

Given 用户在本地时区选择日期
When 任务保存
Then 日期被转换为 UTC 并可以跨时区可靠比较
