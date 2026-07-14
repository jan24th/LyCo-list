---
Title: 实现 Cognito 登录回调与 401 重定向处理
ID: 005
Status: TODO
Labels: web,auth
Estimate: 3
Depends: 002,004
PHASE: 1
CYCLE: 1
Source: 2026-07-13-lyco-list-design.md
---

# 实现 Cognito 登录回调与 401 重定向处理

## User Story

作为用户，我希望在 Cognito 登录后被正确重定向，并在 401 时被送回登录，以便认证流程顺畅无阻。

## Acceptance Criteria

### Scenario 1: 处理 OAuth 回调

Given 用户从 Cognito 返回并携带 code
When 回调处理程序处理该 code
Then token 被存储，用户被重定向到应用内

### Scenario 2: 401 时重定向到登录

Given 一个 API 调用返回 401
When 收到响应
Then 用户被重定向到 Cognito Hosted UI

### Scenario 3: 刷新过期的 Access Token

Given access token 已过期
When refresh token 可用
Then access token 被自动刷新
