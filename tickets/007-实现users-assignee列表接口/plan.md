# 实现 Users Assignee 列表接口 Implementation Plan

> Ticket: `tickets/007-实现users-assignee列表接口/ticket.md`
> Plan: `tickets/007-实现users-assignee列表接口/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a JWT-protected `GET /api/users/assignees` Lambda endpoint that lists assignable Cognito users with opaque cursor pagination, and enforce the `name` attribute as required in the Cognito User Pool.

**Architecture:** Add a shared pagination query schema, configure the Cognito User Pool schema so `name` is required, create a `users` Lambda that calls `cognito-idp:ListUsers` with a wrapped pagination token, map Cognito attributes to `{ id, name }`, and wire the route with JWT auth and least-privilege IAM permissions in `sst.config.ts`.

## Global Constraints

- Bun workspaces monorepo; implementation touches `packages/shared` and `apps/api`.
- Vitest 100% coverage threshold enforced at root (`statements`, `branches`, `functions`, `lines`).
- TypeScript `strict`; typecheck via `bun run typecheck` (uses `tsc --build --noEmit`).
- Code style via Biome (`bunx @biomejs/biome check`).
- TDD: write a failing test before implementation for every behavior change.
- All collection APIs accept `limit` (default 50, max 100) and opaque `cursor`; cursor encode/decode uses `packages/shared/src/cursor.ts`.
- Lambda runtime `nodejs22.x` (matches existing routes).
- Cognito User Pool ID available via `USER_POOL_ID` environment variable.
- All commit messages use conventional-commit format, English, imperative, lowercase, no trailing period.

**Tech Stack:** TypeScript, AWS SDK v3 `@aws-sdk/client-cognito-identity-provider`, SST v3, Vitest, Zod, Biome.

---

### Task 1: Add shared pagination query schema

> Covers: Scenario 2 (pagination cursor and limit handling)

**Files:**
- Create: `packages/shared/src/schema/pagination.ts`
- Create: `packages/shared/src/schema/pagination.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `z` from `zod`.
- Produces: `listQuerySchema: z.ZodObject<...>` and `ListQuery` type; exported from `@lyco/shared`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/schema/pagination.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { listQuerySchema } from "./pagination.js";

