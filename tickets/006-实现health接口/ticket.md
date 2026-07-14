---
Title: 实现 Health 接口
ID: 006
Status: TODO
Labels: api,backend
Estimate: 1
Depends: 001
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 实现 Health 接口

## 用户故事

作为运维人员，我希望拥有一个健康检查端点，以便确认 API 是否正常运行。

## 范围

### 包含
- 实现 GET /health 端点
- 返回 API 健康状态与 200 响应
- 端点无需认证即可访问

### 不包含
- 依赖服务（如 DynamoDB、Cognito）的详细健康检查
- 性能指标、监控告警或日志聚合

## 验收标准

### 场景 1：Health 端点返回 OK

Given API 正在运行
When 我调用 GET /health
Then 返回 200 和健康状态

### 场景 2：Health 端点公开可访问

Given API 正在运行
When 我在未认证的情况下调用 GET /health
Then 仍然返回 200
