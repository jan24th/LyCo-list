---
Title: 任务增删改查
Status: TODO
Labels: frontend, features
Estimate: 5
PHASE: 1
CYCLE: 1
---

# 任务增删改查

## User Story

As a 用户，I want 创建、编辑和删除任务，So that 我可以高效地管理待办事项。

## Acceptance Criteria

### Scenario 1: 创建任务

Given 用户处于任意列表视图
When 他们输入任务标题并确认
Then 新任务出现在所选列表中

### Scenario 2: 编辑任务标题

Given 任务存在
When 用户编辑标题并保存
Then 更新的标题被持久化并反映在列表中

### Scenario 3: 添加任务备注

Given 任务存在
When 用户添加或编辑备注
Then 备注被保存并在任务详情中可见

### Scenario 4: 标记任务完成

Given 任务未完成
When 用户切换完成状态
Then 任务被标记为完成并移动到已完成智能列表

### Scenario 5: 标记任务未完成

Given 任务已完成
When 用户切换完成状态
Then 任务返回原列表并且智能列表相应更新

### Scenario 6: 删除任务

Given 任务存在
When 用户删除它
Then 任务立即被移除并短暂显示撤销选项

### Scenario 7: 设置任务优先级和旗标

Given 任务存在
When 用户设置优先级为低、中、高，或切换旗标
Then 任务显示对应的优先级和旗标指示器
