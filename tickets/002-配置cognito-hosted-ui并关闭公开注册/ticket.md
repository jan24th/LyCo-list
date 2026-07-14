---
Title: 配置 Cognito Hosted UI 并关闭公开注册
ID: 002
Status: TODO
Labels: infra,auth
Estimate: 3
Depends: 001
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 配置 Cognito Hosted UI 并关闭公开注册

## 用户故事

作为用户，我希望通过 Cognito Hosted UI 登录，以便在不开放公开注册的情况下完成身份认证。

## 范围

### 包含
- Cognito User Pool 与 User Pool Client 配置
- Hosted UI 登录/回调流程
- 关闭公开注册，仅允许管理员邀请或预创建用户
- 向 `apps/web` 暴露 `VITE_USER_POOL_ID` 与 `VITE_USER_POOL_CLIENT_ID`

### 不包含
- 用户资料管理业务逻辑
- API 授权中间件与保护路由
- 业务 API 接口

## 验收标准

### 场景 1：重定向到 Cognito Hosted UI

Given 用户访问应用
When 用户点击登录
Then 用户被重定向到 Cognito Hosted UI

### 场景 2：公开注册已关闭

Given 用户在 Cognito Hosted UI 上
When 用户尝试自行注册
Then 注册功能被关闭或需要管理员邀请

### 场景 3：成功认证回调

Given 用户成功完成认证
When Cognito 重定向回应用
Then 应用接收到有效的 token
