# [配置前后端自定义域名] Implementation Plan

> Ticket: `tickets/001A-配置前后端自定义域名/ticket.md`
> Plan: `tickets/001A-配置前后端自定义域名/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SST v3 中为 LyCo-list 前端 (`app.jan24th.today`) 与 API (`api.jan24th.today`) 仅在 `prod` stage 绑定自定义域名，并同步 Bruno 生产环境 baseUrl，最终通过部署验证域名可访问。

**Architecture:** 在根 `sst.config.ts` 中根据全局 `$app.stage` 条件为 `sst.aws.ApiGatewayV2` 与 `sst.aws.StaticSite` 注入 `domain` 属性；`dev` stage 保持 SST 自动生成 URL，`prod` stage 使用 Route 53 托管的 `jan24th.today` 子域名，由 SST 自动申请/验证 ACM 证书并创建 DNS 记录。Bruno `prod.bru` 的 `baseUrl` 同步改为 `https://api.jan24th.today`，用于部署后手动验证。

## Global Constraints

- SST v3 (`^3.7.0`, 当前锁定 `3.19.3`)
- AWS Region: `ap-southeast-1`
- 域名 `jan24th.today` 已托管在同一 AWS 账户的 Route 53 中
- 仅在 `stage === "prod"` 时绑定正式自定义域名
- `dev` stage 不覆盖生产 DNS，避免冲突
- 代码规范：`bunx @biomejs/biome check`
- 类型检查：`bun run typecheck`（`tsc --build --noEmit`）
- Bruno 生产环境 `baseUrl` 必须为 `https://api.jan24th.today`

**Tech Stack:** TypeScript, SST v3, AWS (Route 53, ACM, API Gateway V2, CloudFront), Bruno

---

### Task 1: 按 stage 为 API 与前端配置自定义域名

> Covers: Scenario 1（前端自定义域名生效）, Scenario 2（API 自定义域名生效）, Scenario 4（本地开发与生产配置区分）

**Files:**
- Modify: `sst.config.ts`

**Interfaces:**
- Consumes: global `$app.stage` inside `run()`; existing `api` (`sst.aws.ApiGatewayV2`) and `web` (`sst.aws.StaticSite`) component declarations
- Produces: `api.url` / `web.url` outputs remain available; custom domain URLs are surfaced through component properties (`api.url` becomes custom domain URL when `domain` is set)

- [ ] **Step 1: 打开 `sst.config.ts` 并查看现有结构**

Run:
```bash
cat sst.config.ts
```

Expected: File contains `sst.aws.ApiGatewayV2("Api", { ... })` and `sst.aws.StaticSite("Web", { ... })` without `domain` props.

- [ ] **Step 2: 在 `run()` 顶部定义条件域名变量**

Add immediately inside `async run() {`:

```typescript
const baseDomain = process.env.BASE_DOMAIN;
const isCustomDomainStage = $app.stage === "prod" || $app.stage === "acc";
const stagePrefix = $app.stage === "prod" ? "" : `${$app.stage}.`;
const domain = {
  api:
    isCustomDomainStage && baseDomain
      ? `api.${stagePrefix}${baseDomain}`
      : undefined,
  web:
    isCustomDomainStage && baseDomain
      ? `app.${stagePrefix}${baseDomain}`
      : undefined,
};
```

> SST v3 exposes the current stage through the global `$app.stage` variable inside `run()`. Do not use `input.stage` here; `input` is only available in the `app(input)` callback.
>
> The base domain is read from a single environment variable so the same config can be used across stages without hardcoding the apex domain. Create `.env`, `.env.prod`, or `.env.acc` from `.env.example` and set `BASE_DOMAIN` before deploying. API/web use `api.<BASE_DOMAIN>` / `app.<BASE_DOMAIN>` in prod and `api.acc.<BASE_DOMAIN>` / `app.acc.<BASE_DOMAIN>` in acc. Dev stage binds no custom domain.

- [ ] **Step 3: 为 `ApiGatewayV2` 添加 `domain` 配置**

Change the existing `api` declaration from:

