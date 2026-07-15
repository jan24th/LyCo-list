---
Title: 配置前后端自定义域名
ID: 001A
Status: Archived
Cycle: 1
Labels: infra,domain
Estimate: 3
Depends: 001
PHASE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 配置前后端自定义域名

## 用户故事

作为运维人员，我希望在 SST 中为 LyCo-list 的前端和后端分别配置自定义域名，以便用户通过固定域名访问应用和 API。

## 范围

### 包含
- 在 `sst.config.ts` 中引用已托管在 Amazon Route 53 的 `jan24th.today` 域名。
- 为 `sst.aws.StaticSite`（前端）配置自定义域名 `app.jan24th.today`。
- 为 `sst.aws.ApiGatewayV2`（API）配置自定义域名 `api.jan24th.today`。
- 配置后验证自定义域名可解析并返回预期响应。
- 同步更新 Bruno `production.bru` 的 `baseUrl`（若尚未更新为 `https://api.jan24th.today`）。

### 不包含
- Cognito Hosted UI 自定义域名 `auth.jan24th.today`（由 ticket 002 负责）。
- 新域名的购买或 Route 53 托管迁移（已完成，见设计文档）。
- CloudFront / API Gateway 之外的额外 CDN 或 WAF 配置。

## 验收标准

### 场景 1：前端自定义域名生效

Given ticket 001 的 SST 基础结构已部署
When 在 `sst.config.ts` 中为 `StaticSite` 配置 `domain: "app.jan24th.today"`
And 执行 `sst deploy --stage prod`
Then 前端可通过 `https://app.jan24th.today` 访问
And 浏览器证书有效（由 AWS Certificate Manager 自动签发/验证）

### 场景 2：API 自定义域名生效

Given ticket 001 的 SST 基础结构已部署
When 在 `sst.config.ts` 中为 `ApiGatewayV2` 配置 `domain: "api.jan24th.today"`
And 执行 `sst deploy --stage prod`
Then API 可通过 `https://api.jan24th.today/api/health` 访问并返回 `200 { ok: true }`

### 场景 3：Route 53 记录自动创建

Given 域名 `jan24th.today` 已托管在 Route 53
When SST 部署自定义域名资源
Then Route 53 中自动生成指向 CloudFront 分配的 `app.jan24th.today` 记录
And 自动生成指向 API Gateway 自定义域名的 `api.jan24th.today` 记录

### 场景 4：按 stage 区分自定义域名绑定

Given `sst.config.ts` 中按当前 stage 区分环境（SST v3 `run()` 内使用 `$app.stage`）
When `stage === "dev"` 时
Then 不绑定任何自定义域名，使用 SST 自动生成的 URL
When `stage === "prod"` 时
Then 绑定正式自定义域名 `app.jan24th.today` / `api.jan24th.today`
When `stage === "acc"` 时
Then 绑定验收环境自定义域名 `app.acc.jan24th.today` / `api.acc.jan24th.today`

### 场景 5：Bruno 生产环境 baseUrl 同步

Given Bruno 集合已存在 `production.bru`
When 检查 `baseUrl` 变量
Then 其值为 `https://api.jan24th.today`

## 后续工单

- Cognito User Pool / Hosted UI / 自定义域名 `auth.jan24th.today` → ticket 002
- 前端认证回调与 401 重定向处理 → ticket 005

## 计划实施备注

- 域名 `jan24th.today` 已购买并迁移到 Route 53；`www.jan24th.today` 已用于其他网站，本项目仅使用 `app` / `api` / `auth` 子域名。
- SST v3 的 `sst.aws.StaticSite` 与 `sst.aws.ApiGatewayV2` 均支持 `domain` 字段；若域名已在同一 AWS 账户的 Route 53 中托管，SST 通常可自动查找 hosted zone 并创建 ACM 证书与 DNS 记录。
- 若 SST 无法自动定位 hosted zone，可显式使用 `sst.aws.Route53` 引用 `jan24th.today` 的 hosted zone ID，再传入 `domain` 配置对象。
- 建议在 `sst.config.ts` 中根据 `$app.stage` 条件启用自定义域名：`prod` stage 绑定 `app.jan24th.today` / `api.jan24th.today`，`acc` stage 绑定 `app.acc.jan24th.today` / `api.acc.jan24th.today`，`dev` stage 使用 SST 自动生成的 URL，避免开发部署影响生产 DNS。
- 本 ticket 完成后，设计文档中“域名与证书”章节的 SST 实现部分应同步更新或引用本 ticket。
