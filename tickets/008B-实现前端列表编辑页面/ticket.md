---
Title: 实现前端列表编辑页面
ID: 008B
Status: TODO
Labels: web,frontend,lists
Estimate: 2
Depends: 008A
PHASE: 1
CYCLE: 3
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现前端列表编辑页面

## 用户故事

作为用户，我希望修改自定义列表的名称、颜色和图标，以便让列表更符合我的分类习惯。

## 范围

### 包含
- 列表编辑入口（侧边栏右键菜单、列表设置按钮或详情页动作）
- 编辑表单：名称、颜色、图标
- 调用 PATCH `/api/lists/{id}` 并携带 `expectedVersion`
- 成功后刷新列表查询缓存
- 409 版本冲突时提示用户刷新并重试

### 不包含
- 列表手动排序拖拽（后续阶段）
- 列表删除与恢复（008C）
- 列表内任务的移动与编辑

## 验收标准

### 场景 1：编辑列表名称

Given 一个已存在的自定义列表
When 用户修改其名称并提交
Then 列表名称更新并同步到侧边栏

### 场景 2：编辑列表颜色与图标

Given 一个已存在的自定义列表
When 用户修改颜色或图标并提交
Then 列表视觉样式更新

### 场景 3：版本冲突

Given 列表 version 为 1
When 用户基于 version 1 提交编辑，同时另一端已将其更新到 version 2
Then 前端收到 409 并提示用户刷新后重试

### 场景 4：校验失败

Given 用户将名称清空或选择非法颜色
When 提交编辑
Then 前端阻止提交并显示校验错误

## 测试要求

- 使用 Vitest + React Testing Library 编写组件与 hooks 测试
- 覆盖编辑成功、字段校验、API 错误、409 冲突
- 使用 MSW 或 mock `apiClient` 隔离 API 依赖
- 覆盖率须达到 statements / branches / functions / lines 100%

## 关联设计

- `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md` 列表数据模型、前端 UI 结构
- `tickets/008A-实现前端列表创建与查询页面/ticket.md` 列表查询与创建基础
