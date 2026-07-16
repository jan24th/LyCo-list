---
Title: 实现前端列表创建与查询页面
ID: 008A
Status: TODO
Labels: web,frontend,lists
Estimate: 3
Depends: 004,005,008
PHASE: 1
CYCLE: 3
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现前端列表创建与查询页面

## 用户故事

作为用户，我希望在侧边栏中查看所有自定义列表并通过简单操作创建新列表，以便快速组织任务。

## 范围

### 包含
- 侧边栏展示自定义列表（GET `/api/lists`）
- 侧边栏展示固定智能列表（今天、计划、全部、已标记、已完成、分配给我）
- "新建列表"按钮与创建表单/弹窗
- 创建列表调用 POST `/api/lists`
- 创建成功后刷新列表查询缓存
- 列表项展示名称、颜色、图标

### 不包含
- 列表编辑、删除、恢复（分别在 008B、008C）
- 列表手动拖拽排序
- 列表详情页面内的任务 CRUD
- 列表分享与权限

## 验收标准

### 场景 1：展示自定义列表

Given 已认证用户
When 打开应用侧边栏
Then 可见所有未删除自定义列表及其名称、颜色、图标

### 场景 2：展示智能列表

Given 已认证用户
When 打开应用侧边栏
Then 可见固定的智能列表入口

### 场景 3：创建列表

Given 已认证用户
When 点击"新建列表"并提交有效名称、颜色、图标
Then 新列表被创建并立即出现在侧边栏

### 场景 4：创建失败提示

Given 已认证用户
When 创建列表时网络或校验失败
Then 前端显示错误提示，列表不被重复添加

## 测试要求

- 使用 Vitest + React Testing Library 编写组件与 hooks 测试
- 覆盖列表查询成功、空列表、加载中、错误状态
- 覆盖创建列表成功、校验失败、API 错误
- 使用 MSW 或 mock `apiClient` 隔离 API 依赖
- 覆盖率须达到 statements / branches / functions / lines 100%

## 关联设计

- `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md` 前端 UI 结构、智能列表定义
- `tickets/008-实现列表crud软删除和恢复/ticket.md` 后端 lists API 规范
