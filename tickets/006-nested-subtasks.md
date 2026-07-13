---
Title: 无级嵌套子任务
Status: TODO
Labels: frontend, features
Estimate: 5
PHASE: 1
CYCLE: 1
---

# 无级嵌套子任务

## User Story

As a 用户，I want 在任何任务下创建无限层级的子任务，So that 我可以把工作拆分成更小的部分，同时每个层级都拥有相同的任务功能。

## Acceptance Criteria

### Scenario 1: 创建子任务

Given 任务存在
When 用户在其下添加子任务
Then 子任务显示在父任务下方

### Scenario 2: 子任务拥有完整任务功能

Given 子任务存在
When 用户查看其详情
Then 子任务支持标题、备注、优先级、旗标、截止日期和提醒，与父任务相同

### Scenario 3: 删除带子任务的父任务

Given 父任务拥有子任务
When 用户尝试删除父任务
Then 应用阻止删除并显示警告，要求先移除或移动子任务

### Scenario 4: 移动父任务到另一个列表

Given 父任务拥有子任务
When 用户将父任务移动到另一个列表
Then 所有后代子任务自动移动到同一列表

### Scenario 5: 级联完成提示

Given 父任务拥有子任务
When 用户标记父任务完成
Then 应用提示是否同时完成所有子任务

### Scenario 6: 独立完成子任务

Given 子任务未完成
When 用户切换其完成状态
Then 子任务被标记完成，不影响父任务状态

### Scenario 7: 在任务详情中展示嵌套结构

Given 任务拥有多层子任务
When 用户打开任务详情
Then 层级结构清晰渲染，每个层级可展开
