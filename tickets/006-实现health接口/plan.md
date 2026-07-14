# 实现 Health 接口 Implementation Plan

> Ticket: `tickets/006-实现health接口/ticket.md`
> Plan: `tickets/006-实现health接口/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/api/src/health/` 中实现一个稳定、可测试的 `GET /api/health` Lambda handler，返回 API 健康状态，无需认证即可访问，并满足 100% 测试覆盖率。

**Architecture:** health handler 为原生 AWS Lambda `APIGatewayProxyHandlerV2`，接收 API Gateway HTTP v2 事件，返回统一 JSON 响应体。响应体包含 `ok: true` 和 `timestamp` 字段，供调用方确认服务运行正常。handler 不依赖外部服务（如 DynamoDB、Cognito），仅检查自身运行状态，保证健康检查端点在任何情况下都能快速返回 200。

## Global Constraints

- 包管理器：`bun` workspaces，安装依赖时使用 `--registry https://registry.npmmirror.com`。
- 代码规范：`biome.json` 统一配置，开发脚本 `bun check`，CI 使用 `bunx @biomejs/biome ci`。
- 类型检查：优先使用 `bunx tsgo`；若 tsgo 不兼容，回退到 `tsc --noEmit`。
- 测试框架：Vitest，覆盖率阈值 statements / branches / functions / lines 均为 100%。
- 后端：AWS Lambda (Node.js) + API Gateway HTTP API v2，原生 Lambda handler，无框架。
- 部署：SST v3，根 `sst.config.ts` 配置 `ApiGatewayV2`（由 ticket 001 建立）。
- 响应格式：统一通过 `packages/shared` 的 `buildResponse` 工具返回 JSON。
- 所有业务逻辑按 TDD 开发；即使简单如 health handler 也需要编写测试并满足 100% 覆盖率。
- Git 提交格式：`类型(范围): 描述`，英文、小写、祈使句、末尾不加句号。

---

### Task 1: 完善 Health Handler 实现

> Covers: Scenario 1（Health 端点返回 OK）、Scenario 2（无需认证即可访问）

**Files:**
- Modify: `apps/api/src/health/index.ts`
- Modify: `apps/api/src/health/index.test.ts`

**Interfaces:**
- Consumes: `buildResponse` from `@lyco/shared`；`APIGatewayProxyEventV2` from `aws-lambda`。
- Produces: `handler` 函数，返回 `200 { ok: true, timestamp: string }`。

- [ ] **Step 1: 更新 health handler 以返回时间戳**

`apps/api/src/health/index.ts`:

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { buildResponse } from "@lyco/shared";

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2,
) => {
  const requestId = event.requestContext?.requestId ?? "unknown";
  return buildResponse(200, {
    ok: true,
    timestamp: new Date().toISOString(),
    requestId,
  });
};
```

- [ ] **Step 2: 编写 health handler 测试**

`apps/api/src/health/index.test.ts`:

```typescript
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handler } from "./index";

