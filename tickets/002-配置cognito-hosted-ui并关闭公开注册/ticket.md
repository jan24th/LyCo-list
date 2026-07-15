---
Title: 配置 Cognito Hosted UI 并关闭公开注册
ID: 002
Status: ARCHIVED
Labels: infra,auth
Estimate: 3
Depends: 001
PHASE: 1
CYCLE: 2
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
- 向 `apps/web` 暴露 `VITE_USER_POOL_ID`、`VITE_USER_POOL_CLIENT_ID` 与 `VITE_COGNITO_DOMAIN`
- 前端最小登录入口（登录按钮）与回调页，用于验证 token 可获取；token 刷新与 401 重定向由 ticket 005 负责

### 不包含

- 用户资料管理业务逻辑
- API 授权中间件与保护路由
- 业务 API 接口

## 重要实现说明

- SST v3.19.3 的 `sst.aws.CognitoUserPool` 组件未暴露 `domain` 参数，因此 Cognito User Pool Domain 通过 Pulumi AWS 原生资源 `aws.cognito.UserPoolDomain` 创建。
- `sst.aws.CognitoUserPoolClient` 未暴露 `logoutUrls`，通过 `transform.client` 传入。
- 为避免 `web` 与 `userPoolClient` 之间的循环依赖/前向引用，`callbackUrls` 直接基于 stage 与 `BASE_DOMAIN` 推导，不再依赖 `web.url`。
- 所有 stage 均使用 Cognito prefix 域名（`{app}-{stage}.auth.ap-southeast-1.amazoncognito.com`），前端 acc/prod 仍保留 `app.{stagePrefix}jan24th.today` 自定义域名。
- `.env.acc` / `.env.prod` 只需配置 `BASE_DOMAIN=jan24th.today`，不再需要 `ROUTE_53_ZONE_ID`。

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
Then 应用通过 Amplify 获取有效用户会话并识别当前用户
