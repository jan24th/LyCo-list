# 实现 Cognito 登录回调与 401 重定向处理 Implementation Plan

> Ticket: `tickets/005-实现cognito登录回调与401重定向处理/ticket.md`
> Plan: `tickets/005-实现cognito登录回调与401重定向处理/plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在前端完成 Cognito OAuth 回调处理、401 自动跳转登录，以及基于 refresh token 的 access token 自动刷新能力。

**Architecture:** 复用已有的 AWS Amplify Auth 配置，新增 `apiClient` 统一在请求头注入 access token，并在 401 时调用 `signInWithRedirect` 回 Cognito Hosted UI；`fetchAuthSession` 自身会在 access token 过期时自动用 refresh token 刷新。回调路由 `/callback` 解析 URL 中的 `code`，确认 session 建立后通过 TanStack Router 跳转到首页 `/`。

## Global Constraints

- 前端包管理器：Bun；测试运行器：Vitest；覆盖率阈值：statements/branches/functions/lines 均为 100%。
- 前端框架：React 19 + Vite 6 + TypeScript 5.8 + TanStack Router + Tailwind CSS v4 + shadcn/ui。
- 认证库：AWS Amplify v6 (`aws-amplify`)。
- API 调用：原生 `fetch`，通过 `Authorization: Bearer <accessToken>` 传递 token。
- 代码规范：Biome（`bunx @biomejs/biome check`）。
- 类型检查：`bunx tsgo` 优先，否则 `tsc --noEmit`。
- Git 提交：约定式提交，英文小写祈使句，不加句号。
- **已明确的实现决策**：回调地址统一为 `/callback`，因此需要同步修改 `sst.config.ts` 中的 `callbackUrls` 以及 `apps/web/src/lib/auth.ts` 中的 `buildRedirectUrls`。

**Tech Stack:** React, Vite, TypeScript, TanStack Router, AWS Amplify Auth, Vitest, jsdom, fetch API.

---

## Task 1: 统一回调地址为 `/callback` 并添加回调参数解析工具

> Covers: Scenario 1（处理 OAuth 回调）

**Files:**
- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/lib/auth.test.ts`
- Modify: `sst.config.ts`

**Interfaces:**
- Consumes: existing `AuthConfig` shape, `normalizeOAuthDomain`
- Produces: `buildRedirectUrls(origin)` now returns `[origin/callback]`; new `parseCallbackCode(search: string): string | null`

- [ ] **Step 1: Write the failing tests for new behavior**

