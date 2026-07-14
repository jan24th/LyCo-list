---
Title: 实现 Users Assignee 列表接口
ID: 007
Status: TODO
Labels: api,users
Estimate: 2
Depends: 003,006
PHASE: 1
CYCLE: 2
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现 Users Assignee 列表接口

## 用户故事

作为用户，我希望列出可分配的用户，以便将任务分配给其他人。

## 范围

### 包含
- 实现 GET /users/assignees 接口
- 返回当前用户可分配的用户列表
- 支持分页并返回下一页 cursor

### 不包含
- 任务分配的业务逻辑与数据写入
- 用户资料的创建、更新与删除
- 按名称、角色等条件过滤或搜索

## 验收标准

### 场景 1：列出 assignee

Given 已认证用户
When 用户调用 GET /users/assignees
Then 返回可分配用户列表

### 场景 2：分页返回 assignee

Given assignee 数量超过页大小
When 用户请求第一页
Then 返回下一页的 cursor