```typescript
const api = new sst.aws.ApiGatewayV2("Api", {
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["*"],
    allowHeaders: ["content-type", "authorization"],
  },
});
```

To:

```typescript
const api = new sst.aws.ApiGatewayV2("Api", {
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["*"],
    allowHeaders: ["content-type", "authorization"],
  },
  domain: domain.api,
});
```

- [ ] **Step 4: 为 `StaticSite` 添加 `domain` 配置**

Change the existing `web` declaration from:

```typescript
const web = new sst.aws.StaticSite("Web", {
  path: "apps/web",
  build: {
    command: "bun run build",
    output: "dist",
  },
  environment: {
    VITE_API_URL: api.url,
    VITE_USER_POOL_ID: userPoolId.value,
    VITE_USER_POOL_CLIENT_ID: userPoolClientId.value,
  },
});
```

To:

```typescript
const web = new sst.aws.StaticSite("Web", {
  path: "apps/web",
  build: {
    command: "bun run build",
    output: "dist",
  },
  domain: domain.web,
  environment: {
    VITE_API_URL: api.url,
    VITE_USER_POOL_ID: userPoolId.value,
    VITE_USER_POOL_CLIENT_ID: userPoolClientId.value,
  },
});
```

- [ ] **Step 5: 运行类型检查**

Run:
```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 6: 运行 Biome 检查**

Run:
```bash
bunx @biomejs/biome check sst.config.ts
```

Expected: No errors.

- [ ] **Step 7: 提交 sst.config.ts 变更**

Run:
```bash
git add sst.config.ts
git commit -m "feat(infra): configure custom domains for prod stage"
```

---

### Task 2: 同步 Bruno 生产环境 baseUrl

> Covers: Scenario 5（Bruno 生产环境 baseUrl 同步）

**Files:**
- Modify: `bruno/lyco-list/environments/prod.bru`

**Interfaces:**
- Consumes: Existing `prod.bru` with `baseUrl: https://api.example.com`
- Produces: `prod.bru` with `baseUrl: https://api.jan24th.today`

- [ ] **Step 1: 读取当前 `prod.bru`**

Run:
```bash
cat bruno/lyco-list/environments/prod.bru
```

Expected:
```
vars {
  baseUrl: https://api.example.com
  accessToken: 
}
```

- [ ] **Step 2: 修改 `baseUrl` 为 `https://api.jan24th.today`**

Replace file contents with:

```
vars {
  baseUrl: https://api.jan24th.today
  accessToken: 
}
```

- [ ] **Step 3: 验证 Bruno 语法**

Run:
```bash
cat bruno/lyco-list/environments/prod.bru
```

Expected output exactly:
```
vars {
  baseUrl: https://api.jan24th.today
  accessToken: 
}
```

- [ ] **Step 4: 提交 Bruno 变更**

Run:
```bash
git add bruno/lyco-list/environments/prod.bru
git commit -m "chore(bruno): update prod baseUrl to api.jan24th.today"
```

---

### Task 3: 部署 prod 并验证自定义域名

> Covers: Scenario 1, Scenario 2, Scenario 3（Route 53 记录自动创建）

**Files:**
- Uses: `sst.config.ts`
- Uses: `bruno/lyco-list/health/get health.bru` and `bruno/lyco-list/environments/prod.bru`

**Interfaces:**
- Consumes: `sst deploy --stage prod`; AWS credentials via `AWS_PROFILE`; Route 53 hosted zone for `jan24th.today`
- Produces: Verified reachable endpoints `https://app.jan24th.today` and `https://api.jan24th.today/api/health`

- [ ] **Step 1: 确认 AWS 凭证与 stage 可用**

Run:
```bash
echo $AWS_PROFILE
```

Expected: Non-empty value configured with access to the target AWS account.

- [ ] **Step 2: 部署 prod stage**

Run:
```bash
bunx sst deploy --stage prod
```

Expected: Command exits successfully with output similar to:
```
✓  Complete
   Api: https://api.jan24th.today
   Web: https://app.jan24th.today
```

> Note: First deployment with custom domains may take several minutes while ACM validates the certificate and Route 53 propagates.

