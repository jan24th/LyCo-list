---
Title: 前端列表与任务 CRUD
Status: TODO
Labels: frontend, features
Estimate: 8
PHASE: 1
CYCLE: 4
Depends: 003-前端脚手架, 006-REST-API列表接口, 007-REST-API任务与子任务接口
---

# 前端列表与任务 CRUD

## User Story

As a 用户，I want 在浏览器中管理列表和任务，So that 我可以方便地添加、编辑、完成和删除待办事项。

## Acceptance Criteria

### Scenario 1: 展示自定义列表

Given 后端返回列表数据
When 用户打开侧边栏
Then 显示所有自定义列表和智能列表

### Scenario 2: 创建列表

Given 用户点击新建列表
When 输入名称并提交
Then 列表被创建并出现在侧边栏

### Scenario 3: 创建任务

Given 用户处于列表视图
When 输入任务标题并提交
Then 任务出现在列表中

### Scenario 4: 编辑任务

Given 任务存在
When 用户修改标题或备注并保存
Then 任务更新并持久化到后端

### Scenario 5: 切换任务完成状态

Given 任务未完成
When 用户点击完成按钮
Then 任务标记为完成，并出现在"已完成"智能列表中

### Scenario 6: 删除任务并撤销

Given 任务存在
When 用户删除任务
Then 任务被移除，并短暂显示撤销按钮

### Scenario 7: 移动任务到列表

Given 任务存在
When 用户选择新列表
Then 任务移动到新列表，子任务跟随移动

### Scenario 8: 创建子任务

Given 任务存在
When 用户在该任务下添加子任务
Then 子任务显示在父任务详情中

### Scenario 9: TDD 开发与 100% 覆盖率

Given 项目要求 TDD
When 为前端 CRUD 组件和 hooks 编写测试
Then 测试先失败，实现后通过，覆盖率达到 100%

## References

- [TanStack Query Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW](https://mswjs.io/)