Update `apps/web/src/lib/auth.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import {
  buildAmplifyConfig,
  buildRedirectUrls,
  configureAmplify,
  normalizeOAuthDomain,
  parseCallbackCode,
  validateAuthConfig,
} from "./auth";

const { mockConfigure } = vi.hoisted(() => ({ mockConfigure: vi.fn() }));

vi.mock("aws-amplify", () => ({
  Amplify: { configure: mockConfigure },
}));

const baseConfig = {
  userPoolId: "ap-southeast-1_123456789",
  userPoolClientId: "abc123",
  oauthDomain: "auth.example.com",
};

describe("buildRedirectUrls", () => {
  it("returns callback url with trailing slash normalized", () => {
    expect(buildRedirectUrls("https://app.example.com")).toEqual({
      redirectSignIn: ["https://app.example.com/callback"],
      redirectSignOut: ["https://app.example.com/callback"],
    });
  });

  it("returns callback url when origin already has trailing slash", () => {
    expect(buildRedirectUrls("https://app.example.com/")).toEqual({
      redirectSignIn: ["https://app.example.com/callback"],
      redirectSignOut: ["https://app.example.com/callback"],
    });
  });
});

describe("normalizeOAuthDomain", () => {
  it("strips https:// prefix", () => {
    expect(normalizeOAuthDomain("https://auth.example.com")).toBe(
      "auth.example.com",
    );
  });

  it("strips http:// prefix", () => {
    expect(normalizeOAuthDomain("http://auth.example.com")).toBe(
      "auth.example.com",
    );
  });

  it("leaves bare domain unchanged", () => {
    expect(normalizeOAuthDomain("auth.example.com")).toBe("auth.example.com");
  });
});

describe("buildAmplifyConfig", () => {
  it("returns valid Cognito OAuth configuration", () => {
    const config = buildAmplifyConfig(baseConfig, "https://app.example.com");

    expect(config).toEqual({
      Auth: {
        Cognito: {
          userPoolId: baseConfig.userPoolId,
          userPoolClientId: baseConfig.userPoolClientId,
          loginWith: {
            oauth: {
              domain: baseConfig.oauthDomain,
              scopes: ["openid", "email", "profile"],
              redirectSignIn: ["https://app.example.com/callback"],
              redirectSignOut: ["https://app.example.com/callback"],
              responseType: "code",
            },
          },
        },
      },
    });
  });
});

describe("validateAuthConfig", () => {
  it("does not throw for valid config", () => {
    expect(() => validateAuthConfig(baseConfig)).not.toThrow();
  });

  it("throws when userPoolId is empty", () => {
    expect(() => validateAuthConfig({ ...baseConfig, userPoolId: "" })).toThrow(
      "VITE_USER_POOL_ID is not configured",
    );
  });

  it("throws when userPoolClientId is empty", () => {
    expect(() =>
      validateAuthConfig({ ...baseConfig, userPoolClientId: "" }),
    ).toThrow("VITE_USER_POOL_CLIENT_ID is not configured");
  });

  it("throws when oauthDomain is empty", () => {
    expect(() =>
      validateAuthConfig({ ...baseConfig, oauthDomain: "" }),
    ).toThrow("VITE_COGNITO_DOMAIN is not configured");
  });
});

describe("configureAmplify", () => {
  it("configures Amplify with normalized origin", () => {
    configureAmplify(baseConfig, "https://app.example.com");

    expect(mockConfigure).toHaveBeenCalledWith(
      buildAmplifyConfig(baseConfig, "https://app.example.com"),
    );
  });

  it("uses window.location.origin when origin is not provided", () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: { origin: "https://fallback.example.com" },
    } as unknown as Window & typeof globalThis.window;

    configureAmplify(baseConfig);

    expect(mockConfigure).toHaveBeenCalledWith(
      buildAmplifyConfig(baseConfig, "https://fallback.example.com"),
    );

    globalThis.window = originalWindow;
  });

  it("throws when origin cannot be determined", () => {
    const originalWindow = globalThis.window;
    (globalThis as unknown as { window?: Window }).window = undefined;

    expect(() => configureAmplify(baseConfig)).toThrow(
      "Cannot configure Amplify without an origin",
    );

    globalThis.window = originalWindow;
  });
});

describe("parseCallbackCode", () => {
  it("returns the code query parameter", () => {
    expect(parseCallbackCode("?code=abc123&state=xyz")).toBe("abc123");
  });

  it("returns null when code is missing", () => {
    expect(parseCallbackCode("?state=xyz")).toBeNull();
  });

  it("returns null for empty search", () => {
    expect(parseCallbackCode("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/web
bun run test src/lib/auth.test.ts
```

Expected: FAIL — `parseCallbackCode` is not defined and `buildRedirectUrls` assertions fail.

- [ ] **Step 3: Implement the changes**

Modify `apps/web/src/lib/auth.ts`:

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
  const callbackUrl = `${normalizedOrigin}callback`;
  return {
    redirectSignIn: [callbackUrl],
    redirectSignOut: [callbackUrl],
  };
}

export function normalizeOAuthDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "");
}

