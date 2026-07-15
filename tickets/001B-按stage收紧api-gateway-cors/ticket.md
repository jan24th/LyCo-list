---
Title: 按 stage 收紧 API Gateway CORS
ID: 001B
Status: Archived
Labels: infra,cors
Estimate: 1
Depends: 001,001A
PHASE: 1
CYCLE: 1
Source: .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
---

# 按 stage 收紧 API Gateway CORS

## 用户故事

作为运维人员，我希望 API Gateway 的 CORS 配置按 stage 收紧，以便生产环境和验收环境只接受来自对应前端域名的跨域请求。

## 范围

### 包含

- 在 `sst.config.ts` 中按 `dev` / `acc` / `prod` stage 配置 `sst.aws.ApiGatewayV2` 的 `cors.allowOrigins`。
- `dev` stage 允许所有 origin，便于本地开发。
- `acc` stage 只允许 `https://app.acc.jan24th.today`。
- `prod` stage 只允许 `https://app.jan24th.today`。
- 同步更新 design 文档 CORS 章节，保持设计权威来源一致。

### 不包含

- 添加 WAF 或更复杂的来源校验逻辑。
- 修改前端代码或 API 路由逻辑。
- 自定义 Cognito Hosted UI 的 CORS 配置。

## 验收标准

### 场景 1：dev stage 允许所有 origin

Given `sst.config.ts` 已按 stage 配置 CORS
When 使用 `sst diff --stage dev` 或部署 `dev` stage
Then `ApiGatewayV2` 的 `cors.allowOrigins` 包含 `"*"`

### 场景 2：acc stage 只允许验收前端域名

Given `sst.config.ts` 已按 stage 配置 CORS
When 使用 `sst diff --stage acc` 或部署 `acc` stage
Then `ApiGatewayV2` 的 `cors.allowOrigins` 仅包含 `https://app.acc.jan24th.today`
And 不包含 `"*"`

### 场景 3：prod stage 只允许生产前端域名

Given `sst.config.ts` 已按 stage 配置 CORS
When 使用 `sst diff --stage prod` 或部署 `prod` stage
Then `ApiGatewayV2` 的 `cors.allowOrigins` 仅包含 `https://app.jan24th.today`
And 不包含 `"*"`

### 场景 4：类型检查与代码规范通过

Given 修改后的 `sst.config.ts`
When 运行 `bun run typecheck`
Then 无类型错误
When 运行 `bunx @biomejs/biome check sst.config.ts`
Then 无格式化或检查错误

## 后续工单

- 前端 API 客户端错误处理与 401 重定向 → ticket 005
- Cognito Hosted UI 自定义域名 `auth.jan24th.today` → ticket 002

## 计划实施备注

- 当前 `sst.config.ts` 中 `ApiGatewayV2` 的 CORS 配置硬编码为 `allowOrigins: ["*"]`，需要替换为按 `$app.stage` 条件判断。
- stage 与对应前端域名的映射关系：
  - `dev` → `"*"`
  - `acc` → `"https://app.acc.jan24th.today"`
  - `prod` → `"https://app.jan24th.today"`
  - 其他未列出的 stage 默认回退到 `dev` 配置（`"*"`），便于本地和临时环境。
- 如果后续增加更多 stage（如 `staging`），需要同步扩展映射表。
- 本 ticket 完成后，design 文档中“CORS”章节应与此实现保持一致。