- [ ] **Step 3: 等待 DNS / ACM 传播（约 1-5 分钟）**

Run:
```bash
nslookup api.jan24th.today
nslookup app.jan24th.today
```

Expected: Both resolve to AWS endpoints (API Gateway / CloudFront).

- [ ] **Step 4: 使用 curl 验证 API 自定义域名**

Run:
```bash
curl -sS -o /dev/null -w "%{http_code}" https://api.jan24th.today/api/health
```

Expected: `200`

Run:
```bash
curl -sS https://api.jan24th.today/api/health
```

Expected JSON body:
```json
{"ok":true}
```

- [ ] **Step 5: 使用 curl 验证前端自定义域名**

Run:
```bash
curl -sS -o /dev/null -w "%{http_code}" https://app.jan24th.today
```

Expected: `200`

Run:
```bash
curl -sS -I https://app.jan24th.today | grep -i "content-type"
```

Expected: `content-type: text/html` (or similar HTML content type).

- [ ] **Step 6: 使用 Bruno 验证 production 环境**

Open Bruno, select the `lyco-list` collection, switch environment to `production`, and execute the `get health` request.

Expected:
- URL resolves to `https://api.jan24th.today/api/health`
- Response status: `200 OK`
- Response body: `{"ok":true}`

- [ ] **Step 7: 验证 Route 53 记录已自动创建**

Run:
```bash
aws route53 list-resource-record-sets --hosted-zone-id <HOSTED_ZONE_ID> --output table
```

Expected: Record sets for `api.jan24th.today` and `app.jan24th.today` exist.

> Replace `<HOSTED_ZONE_ID>` with the actual hosted zone ID for `jan24th.today`. If unknown, retrieve it with:
> ```bash
> aws route53 list-hosted-zones-by-name --dns-name jan24th.today --max-items 1
> ```

- [ ] **Step 8: 在 `sst.config.ts` 中确认 dev stage 不绑定自定义域名**

Run a dry diff preview:
```bash
bunx sst diff --stage dev
```

Expected: No `api.jan24th.today` or `app.jan24th.today` resources are created/updated for the `dev` stage; `Api` and `Web` use SST-generated auto URLs.

- [ ] **Step 9: 提交验证结果或部署状态说明（可选）**

If deployment succeeded and verification passed, no additional code change is required.

If any verification failed, do not commit further infra changes until the failure is resolved and re-verified.

---

## Verification Checklist

- [ ] `bun run typecheck` passes
- [ ] `bunx @biomejs/biome check sst.config.ts` passes
- [ ] `sst deploy --stage prod` completes successfully
- [ ] `https://api.jan24th.today/api/health` returns `200 { "ok": true }`
- [ ] `https://app.jan24th.today` returns `200` with HTML content
- [ ] Route 53 contains `api.jan24th.today` and `app.jan24th.today` records
- [ ] `dev` stage does not create production custom-domain resources
- [ ] Bruno production environment uses `baseUrl: https://api.jan24th.today`

---

## Rollback Notes

If custom domain deployment causes issues in prod:

1. Revert `sst.config.ts` to remove `domain: domain.api` and `domain: domain.web`.
2. Run `bunx sst deploy --stage prod` to remove custom domain resources.
3. Revert `bruno/lyco-list/environments/prod.bru` to the previous `baseUrl` value.

---

## Open Questions / Assumptions

1. Domain `jan24th.today` and its hosted zone exist in the same AWS account and region where `sst deploy --stage prod` runs.
2. The AWS profile used by `sst deploy` has permissions to create/modify Route 53 records and ACM certificates.
3. Ticket 001's base infrastructure (ApiGatewayV2, StaticSite, placeholder Cognito secrets) already deploys successfully before adding custom domains.
4. Environment variable `BASE_DOMAIN` is set in `.env`, `.env.prod`, or `.env.acc` before deploying to a stage that needs custom domains (see `.env.example`).
5. When running authenticated Bruno requests, the user has set `BRUNO_ACCESS_TOKEN` in their local environment or `.env` file. The token is read via `{{process.env.BRUNO_ACCESS_TOKEN}}` and is not stored in the committed `.bru` files.
