---
Title: 实现前端列表删除与恢复页面
ID: 008C
Status: TODO
Labels: web,frontend,lists
Estimate: 2
Depends: 008A
PHASE: 1
CYCLE: 3
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现前端列表删除与恢复页面

## 用户故事

作为用户，我希望删除不再需要的列表并能在误删后快速撤销，以便保持列表整洁并避免数据丢失。

## 范围

### 包含
- 列表删除入口（列表设置菜单中的删除按钮）
- 删除二次确认弹窗
- 调用 DELETE `/api/lists/{id}` 并携带 `expectedVersion`
- 删除成功后立即从侧边栏隐藏该列表
- 删除成功后显示撤销提示，允许在撤销期限内恢复
- 调用 POST `/api/lists/{id}/restore` 并携带 `expectedVersion` 恢复列表
- 超过撤销期限返回 410 时提示用户已无法恢复

### 不包含
- 硬删除与 cleanup Lambda 触发逻辑（后端 018）
- 列表级联删除任务的确认（由后端在清理阶段处理）
- 批量删除

## 验收标准

### 场景 1：删除列表需要二次确认

Given 一个已存在的自定义列表
When 用户点击删除
Then 先弹出二次确认弹窗，确认后才发送删除请求

### 场景 2：删除后隐藏列表

Given 用户确认删除列表
When 删除请求成功
Then 该列表立即从侧边栏消失，其任务也不再显示

### 场景 3：撤销恢复列表

Given 列表刚被删除且仍在撤销期限内
When 用户点击撤销
Then 列表恢复为活跃状态并重新出现在侧边栏

### 场景 4：撤销期限过期

Given 列表删除已超过撤销期限
When 用户尝试恢复
Then 前端收到 410 并提示用户列表已永久删除

### 场景 5：版本冲突

Given 列表 version 在删除前已被其他端更新
When 用户提交删除
Then 前端收到 409 并提示用户刷新后重试

## 测试要求

- 使用 Vitest + React Testing Library 编写组件与 hooks 测试
- 覆盖删除确认、删除成功、删除隐藏、撤销成功、410 过期、409 冲突
- 使用 MSW 或 mock `apiClient` 隔离 API 依赖
- 覆盖率须达到 statements / branches / functions / lines 100%

## 关联设计

- `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md` 软删除/恢复、前端 UI 结构
- `tickets/008-实现列表crud软删除和恢复/ticket.md` 后端删除/恢复 API 规范
- `tickets/008A-实现前端列表创建与查询页面/ticket.md` 列表查询与侧边栏基础
