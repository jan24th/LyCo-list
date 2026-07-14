---
Title: 实现 Search 接口
ID: 015
Status: TODO
Labels: api,search
Estimate: 5
Depends: 008,009
PHASE: 1
CYCLE: 1
Source: .github/PROJECT_WORKFLOW.md
---

# 实现 Search 接口

## User Story

作为用户，我希望拥有一个后端搜索端点，以便搜索页面能够查找任务和列表。

## Acceptance Criteria

### Scenario 1: 搜索任务

Given 调用搜索 API 并传入查询词
When 查询词匹配任务标题
Then 返回匹配的任务

### Scenario 2: 搜索列表

Given 调用搜索 API 并传入查询词
When 查询词匹配列表标题
Then 返回匹配的列表

### Scenario 3: 分页搜索结果

Given 搜索结果超过页大小
When 请求第一页
Then 返回下一页的 cursor