export function parseCallbackCode(search: string): string | null {
  return new URLSearchParams(search).get("code");
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

Modify `sst.config.ts` callback URLs:

```typescript
const callbackUrls = ((): string[] => {
  if (isCustomDomainStage && baseDomain) {
    return [`https://app.${stagePrefix}${baseDomain}/callback`];
  }
  return ["http://localhost:5173/callback"];
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/web
bun run test src/lib/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/lib/auth.test.ts sst.config.ts
git commit -m "feat(web): use /callback as cognito oauth callback url and add code parser"
```

---

## Task 2: 实现带 Token 注入、自动刷新与 401 重定向的 API 客户端

> Covers: Scenario 2（401 时重定向到登录）, Scenario 3（刷新过期的 Access Token）

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `VITE_API_URL` env, `fetchAuthSession` / `signInWithRedirect` from `aws-amplify/auth`
- Produces: `getAuthToken(): Promise<string | null>`; `apiClient<T>(path, options?): Promise<T>`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/api.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, getAuthToken } from "./api";

const { mockFetchAuthSession, mockSignInWithRedirect } = vi.hoisted(() => ({
  mockFetchAuthSession: vi.fn(),
  mockSignInWithRedirect: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: mockFetchAuthSession,
  signInWithRedirect: mockSignInWithRedirect,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("getAuthToken", () => {
  it("returns the access token string when session exists", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: { accessToken: "access-token-123" },
    });

    const token = await getAuthToken();

    expect(token).toBe("access-token-123");
  });

  it("returns null when tokens are missing", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    const token = await getAuthToken();

    expect(token).toBeNull();
  });

  it("returns null when fetchAuthSession throws", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("no session"));

    const token = await getAuthToken();

    expect(token).toBeNull();
  });
});

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("throws when VITE_API_URL is not configured", async () => {
    vi.unstubAllEnvs();

    await expect(apiClient("/lists")).rejects.toThrow(
      "VITE_API_URL is not configured",
    );
  });

  it("sends Authorization header with access token", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: { accessToken: "token-abc" },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiClient("/lists");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/lists",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("omits Authorization header when no token is available", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiClient("/lists");

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
  });

  it("sets Content-Type to application/json when body is provided", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "1" }),
    });

    await apiClient("/lists", {
      method: "POST",
      body: JSON.stringify({ name: "购物" }),
    });

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("preserves custom Content-Type header", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiClient("/lists", {
      method: "POST",
      body: "text payload",
      headers: { "Content-Type": "text/plain" },
    });

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Content-Type")).toBe("text/plain");
  });

  it("returns parsed JSON on success", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ lists: [] }),
    });

    const result = await apiClient("/lists");

    expect(result).toEqual({ lists: [] });
  });

  it("redirects to login and throws on 401", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: { accessToken: "expired-token" },
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(apiClient("/lists")).rejects.toThrow(
      "Unauthorized: redirecting to login",
    );
    expect(mockSignInWithRedirect).toHaveBeenCalledWith();
  });

  it("throws on other non-ok responses", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(apiClient("/lists")).rejects.toThrow(
      "API request failed: 500 Internal Server Error",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/web
bun run test src/lib/api.test.ts
```

Expected: FAIL — `apiClient` and `getAuthToken` are not defined.

- [ ] **Step 3: Implement the API client**

Create `apps/web/src/lib/api.ts`:

```typescript
import { fetchAuthSession, signInWithRedirect } from "aws-amplify/auth";

export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    return accessToken ? accessToken.toString() : null;
  } catch {
    return null;
  }
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    throw new Error("VITE_API_URL is not configured");
  }

  const token = await getAuthToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (response.status === 401) {
    await signInWithRedirect();
    throw new Error("Unauthorized: redirecting to login");
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`API request failed: ${response.status} ${bodyText}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/web
bun run test src/lib/api.test.ts
```

Expected: PASS with 100% coverage for `api.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add api client with token injection and 401 redirect"
```

---

## Task 3: 改造 `/callback` 路由以解析 code 并跳转回首页

> Covers: Scenario 1（处理 OAuth 回调）

**Files:**
- Modify: `apps/web/src/routes/callback.tsx`
- Modify: `apps/web/src/routes/callback.test.tsx`

**Interfaces:**
- Consumes: `parseCallbackCode` from `@/lib/auth`, `fetchAuthSession` from `aws-amplify/auth`, `useLocation`/`useNavigate` from TanStack Router
- Produces: `CallbackPage` component that redirects to `/` after session is established

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/routes/callback.test.tsx`:

```typescript
import { CallbackPage } from "@/routes/callback";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockNavigate, mockUseLocation } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>(
      "@tanstack/react-router",
    );
  return {
    ...actual,
    useLocation: mockUseLocation,
    useNavigate: () => mockNavigate,
  };
});

const { mockFetchAuthSession } = vi.hoisted(() => ({
  mockFetchAuthSession: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: mockFetchAuthSession,
  signInWithRedirect: vi.fn(),
}));

function renderCallback(search: string) {
  mockUseLocation.mockReturnValue({ search } as unknown as ReturnType<
    typeof mockUseLocation
  >);
  return render(<CallbackPage />);
}

describe("CallbackPage", () => {
  it("shows loading state while processing the code", () => {
    mockFetchAuthSession.mockImplementation(() => new Promise(() => {}));

    renderCallback("?code=abc123");

    expect(screen.getByText("正在完成登录…")).toBeInTheDocument();
  });

  it("navigates to home after session is established", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    renderCallback("?code=abc123");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("shows error and login button when code is missing", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    renderCallback("");

    expect(await screen.findByText(/缺少授权码/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录" }),
    ).toBeInTheDocument();
  });

  it("shows error message when session fetch fails", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("invalid session"));

    renderCallback("?code=abc123");

    expect(await screen.findByText(/invalid session/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录" }),
    ).toBeInTheDocument();
  });

  it("shows generic error when rejection is not an Error", async () => {
    mockFetchAuthSession.mockRejectedValue("unknown failure");

    renderCallback("?code=abc123");

    expect(await screen.findByText(/登录失败/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/web
bun run test src/routes/callback.test.tsx
```

Expected: FAIL — `CallbackPage` export shape or behavior does not match.

- [ ] **Step 3: Implement the callback route**

Replace `apps/web/src/routes/callback.tsx`:

```typescript
import { LoginButton } from "@/components/LoginButton";
import { parseCallbackCode } from "@/lib/auth";
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { fetchAuthSession } from "aws-amplify/auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/callback")({
  component: CallbackPage,
});

export function CallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const code = parseCallbackCode(location.search);
    if (!code) {
      setError("缺少授权码");
      setProcessing(false);
      return;
    }

    fetchAuthSession()
      .then(() => {
        navigate({ to: "/" });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "登录失败");
      })
      .finally(() => {
        setProcessing(false);
      });
  }, [location.search, navigate]);

  if (processing) {
    return <div className="p-4">正在完成登录…</div>;
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-red-600">登录失败：{error}</div>
        <LoginButton />
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/web
bun run test src/routes/callback.test.tsx
```

Expected: PASS with 100% coverage for `callback.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/callback.tsx apps/web/src/routes/callback.test.tsx
git commit -m "feat(web): handle cognito callback code and redirect to home"
```

---

## Verification

After all tasks are complete, run the full verification suite from the repository root:

```bash
# 1. Format and lint
bunx @biomejs/biome check --write

# 2. Type check (tsgo preferred, fallback to tsc)
bunx tsgo || bun run typecheck

# 3. Run all tests with coverage
bun run test
```

Expected outcomes:
- Biome reports no errors.
- Type check passes.
- All tests pass and coverage remains 100% for statements, branches, functions, and lines.

If any test fails, fix it before marking the ticket done.

---

## Ticket / Source Sync Notes

During planning, the following decisions were clarified and should be reflected in the ticket/source if they are not already:

1. **Callback URL path**: The dedicated `/callback` route introduced in ticket 004 is now the actual OAuth callback destination. `sst.config.ts` `callbackUrls` and `apps/web/src/lib/auth.ts` `buildRedirectUrls` must output `.../callback` instead of the origin root.
2. **Token storage**: AWS Amplify Auth automatically stores tokens after Cognito redirects back; the frontend does not manually persist tokens. The callback route only verifies the session via `fetchAuthSession` and then navigates to `/`.
3. **Token refresh**: `fetchAuthSession` handles access-token refresh automatically when a refresh token is available; the `apiClient` relies on this behavior rather than implementing a separate refresh flow.
4. **401 handling**: When any API request returns 401, the frontend immediately redirects the user back to Cognito Hosted UI via `signInWithRedirect`.

If these decisions are acceptable, update `ticket.md` scope/acceptance criteria notes accordingly (no scope change, only clarification).

---

## Execution Handoff

**Plan complete and saved to `tickets/005-实现cognito登录回调与401重定向处理/plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you like?