function createHealthEvent(): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /api/health",
    rawPath: "/api/health",
    rawQueryString: "",
    headers: {},
    requestContext: {
      domainId: "",
      domainName: "",
      http: {
        method: "GET",
        path: "/api/health",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: "GET /api/health",
      stage: "dev",
      time: "14/Jul/2026:00:00:00 +0000",
      timeEpoch: 1752460800000,
      accountId: "",
      apiId: "",
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe("health handler", () => {
  it("returns 200 with ok: true and timestamp", async () => {
    const event = createHealthEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Content-Type"]).toBe("application/json");

    const body = JSON.parse(result.body ?? "{}");
    expect(body.ok).toBe(true);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.requestId).toBe("test-request-id");
  });

  it("returns 200 when requestId is missing", async () => {
    const event = createHealthEvent();
    event.requestContext.requestId = undefined;

    const result = await handler(event);
    const body = JSON.parse(result.body ?? "{}");

    expect(result.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("unknown");
  });

  it("is typed as APIGatewayProxyHandlerV2", () => {
    const typed: APIGatewayProxyHandlerV2 = handler;
    expect(typed).toBeDefined();
  });
});
```

- [ ] **Step 3: 运行 health handler 测试**

Run: `cd apps/api && bun test src/health/index.test.ts`

Expected: PASS，覆盖率 100%。

- [ ] **Step 4: 提交**

```bash
git add apps/api/src/health

git commit -m "feat(api): implement health endpoint with timestamp and request id"
```

---

### Task 2: 确保 API Gateway 路由无需认证

> Covers: Scenario 2（Health 端点公开可访问）

**Files:**
- Modify: `sst.config.ts`
- Create: `apps/api/src/health/health.integration.test.ts`（可选，使用轻量级事件验证）

**Interfaces:**
- Consumes: SST `ApiGatewayV2` 配置。
- Produces: `GET /api/health` 路由不启用 Cognito JWT 授权器（在 ticket 002 配置 Cognito 授权器时也需要排除 health）。

- [ ] **Step 1: 检查当前 `sst.config.ts` 中 `/api/health` 路由配置**

读取 `sst.config.ts` 中对应片段，确认 route 定义类似：

```typescript
api.route("GET /api/health", {
  handler: "apps/api/src/health/index.handler",
  runtime: "nodejs22.x",
});
```

- [ ] **Step 2: 确保 health 路由无授权器**

SST v3 `ApiGatewayV2` 默认不带授权器；若 ticket 002 在 API 上配置了 `authorizer: "jwt"`，则 health 路由需要显式覆盖为 `authorizer: "none"`。

`sst.config.ts` 中 health 路由应如下：

```typescript
api.route("GET /api/health", {
  handler: "apps/api/src/health/index.handler",
  runtime: "nodejs22.x",
  authorizer: "none",
});
```

**说明**：ticket 006 阶段 Cognito 授权器尚未配置，因此 `authorizer: "none"` 是防御性声明，确保后续 ticket 002 启用全局 JWT 授权器时 health 仍保持公开。

- [ ] **Step 3: 创建授权器配置测试（可选）**

由于 SST 配置是基础设施代码，可通过单元测试验证其导出结构。创建 `sst.config.test.ts` 在根目录：

```typescript
import { describe, expect, it } from "vitest";

// 简单读取 sst.config.ts 的默认导出，验证其为函数
import config from "./sst.config";

describe("sst.config", () => {
  it("exports a default config function", () => {
    expect(typeof config).toBe("function");
  });
});
```

**注意**：如果 `sst.config.ts` 依赖运行时 SST 平台类型，测试可能需要 mock 环境。在 ticket 006 阶段，先不强制为 `sst.config.ts` 写测试，仅保留验证命令。

- [ ] **Step 4: 运行类型检查**

Run: `bun typecheck`

Expected: 无类型错误。

- [ ] **Step 5: 提交**

```bash
git add sst.config.ts

git commit -m "feat(infra): ensure health route is publicly accessible"
```

---

### Task 3: 更新 Bruno 集合中的 Health 请求

> Covers: 开发阶段手动验证 health 端点

**Files:**
- Modify: `bruno/lyco-list/health/get health.bru`
- Modify: `bruno/lyco-list/environments/development.bru`（如需调整 baseUrl）

**Interfaces:**
- Produces: Bruno 集合中 `GET /api/health` 请求无需 `accessToken`。

- [ ] **Step 1: 确认 Bruno health 请求存在**

读取 `bruno/lyco-list/health/get health.bru`：

```
meta {
  name: get health
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/health
  body: none
  auth: none
}
```

- [ ] **Step 2: 修改 auth 为 none**

确保 `auth` 字段为 `none`（因为 health 端点无需认证）。若 ticket 001 创建的请求使用 `auth: inherit`，则改为 `auth: none`。

- [ ] **Step 3: 提交**

```bash
git add bruno/lyco-list/health/get health.bru

git commit -m "chore(bruno): mark health request as unauthenticated"
```

---

### Task 4: 最终验证与文档同步

> Covers: 所有验收标准的端到端验证

**Files:**
- Modify: `tickets/006-实现health接口/ticket.md`（如需补充备注）

**Interfaces:**
- Produces: 通过 `bun check`、`bun typecheck`、`bun test` 和 `sst dev` 验证的 health 接口。

- [ ] **Step 1: 运行完整验证序列**

Run:

```bash
bun install --registry https://registry.npmmirror.com
bun check
bun typecheck
bun test
```

Expected:
- `bun install` 成功。
- `bun check` 成功。
- `bun typecheck` 成功。
- `bun test` 所有测试通过，覆盖率 100%。

- [ ] **Step 2: 本地部署并验证 `/api/health`（若具备 AWS 凭证）**

Run: `bunx sst dev --stage dev`

Wait until `Api` URL is printed, then:

Run: `curl -s $(bunx sst state print --stage dev | jq -r '.api')/api/health`

Expected: 返回 JSON 包含 `ok: true`、`timestamp` 和 `requestId`，HTTP 200。

若无法运行 `sst dev`，在 ticket 备注中记录：需要 AWS 凭证与 ap-southeast-1 权限才能完整验证 Scenario 2。

- [ ] **Step 3: 验证无认证也可访问**

使用 `curl` 不带 `Authorization` header 调用 `/api/health`：

Run: `curl -s -H "Authorization:" $(bunx sst state print --stage dev | jq -r '.api')/api/health`

Expected: 仍然返回 200 和 `ok: true`。

- [ ] **Step 4: 同步 ticket 备注（如需要）**

如果 `sst dev` 需要 AWS 凭证或 Cognito 授权器尚未配置，打开 `tickets/006-实现health接口/ticket.md` 并在末尾添加：

```markdown
## 计划实施备注
- `/api/health` 在 `sst.config.ts` 中显式配置 `authorizer: "none"`，确保 ticket 002 启用 Cognito JWT 授权器后仍保持公开访问。
- `sst dev` 完整验证需要有效的 AWS 凭证与 ap-southeast-1 访问权限；无凭证时无法本地调用 API Gateway。
```

- [ ] **Step 5: 提交最终调整**

```bash
git add -A

git commit -m "docs(health): add implementation notes for health endpoint"
```

---

## Self-Review

### 1. Ticket coverage

- Scenario 1（Health 端点返回 OK）→ Task 1。
- Scenario 2（Health 端点公开可访问）→ Task 1、Task 2、Task 3。

### 2. Placeholder scan

计划无 `TBD`、`TODO`、`implement later`、`fill in details` 或类似模糊描述；每个步骤包含实际代码或命令。

### 3. Type consistency

- `handler` 在 `apps/api/src/health/index.ts` 中显式标注 `APIGatewayProxyHandlerV2` 类型，接收 `APIGatewayProxyEventV2` 参数，与测试文件中事件结构一致。
- `buildResponse` 来自 `@lyco/shared`，与 ticket 001 定义一致。
- `sst.config.ts` 中 `authorizer: "none"` 是 SST v3 的合法选项。

### 4. Plan reliability

本计划假设 ticket 001 已创建 `apps/api/src/health/index.ts` 占位文件和 `sst.config.ts` 中的 `/api/health` 路由。health handler 不依赖外部服务，保证稳定返回 200。`authorizer: "none"` 是防御性配置，防止后续 Cognito 授权器误覆盖。Bruno 请求调整确保开发阶段手动验证一致。

---

## Execution Handoff

Plan complete and saved to `tickets/006-实现health接口/plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you like?
