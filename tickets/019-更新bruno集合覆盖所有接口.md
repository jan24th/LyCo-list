---
Title: 更新 Bruno 集合覆盖所有接口
ID: 019
Status: TODO
Labels: api,testing
Estimate: 3
Depends: 006,007,008,009,010,011,012,013,015,018
PHASE: 1
CYCLE: 1
Source: 2026-07-13-lyco-list-design.md
---

# 更新 Bruno 集合覆盖所有接口

## User Story

作为开发者，我希望拥有一个覆盖所有端点的 Bruno API 集合，以便手动测试和文档化 API。

## Acceptance Criteria

### Scenario 1: 覆盖所有端点

Given 打开 Bruno 集合
When 查看请求列表
Then 每个 API 端点至少有一个请求

### Scenario 2: 环境变量配置

Given Bruno 集合已配置
When 针对已部署环境运行请求
Then 变量如 base URL 和 token 被正确使用
