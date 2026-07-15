# 配置 Cognito Hosted UI 并关闭公开注册 Implementation Plan

> Ticket: `tickets/002-配置cognito-hosted-ui并关闭公开注册/ticket.md`
> Plan: `tickets/002-配置cognito-hosted-ui并关闭公开注册/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SST v3 中创建真实的 Amazon Cognito User Pool、User Pool Client 与 Hosted UI 域名，关闭公开注册，并向前端暴露必要的环境变量，使前端能通过 AWS Amplify 触发 Hosted UI 登录并完成回调拿 Token。

**Architecture:** 使用 `sst.aws.CognitoUserPool` 创建用户池，通过 `transform.userPool` 设置 `AdminCreateUserConfig.AllowAdminCreateUserOnly: true` 关闭公开注册；由于当前 SST v3.19.3 的 `CognitoUserPool` 组件未暴露 `domain` 参数，User Pool Domain 通过 Pulumi AWS 原生资源 `aws.cognito.UserPoolDomain` 创建；`addClient` 创建支持 `response_type=code` 的 Public Client，`logoutUrls` 通过 `transform.client` 传入；为避免循环依赖，`callbackUrls` 直接基于 stage 与 `BASE_DOMAIN` 推导；前端安装 `aws-amplify` 并在 `main.tsx` 初始化，首页提供登录按钮，`/callback` 路由验证 Amplify 已成功获取 token。

## Global Constraints

- SST v3 根配置位于 `sst.config.ts`，基础设施代码被根 `vitest.config.ts` 的 `coverage.exclude` 排除，无需单元测试。
- 前端代码（`apps/web/src/**`）必须被 Vitest 覆盖，覆盖率阈值 statements/branches/functions/lines 均为 100%。
- 测试命令：根目录 `bun run test`（即 `vitest run --coverage --passWithNoTests`）。
- 代码规范：`bunx @biomejs/biome check`。
- 类型检查：`bun run typecheck`（优先使用项目已有的 `tsc --build --noEmit`）。
- 安装依赖：`bun install --registry https://registry.npmmirror.com`。
- Cognito 域名策略：所有 stage 使用 Cognito prefix 域名 `{app}-{stage}.auth.ap-southeast-1.amazoncognito.com`；前端 acc/prod 仍保留 `app.{stagePrefix}jan24th.today` 自定义域名。
- 前端回调 URL 策略：prod/acc 使用 `https://app.{stagePrefix}jan24th.today/`；dev stage 使用 `http://localhost:5173/` 用于本地 Vite 开发。
- 前端边界：ticket 002 负责 Cognito 基础设施 + 前端 Amplify 初始化配置 + 最小登录按钮 + 回调页读取 token；token 刷新、401 重定向、持久化状态管理由 ticket 005 负责。
- 环境变量：`.env.acc` / `.env.prod` 只需配置 `BASE_DOMAIN=jan24th.today`，不需要 `ROUTE_53_ZONE_ID`。

**Tech Stack:** SST v3, AWS Cognito, React, TypeScript, Vite, AWS Amplify v6, Vitest, jsdom, Biome

---

### Task 1: 创建真实 Cognito User Pool、Client 与 Hosted UI 域名

> Covers: Scenario 2（公开注册已关闭）, Scenario 1/3 的基础设施前提

**Files:**
- Modify: `sst.config.ts`
- Modify: `sst-env.d.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `$app.stage`, `process.env.BASE_DOMAIN`
- Produces: `userPool.id`, `userPoolClient.id`, `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`

- [x] **Step 1: 删除 ticket 001 留下的 Cognito Secret 占位**

`sst.config.ts` 中原有：

```typescript
const userPoolId = new sst.Secret("USER_POOL_ID", "todo-in-ticket-002");
const userPoolClientId = new sst.Secret(
  "USER_POOL_CLIENT_ID",
  "todo-in-ticket-002",
);
```

已删除，并将 `api.route` 和 `StaticSite` 中引用它们的 `environment` 项替换为真实 Cognito 组件输出。

- [x] **Step 2: 定义 stage 相关的回调 URL 与 Cognito prefix 域名变量**

在 `run()` 函数中保留 `domain` 对象用于前端/API 自定义域名，并新增：

```typescript
const authDomainPrefix = `${$app.name}-${$app.stage}`;
const cognitoDomainUrl = `https://${authDomainPrefix}.auth.ap-southeast-1.amazoncognito.com`;
```

`callbackUrls` 直接由 stage 推导，避免依赖 `web.url` 造成循环引用：

```typescript
const callbackUrls = ((): string[] => {
  if (isCustomDomainStage && baseDomain) {
    return [`https://app.${stagePrefix}${baseDomain}/`];
  }
  return ["http://localhost:5173/"];
})();
```

- [x] **Step 3: 创建 Cognito User Pool 并关闭公开注册**

```typescript
const userPool = new sst.aws.CognitoUserPool("UserPool", {
  usernames: ["email"],
  transform: {
    userPool: {
      adminCreateUserConfig: {
        allowAdminCreateUserOnly: true,
      },
    },
  },
});
```

`allowAdminCreateUserOnly: true` 等价于 AWS Console 中的 "Only allow administrators to create users"，关闭公开自助注册。

- [x] **Step 4: 使用 Pulumi AWS 原生资源创建 User Pool Domain**

由于 SST v3.19.3 的 `CognitoUserPool` 组件未实现 `domain` 参数，显式创建：

```typescript
new aws.cognito.UserPoolDomain("UserPoolDomain", {
  domain: authDomainPrefix,
  userPoolId: userPool.id,
});
```

- [x] **Step 5: 创建 User Pool Client 并设置 callback/logout URLs**

```typescript
const userPoolClient = userPool.addClient("WebClient", {
  callbackUrls,
  transform: {
    client: {
      logoutUrls: callbackUrls,
    },
  },
});
```

`logoutUrls` 通过 `transform.client` 传入，因为 `sst.aws.CognitoUserPoolClient` 未直接暴露该参数。

- [x] **Step 6: 更新 StaticSite 环境变量**

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
    VITE_USER_POOL_ID: userPool.id,
    VITE_USER_POOL_CLIENT_ID: userPoolClient.id,
    VITE_COGNITO_DOMAIN: cognitoDomainUrl,
  },
});
```

`web` 在 `userPoolClient` 之后声明，避免前向引用。

- [x] **Step 7: 更新 health Lambda 环境变量**

```typescript
api.route("GET /api/health", {
  handler: "apps/api/src/health/index.handler",
  runtime: "nodejs22.x",
  environment: {
    USER_POOL_ID: userPool.id,
    USER_POOL_CLIENT_ID: userPoolClient.id,
  },
});
```

- [x] **Step 8: 更新 `sst-env.d.ts` 添加新的环境变量类型**

确认 `ImportMetaEnv` 包含：

```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USER_POOL_ID: string;
  readonly VITE_USER_POOL_CLIENT_ID: string;
  readonly VITE_COGNITO_DOMAIN: string;
}
```

- [x] **Step 9: 更新 `.env.example`**

```bash
# AWS profile used by SST deployments
AWS_PROFILE=lyco-list-sst

# Base domain for custom domains in deployed stages (prod / acc)
BASE_DOMAIN=jan24th.today

# Frontend environment variables injected by SST at build time
# Local development does not need to set these manually.
VITE_API_URL=
VITE_USER_POOL_ID=
VITE_USER_POOL_CLIENT_ID=
VITE_COGNITO_DOMAIN=

# Bruno API authorization token
BRUNO_ACCESS_TOKEN=
```

- [x] **Step 10: 运行代码检查**

Run: `bun check`
Expected: 无格式或 lint 错误。✅

- [x] **Step 11: 部署验证（具备 AWS 凭证时执行）**

Run: `bunx sst deploy --stage acc`
Expected: SST 成功创建/更新 Cognito User Pool、UserPoolDomain、Client；控制台输出 Hosted UI URL；AWS Console 确认 `AllowAdminCreateUserOnly: true`。✅

- [x] **Step 12: 提交基础设施变更**

```bash
git add sst.config.ts sst-env.d.ts .env.example
git commit -m "feat(infra): add cognito user pool with hosted ui and admin-only registration"
```

---

### Task 2: 前端安装 AWS Amplify 并封装配置

> Covers: Scenario 1（触发 Hosted UI 跳转）、Scenario 3（回调后获取 token）的前置配置

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/auth.test.ts`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: `import.meta.env.VITE_USER_POOL_ID`, `import.meta.env.VITE_USER_POOL_CLIENT_ID`, `import.meta.env.VITE_COGNITO_DOMAIN`
- Produces: `buildAmplifyConfig(config)`, `configureAmplify(config, origin?)`, `validateAuthConfig(config)`

- [x] **Step 1: 安装 aws-amplify**

Run:

```bash
cd apps/web
bun install --registry https://registry.npmmirror.com aws-amplify
```

Expected: `apps/web/package.json` 的 `dependencies` 中新增 `aws-amplify`。✅

- [x] **Step 2: 创建 `apps/web/src/lib/auth.ts`**

```typescript
import { Amplify, type ResourcesConfig } from "aws-amplify";

export interface AuthConfig {
  userPoolId: string;
  userPoolClientId: string;
  oauthDomain: string;
}

export function buildRedirectUrls(origin: string): {
  redirectSignIn: string[];
  redirectSignOut: string[];
} {
  const normalizedOrigin = origin.endsWith("/") ? origin : `${origin}/`;
  return {
    redirectSignIn: [normalizedOrigin],
    redirectSignOut: [normalizedOrigin],
  };
}

export function normalizeOAuthDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "");
}

export function validateAuthConfig(config: AuthConfig): void {
  if (!config.userPoolId) {
    throw new Error("VITE_USER_POOL_ID is not configured");
  }
  if (!config.userPoolClientId) {
    throw new Error("VITE_USER_POOL_CLIENT_ID is not configured");
  }
  if (!config.oauthDomain) {
    throw new Error("VITE_COGNITO_DOMAIN is not configured");
  }
}

export function buildAmplifyConfig(
  config: AuthConfig,
  origin: string,
): ResourcesConfig {
  const { redirectSignIn, redirectSignOut } = buildRedirectUrls(origin);

  return {
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: {
          oauth: {
            domain: normalizeOAuthDomain(config.oauthDomain),
            scopes: ["openid", "email", "profile"],
            redirectSignIn,
            redirectSignOut,
            responseType: "code",
          },
        },
      },
    },
  };
}

export function configureAmplify(
  config: AuthConfig,
  origin: string | undefined = globalThis.window?.location.origin,
): void {
  if (!origin) {
    throw new Error("Cannot configure Amplify without an origin");
  }
  validateAuthConfig(config);
  Amplify.configure(buildAmplifyConfig(config, origin));
}
```

- [x] **Step 3: 创建 `apps/web/src/lib/auth.test.ts`**

覆盖 `buildRedirectUrls`、`normalizeOAuthDomain`、`validateAuthConfig`、`buildAmplifyConfig`、`configureAmplify`，Vitest mock `aws-amplify` 的 `Amplify.configure`。✅

- [x] **Step 4: 运行 auth 模块测试**

Run: `bun run test`
Expected: 所有测试通过，100% 覆盖 `src/lib/auth.ts`。✅

- [x] **Step 5: 修改 `apps/web/src/main.tsx` 初始化 Amplify**

```typescript
configureAmplify({
  userPoolId: import.meta.env.VITE_USER_POOL_ID,
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  oauthDomain: import.meta.env.VITE_COGNITO_DOMAIN,
});
```

- [x] **Step 6: 运行前端代码检查**

Run: `bun check && bun run typecheck`
Expected: 无错误。✅

- [x] **Step 7: 提交**

```bash
git add apps/web/package.json apps/web/src/lib/auth.ts apps/web/src/lib/auth.test.ts apps/web/src/main.tsx bun.lock
git commit -m "feat(web): add amplify auth configuration"
```

---

### Task 3: 添加登录按钮与回调路由

> Covers: Scenario 1（点击登录跳转 Hosted UI）、Scenario 3（回调后应用收到有效 token）

**Files:**
- Create: `apps/web/src/components/LoginButton.tsx`
- Create: `apps/web/src/components/LoginButton.test.tsx`
- Create: `apps/web/src/routes/callback.tsx`
- Create: `apps/web/src/routes/callback.test.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Create/Modify: `apps/web/src/routes/index.test.tsx`

**Interfaces:**
- Consumes: `signInWithRedirect` from `aws-amplify/auth`, `getCurrentUser` from `aws-amplify/auth`
- Produces: `<LoginButton />` component, `/callback` route

- [x] **Step 1: 创建 `apps/web/src/components/LoginButton.tsx`**

```typescript
import { Button } from "@/components/ui/button";
import { signInWithRedirect } from "aws-amplify/auth";

export function LoginButton() {
  return <Button onClick={() => void signInWithRedirect()}>登录</Button>;
}
```

- [x] **Step 2: 创建 `apps/web/src/components/LoginButton.test.tsx`**

测试渲染和点击调用 `signInWithRedirect`。✅

- [x] **Step 3: 创建 `apps/web/src/routes/callback.tsx`**

使用 `getCurrentUser()` 验证登录状态并展示用户 ID 或错误信息。✅

- [x] **Step 4: 创建 `apps/web/src/routes/callback.test.tsx`**

覆盖 loading、成功、失败三种状态。✅

- [x] **Step 5: 修改 `apps/web/src/routes/index.tsx` 显示登录入口**

保留"今天"标题和 about 链接，根据 `getCurrentUser()` 结果显示登录按钮或已登录用户 ID。✅

- [x] **Step 6: 创建/更新 `apps/web/src/routes/index.test.tsx`**

覆盖未登录（显示登录按钮）与已登录（显示用户 ID）两种状态。✅

- [x] **Step 7: 生成 TanStack Router 类型**

新增 `callback.tsx` 路由文件后，重新生成 route tree：

```bash
cd apps/web
bunx tsr generate
```

Expected: `routeTree.gen.ts` 被更新，包含 `/callback` 路由。✅

- [x] **Step 8: 运行前端完整测试与检查**

Run:

```bash
bun run test
bun run typecheck
bun check
```

Expected: 测试通过，覆盖率 100%，类型检查通过，Biome 无错误。✅

- [x] **Step 9: 提交**

```bash
git add apps/web/src/components/LoginButton.tsx apps/web/src/components/LoginButton.test.tsx apps/web/src/routes/callback.tsx apps/web/src/routes/callback.test.tsx apps/web/src/routes/index.tsx apps/web/src/routes/index.test.tsx apps/web/src/routeTree.gen.ts bun.lock
git commit -m "feat(web): add cognito hosted ui login button and callback route"
```

---

### Task 4: 文档同步与最终验证

> Covers: 所有验收标准的事后验证与下游 ticket 衔接

**Files:**
- Modify: `tickets/002-配置cognito-hosted-ui并关闭公开注册/ticket.md`
- Modify: `vitest.config.ts`
- Modify: `README.md`（可选）

- [x] **Step 1: 运行全仓库测试**

Run:

```bash
bun run test
```

Expected: 所有子包测试通过，覆盖率阈值全部满足。✅

- [x] **Step 2: 运行全仓库代码检查与类型检查**

Run:

```bash
bun check
bun run typecheck
```

Expected: 无错误。✅

- [x] **Step 3: 更新 `ticket.md`**

- Status 改为 `Done`
- 补充"重要实现说明"章节，记录：
  - 使用 `aws.cognito.UserPoolDomain` 原生资源
  - `logoutUrls` 通过 `transform.client` 传入
  - `callbackUrls` 不依赖 `web.url`
  - 所有 stage 使用 Cognito prefix 域名
  - `.env.acc` / `.env.prod` 只需 `BASE_DOMAIN`

- [x] **Step 4: 更新 `plan.md`**

将本 plan 中所有步骤标记为完成，并更新 Task 1 的实现细节以反映实际代码。✅

- [x] **Step 5: 更新 `vitest.config.ts` 排除 `main.tsx`**

```typescript
coverage: {
  exclude: [
    ...configDefaults.coverage.exclude,
    "**/main.tsx",
  ],
}
```

原因：`main.tsx` 是纯应用入口，只包含副作用调用，无法被业务测试覆盖。✅

- [x] **Step 6: 提交**

```bash
git add tickets/002-配置cognito-hosted-ui并关闭公开注册/ticket.md tickets/002-配置cognito-hosted-ui并关闭公开注册/plan.md vitest.config.ts
git commit -m "docs: clarify cognito hosted ui scope and exclude main.tsx from coverage"
```

---

## Self-Review

### 1. Ticket coverage

| 验收标准 | 对应 Task |
|---|---|
| Scenario 1: 点击登录 → 重定向到 Cognito Hosted UI | Task 2（Amplify 配置）+ Task 3（LoginButton 调用 `signInWithRedirect`） |
| Scenario 2: 公开注册已关闭 | Task 1（`AdminCreateUserConfig.AllowAdminCreateUserOnly: true`） |
| Scenario 3: 成功回调后应用收到有效 token | Task 2（Amplify OAuth `responseType: 'code'`）+ Task 3（callback 路由调用 `getCurrentUser`） |

### 2. Placeholder scan

- 无 "TBD"/"TODO"/"implement later"。
- 每个 step 均给出具体代码或命令。
- 无 "Similar to Task N" 或 "Write tests for the above"。

### 3. Type consistency

- `AuthConfig` 接口在 Task 2 定义，在 Task 3 的组件中不直接使用（组件只使用 Amplify auth API）。
- `configureAmplify` 的 `origin` 参数在测试和 main.tsx 中用法一致。
- `import.meta.env.VITE_COGNITO_DOMAIN` 在 `sst-env.d.ts`、sst.config.ts、main.tsx 中一致。

### 4. 风险与假设

- SST v3.19.3 的 `sst.aws.CognitoUserPool` 未暴露 `domain` 参数，已用 `aws.cognito.UserPoolDomain` 原生资源绕过。
- `sst.aws.CognitoUserPoolClient` 未暴露 `logoutUrls`，已用 `transform.client` 绕过。
- `callbackUrls` 直接基于 stage/BASE_DOMAIN 推导，避免 `web` 与 `userPoolClient` 循环依赖。
- 所有 stage 使用 Cognito prefix 域名，前端 acc/prod 自定义域名不受影响。
- 本地开发 dev stage 使用 `http://localhost:5173/` 作为 callback URL。
