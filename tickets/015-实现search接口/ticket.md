---
Title: 实现 Search 接口
ID: 015
Status: TODO
Labels: api,search
Estimate: 5
Depends: 008,009
PHASE: 1
CYCLE: 5
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现 Search 接口

## 用户故事

作为用户，我希望拥有一个后端搜索端点，以便搜索页面能够查找任务和列表。

## 范围

### 包含
- 实现 `GET /api/search` 接口
- 对任务标题和备注做 Unicode 规范化与大小写不敏感包含匹配
- 返回分页结果与不透明 cursor

### 不包含
- 前端搜索页面（由 ticket 014 负责）
- 分词、相关度排名或全文检索服务

## 验收标准

### 场景 1：搜索任务

Given 调用搜索 API 并传入查询词
When 查询词匹配任务标题
Then 返回匹配的任务

### 场景 2：搜索列表

Given 调用搜索 API 并传入查询词
When 查询词匹配列表标题
Then 返回匹配的列表

### 场景 3：分页搜索结果

Given 搜索结果超过页大小
When 请求第一页
Then 返回下一页的 cursor