describe("listQuerySchema", () => {
  it("defaults limit to 50 and omits cursor", () => {
    const result = listQuerySchema.parse({});
    expect(result).toEqual({ limit: 50 });
  });

  it("parses numeric limit from string", () => {
    const result = listQuerySchema.parse({ limit: "10" });
    expect(result).toEqual({ limit: 10 });
  });

  it("rejects limit below 1", () => {
    expect(listQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("rejects limit above 100", () => {
    expect(listQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects non-numeric limit", () => {
    expect(listQuerySchema.safeParse({ limit: "ten" }).success).toBe(false);
  });

  it("accepts a cursor string", () => {
    const result = listQuerySchema.parse({ cursor: "abc123" });
    expect(result).toEqual({ limit: 50, cursor: "abc123" });
  });

  it("rejects an empty cursor string", () => {
    expect(listQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
bun run test -- packages/shared/src/schema/pagination.test.ts
```

Expected: FAIL with `Error: Cannot find module './pagination.js'` or similar.

- [ ] **Step 3: Implement the schema**

Create `packages/shared/src/schema/pagination.ts`:

```typescript
import { z } from "zod";

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
```

Add the export to `packages/shared/src/index.ts` after the common schema export:

```typescript
export * from "./schema/common.js";
export * from "./schema/pagination.js";
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
bun run test -- packages/shared/src/schema/pagination.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema/pagination.ts \
  packages/shared/src/schema/pagination.test.ts \
  packages/shared/src/index.ts
git commit -m "feat(shared): add pagination query schema"
```

---

### Task 2: Add AWS Cognito Identity Provider SDK

> Covers: Required dependency for `cognito-idp:ListUsers` call.

**Files:**
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: None.
- Produces: `@aws-sdk/client-cognito-identity-provider` available in `apps/api`.

- [ ] **Step 1: Add the dependency**

Edit `apps/api/package.json` and add to `dependencies`:

```json
{
  "name": "@lyco/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.1085.0",
    "@lyco/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.149",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
bun install --registry https://registry.npmmirror.com
```

Expected: Lockfile updated, `node_modules` populated.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json bun.lock
git commit -m "chore(api): add cognito identity provider sdk"
```

---

### Task 3: Implement the users assignees handler

> Covers: Scenario 1 (list assignees), Scenario 2 (paginate with cursor)

**Files:**
- Create: `apps/api/src/users/index.ts`
- Create: `apps/api/src/users/index.test.ts`

**Interfaces:**
- Consumes:
  - `listQuerySchema`, `parseRequest`, `decodeCursor`, `encodeCursor`, `buildResponse`, `errorResponse`, `userSchema`, `ValidationError`, `CursorError`, `User` from `@lyco/shared`.
  - `CognitoIdentityProviderClient`, `ListUsersCommand` from `@aws-sdk/client-cognito-identity-provider`.
- Produces: `handler` mounted at `GET /api/users/assignees`; returns `{ items: User[], nextCursor?: string }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/users/index.test.ts`:

```typescript
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeCursor } from "@lyco/shared";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class MockClient {
    send = sendMock;
  },
  ListUsersCommand: class MockCommand {
    constructor(public readonly input: unknown) {}
  },
}));

import { handler } from "./index.js";

function createEvent(
  query: Record<string, string> = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const queryString = Object.entries(query)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return {
    version: "2.0",
    routeKey: "GET /api/users/assignees",
    rawPath: "/api/users/assignees",
    rawQueryString: queryString,
    headers: {},
    queryStringParameters: query,
    requestContext: {
      domainId: "",
      domainName: "",
      domainPrefix: "",
      http: {
        method: "GET",
        path: "/api/users/assignees",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: "GET /api/users/assignees",
      stage: "dev",
      time: "14/Jul/2026:00:00:00 +0000",
      timeEpoch: 1752460800000,
      accountId: "",
      apiId: "",
      authorizer: {
        principalId: "current-user",
        integrationLatency: 0,
        jwt: {
          claims: { sub: "current-user" },
          scopes: [],
        },
      },
    },
    isBase64Encoded: false,
  };
}

async function invokeHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) {
  const result = await handler(event, {} as never, () => {});
  if (typeof result === "string" || result === undefined) {
    throw new Error("expected object response");
  }
  return result;
}

describe("users assignees handler", () => {
  beforeEach(() => {
    process.env.USER_POOL_ID = "test-pool-id";
    sendMock.mockReset();
  });

  afterEach(() => {
    delete process.env.USER_POOL_ID;
  });

  it("returns mapped users from Cognito", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "alice",
          Attributes: [
            { Name: "sub", Value: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
            { Name: "name", Value: "Alice" },
          ],
        },
        {
          Username: "bob",
          Attributes: [
            { Name: "sub", Value: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" },
            { Name: "name", Value: "Bob" },
          ],
        },
      ],
    });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(result.statusCode).toBe(200);
    expect(body.items).toEqual([
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Alice" },
      { id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", name: "Bob" },
    ]);
    expect(body.nextCursor).toBeUndefined();
  });

  it("returns nextCursor when more Cognito pages exist", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "alice",
          Attributes: [
            { Name: "sub", Value: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
            { Name: "name", Value: "Alice" },
          ],
        },
      ],
      PaginationToken: "cognito-page-2",
    });

    const result = await invokeHandler(createEvent({ limit: "1" }));
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe(
      encodeCursor({ paginationToken: "cognito-page-2" }),
    );
  });

  it("follows Cognito pagination until limit is filled", async () => {
    sendMock
      .mockResolvedValueOnce({
        Users: [
          {
            Username: "a",
            Attributes: [
              { Name: "sub", Value: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
              { Name: "name", Value: "A" },
            ],
          },
          {
            Username: "b",
            Attributes: [
              { Name: "sub", Value: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" },
              { Name: "name", Value: "B" },
            ],
          },
        ],
        PaginationToken: "token-1",
      })
      .mockResolvedValueOnce({
        Users: [
          {
            Username: "c",
            Attributes: [
              { Name: "sub", Value: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" },
              { Name: "name", Value: "C" },
            ],
          },
        ],
      });

    const result = await invokeHandler(createEvent({ limit: "3" }));
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toHaveLength(3);
    expect(body.nextCursor).toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      UserPoolId: "test-pool-id",
      Limit: 1,
      PaginationToken: "token-1",
    });
  });

  it("resumes from a cursor", async () => {
    const cursor = encodeCursor({ paginationToken: "resume-token" });
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "alice",
          Attributes: [
            { Name: "sub", Value: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
            { Name: "name", Value: "Alice" },
          ],
        },
      ],
    });

    await invokeHandler(createEvent({ cursor }));

    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      UserPoolId: "test-pool-id",
      PaginationToken: "resume-token",
    });
  });

  it("excludes users without a name even if sub is present", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "no-name",
          Attributes: [
            { Name: "sub", Value: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44" },
          ],
        },
        {
          Username: "has-name",
          Attributes: [
            { Name: "sub", Value: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55" },
            { Name: "name", Value: "Has Name" },
          ],
        },
      ],
    });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toEqual([
      { id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55", name: "Has Name" },
    ]);
  });

  it("excludes users without sub", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "no-sub",
          Attributes: [{ Name: "name", Value: "No Sub" }],
        },
      ],
    });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toEqual([]);
  });

  it("returns empty list when Cognito has no users", async () => {
    sendMock.mockResolvedValueOnce({ Users: [] });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeUndefined();
  });

  it("returns 400 for invalid limit", async () => {
    const result = await invokeHandler(createEvent({ limit: "0" }));
    const body = JSON.parse(result.body ?? "{}");

    expect(result.statusCode).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid cursor", async () => {
    const result = await invokeHandler(createEvent({ cursor: "!!!" }));
    const body = JSON.parse(result.body ?? "{}");

    expect(result.statusCode).toBe(400);
    expect(body.code).toBe("INVALID_CURSOR");
  });

  it("returns 500 when USER_POOL_ID is missing", async () => {
    delete process.env.USER_POOL_ID;

    const result = await invokeHandler(createEvent());

    expect(result.statusCode).toBe(500);
  });

  it("is typed as APIGatewayProxyHandlerV2WithJWTAuthorizer", () => {
    const typed: APIGatewayProxyHandlerV2WithJWTAuthorizer = handler;
    expect(typed).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
bun run test -- apps/api/src/users/index.test.ts
```

Expected: FAIL with `Cannot find module './index.js'` or `handler is not a function`.

- [ ] **Step 3: Implement the handler**

Create `apps/api/src/users/index.ts`:

```typescript
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  type ApiResponse,
  buildResponse,
  CursorError,
  decodeCursor,
  encodeCursor,
  errorResponse,
  listQuerySchema,
  parseRequest,
  userSchema,
  type User,
  ValidationError,
} from "@lyco/shared";

const client = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<ApiResponse> => {
  try {
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
      return errorResponse("USER_POOL_ID not configured");
    }

    const query = parseRequest(listQuerySchema, {
      limit: event.queryStringParameters?.limit,
      cursor: event.queryStringParameters?.cursor,
    });

    let cognitoToken: string | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (typeof decoded.paginationToken !== "string") {
        throw new CursorError("Invalid cursor: missing paginationToken");
      }
      cognitoToken = decoded.paginationToken;
    }

    const users: User[] = [];
    let nextCognitoToken: string | undefined = cognitoToken;

    while (users.length < query.limit) {
      const remaining = query.limit - users.length;
      const response = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Limit: Math.min(remaining, 60),
          ...(nextCognitoToken ? { PaginationToken: nextCognitoToken } : {}),
        }),
      );

      for (const cognitoUser of response.Users ?? []) {
        const mapped = mapCognitoUser(cognitoUser);
        if (mapped) {
          users.push(mapped);
        }
      }

      nextCognitoToken = response.PaginationToken;
      if (!nextCognitoToken) break;
    }

    const nextCursor = nextCognitoToken
      ? encodeCursor({ paginationToken: nextCognitoToken })
      : undefined;

    return buildResponse(200, {
      items: users,
      ...(nextCursor ? { nextCursor } : {}),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(error.message, "VALIDATION_ERROR", 400);
    }
    if (error instanceof CursorError) {
      return errorResponse(error.message, "INVALID_CURSOR", 400);
    }
    console.error(error);
    return errorResponse("failed to list users");
  }
};

function mapCognitoUser(cognitoUser: UserType): User | null {
  const attributes = new Map(
    (cognitoUser.Attributes ?? []).map((attr) => [
      attr.Name ?? "",
      attr.Value ?? "",
    ]),
  );

  const id = attributes.get("sub");
  const name = attributes.get("name");

  if (!id || !name) return null;

  const parsed = userSchema.safeParse({ id, name });
  if (!parsed.success) return null;

  return parsed.data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
bun run test -- apps/api/src/users/index.test.ts
```

Expected: PASS with 100% coverage for the new files.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/users/index.ts \
  apps/api/src/users/index.test.ts
git commit -m "feat(api): implement users assignees handler"
```

---

### Task 4: Configure Cognito User Pool to require `name`

> Covers: Scenario 3 (Cognito `name` attribute is required)

**Files:**
- Modify: `sst.config.ts`

**Interfaces:**
- Consumes: Existing `userPool` definition in `sst.config.ts`.
- Produces: `name` attribute marked as required in the Cognito User Pool schema.

- [ ] **Step 1: Update the User Pool schema**

Edit `sst.config.ts` and add the `schemas` array inside the existing `transform.userPool` block:

```typescript
    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
      transform: {
        userPool: {
          adminCreateUserConfig: {
            allowAdminCreateUserOnly: true,
          },
          schemas: [
            {
              name: "name",
              attributeDataType: "String",
              required: true,
              mutable: true,
            },
          ],
        },
      },
    });
```

**Caution:** Adding or changing required standard attributes can force AWS to replace an existing User Pool. For the `dev` stage this is acceptable; for `acc`/`prod` discuss with the team before deploying, because it will delete existing users unless the pool is imported or recreated.

- [ ] **Step 2: Validate SST config syntax**

Run:
```bash
bunx tsc --noEmit sst.config.ts
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add sst.config.ts
git commit -m "chore(infra): require cognito name attribute"
```

---

### Task 5: Wire route and IAM permissions in SST

> Covers: Deployment routing, JWT auth, least-privilege `cognito-idp:ListUsers` permission.

**Files:**
- Modify: `sst.config.ts`

**Interfaces:**
- Consumes: Existing `api`, `cognitoAuthorizer`, `userPool` from `sst.config.ts`.
- Produces: `GET /api/users/assignees` route registered with JWT auth and `cognito-idp:ListUsers` permission on the User Pool ARN.

- [ ] **Step 1: Add the route**

Edit `sst.config.ts` and insert the new route immediately after the `/api/verify` route (before the `return {}` block):

```typescript
    api.route(
      "GET /api/users/assignees",
      {
        handler: "apps/api/src/users/index.handler",
        runtime: "nodejs22.x",
        environment: {
          USER_POOL_ID: userPool.id,
        },
        permissions: [
          {
            actions: ["cognito-idp:ListUsers"],
            resources: [userPool.arn],
          },
        ],
      },
      {
        auth: {
          jwt: {
            authorizer: cognitoAuthorizer.id,
          },
        },
      },
    );
```

- [ ] **Step 2: Validate SST config syntax**

Run:
```bash
bunx tsc --noEmit sst.config.ts
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add sst.config.ts
git commit -m "chore(infra): add users assignees route and iam permissions"
```

---

### Task 6: Add Bruno request

> Covers: Manual API testing for the new endpoint.

**Files:**
- Create: `bruno/lyco-list/users/folder.bru`
- Create: `bruno/lyco-list/users/get assignees.bru`

**Interfaces:**
- Consumes: Existing `collection.bru` bearer auth and `baseUrl` / `accessToken` variables.
- Produces: A reusable `GET /api/users/assignees` request.

- [ ] **Step 1: Create the folder metadata**

Create `bruno/lyco-list/users/folder.bru`:

```
meta {
  name: users
  type: folder
}
```

- [ ] **Step 2: Create the request**

Create `bruno/lyco-list/users/get assignees.bru`:

```
meta {
  name: get assignees
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/users/assignees?limit=50
  body: none
  auth: inherit
}
```

- [ ] **Step 3: Commit**

```bash
git add bruno/lyco-list/users/folder.bru \
  bruno/lyco-list/users/get assignees.bru
git commit -m "docs(bruno): add get users assignees request"
```

---

### Task 7: Verify full test suite, typecheck, and lint

> Covers: Project-wide quality gates before considering the ticket done.

**Files:**
- None (verification only).

- [ ] **Step 1: Run tests**

Run:
```bash
bun run test
```

Expected:
- All tests pass.
- Coverage report shows `apps/api/src/users/index.ts`, `packages/shared/src/schema/pagination.ts`, and related test files at 100%.
- Root thresholds for `statements`, `branches`, `functions`, `lines` pass.

- [ ] **Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 3: Run Biome check**

Run:
```bash
bunx @biomejs/biome check
```

Expected: No lint or format errors. If any, run `bunx @biomejs/biome check --write` and re-run.

- [ ] **Step 4: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore(repo): apply formatting and finalize"
```

---

### Task 8: Sync design document

> Covers: Keep the source design aligned with the implemented path and Cognito constraint.

**Files:**
- Verify: `.lychee/artifacts/designs/2026-07-13-lyco-list-design.md`

The design document already uses `/api/users/assignees` and documents the required `name` attribute. After implementation, verify the following three occurrences are correct:

- API overview table lists `GET /api/users/assignees` under the `users` Lambda.
- "用户列表" section describes `/api/users/assignees` using `cognito-idp:ListUsers` and notes that the `name` attribute is required.
- Roadmap item 7 reads "实现 `/api/users/assignees` 接口（返回可选 assignee 列表）。"

If any occurrence still uses `/api/users`, update it to `/api/users/assignees` and commit:

```bash
git add .lychee/artifacts/designs/2026-07-13-lyco-list-design.md
git commit -m "docs(design): align users endpoint path and cognito name requirement"
```

---

## Self-Review

**1. Ticket coverage:**
- Scenario 1 (list assignees) → Task 3 handler and tests.
- Scenario 2 (paginate with cursor) → Task 1 pagination schema + Task 3 pagination loop and tests.
- Scenario 3 (Cognito `name` required) → Task 4 User Pool schema configuration.
- No gaps identified.

**2. Placeholder scan:**
- No `TBD`, `TODO`, or vague "add error handling" steps.
- Every code step includes full source code.
- Every verification step includes exact commands and expected output.

**3. Type consistency:**
- `listQuerySchema` is defined in Task 1 and consumed in Task 3 via `@lyco/shared`.
- `User` type is reused from existing `packages/shared/src/schema/users/index.ts`.
- Cursor payload uses `{ paginationToken: string }` consistently for encode/decode.

**4. Plan reliability:**
- Assumes Cognito User Pool already exists (it does; created in `sst.config.ts` ticket 001/002).
- Assumes JWT authorizer already exists (it does; `cognitoAuthorizer` in `sst.config.ts`).
- Uses `userPool.arn` for IAM resource, confirmed available in SST v3 `CognitoUserPool` docs.
- Uses `permissions` array on the route handler, confirmed valid SST v3 `FunctionArgs`.
- Handler falls back to 500 if `USER_POOL_ID` is missing, making the env failure testable without import-time exceptions.
- Cognito `name` schema change may force User Pool replacement; flagged in Task 4 for non-dev stages.

---

## Execution Handoff

**Plan updated and saved to `tickets/007-实现users-assignee列表接口/plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach would you like?**
