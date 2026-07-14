---
Title: 实现 Health 接口
ID: 006
Status: TODO
Labels: api,backend
Estimate: 1
Depends: 001
PHASE: 1
CYCLE: 1
Source: 2026-07-13-lyco-list-design.md
---

# 实现 Health 接口

## User Story

作为运维人员，我希望拥有一个健康检查端点，以便确认 API 是否正常运行。

## Acceptance Criteria

### Scenario 1: Health 端点返回 OK

Given API 正在运行
When 我调用 GET /health
Then 返回 200 和健康状态

### Scenario 2: Health 端点公开可访问

Given API 正在运行
When 我在未认证的情况下调用 GET /health
Then 仍然返回 200
