import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.hoisted(() =>
  vi.fn(() => "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
);

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}));

const dbMock = vi.hoisted(() => ({
  createList: vi.fn(),
  queryActiveLists: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  restoreList: vi.fn(),
}));

vi.mock("./db.js", () => ({
  ...dbMock,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

import { encodeCursor } from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import { ConflictError, NotFoundError } from "./db.js";
import { handler } from "./index.js";

function createEvent(
  method: string,
  path: string,
  options: {
    query?: Record<string, string>;
    body?: string;
  } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: {},
    queryStringParameters: options.query ?? {},
    body: options.body ?? undefined,
    requestContext: {
      domainName: "",
      domainPrefix: "",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: `${method} ${path}`,
      stage: "dev",
      time: "14/Jul/2026:00:00:00 +0000",
      timeEpoch: 1752460800000,
      accountId: "",
      apiId: "",
      authorizer: {
        principalId: "current-user",
        integrationLatency: 0,
        jwt: {
          claims: { sub: "d92a155c-70a1-70cf-8bd5-0dd5d4772093" },
          scopes: [],
        },
      },
    },
    isBase64Encoded: false,
  };
}

async function invokeHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const result = await handler(event, {} as never, () => {});
  if (typeof result === "string" || result === undefined) {
    throw new Error("expected object response");
  }
  return result;
}

const mockList = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "购物",
  color: "#3b82f6",
  icon: "list",
  order: 0,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
  updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
};

describe("lists handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    for (const mock of Object.values(dbMock)) {
      mock.mockReset();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a list", async () => {
    dbMock.createList.mockResolvedValueOnce(mockList);

    const result = await invokeHandler(
      createEvent("POST", "/api/lists", {
        body: JSON.stringify({ name: "购物" }),
      }),
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.name).toBe("购物");
    expect(dbMock.createList).toHaveBeenCalledWith(
      { name: "购物", color: "#3b82f6", icon: "list", order: 0 },
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        userId: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
        now: "2026-01-01T00:00:00.000Z",
      },
    );
  });

  it("returns 400 for invalid create body", async () => {
    const result = await invokeHandler(
      createEvent("POST", "/api/lists", {
        body: JSON.stringify({ name: "" }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("lists active lists with pagination", async () => {
    dbMock.queryActiveLists.mockResolvedValueOnce({
      items: [mockList],
      nextCursor: { PK: "LIST#x", SK: "METADATA" },
    });

    const result = await invokeHandler(
      createEvent("GET", "/api/lists", { query: { limit: "10" } }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.items).toEqual([mockList]);
    expect(body.nextCursor).toBe(
      encodeCursor({ PK: "LIST#x", SK: "METADATA" }),
    );
    expect(dbMock.queryActiveLists).toHaveBeenCalledWith(10, undefined);
  });

  it("returns 400 for invalid cursor", async () => {
    const result = await invokeHandler(
      createEvent("GET", "/api/lists", { query: { cursor: "!!!" } }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("INVALID_CURSOR");
  });

  it("resumes from valid cursor", async () => {
    dbMock.queryActiveLists.mockResolvedValueOnce({ items: [] });
    const cursor = encodeCursor({ PK: "LIST#x", SK: "METADATA" });

    await invokeHandler(
      createEvent("GET", "/api/lists", { query: { cursor } }),
    );

    expect(dbMock.queryActiveLists).toHaveBeenCalledWith(50, {
      PK: "LIST#x",
      SK: "METADATA",
    });
  });

  it("updates a list", async () => {
    dbMock.updateList.mockResolvedValueOnce({
      ...mockList,
      name: "新名称",
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("PATCH", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        body: JSON.stringify({ name: "新名称", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.name).toBe("新名称");
    expect(dbMock.updateList).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      { name: "新名称" },
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("returns 400 for missing expectedVersion in update", async () => {
    const result = await invokeHandler(
      createEvent("PATCH", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        body: JSON.stringify({ name: "x" }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("soft deletes a list", async () => {
    dbMock.deleteList.mockResolvedValueOnce({
      ...mockList,
      deletedAt: "2026-01-01T00:00:00.000Z",
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("DELETE", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        query: { expectedVersion: "1" },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.deletedAt).toBeDefined();
    expect(dbMock.deleteList).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      1,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("returns 400 for missing expectedVersion in delete", async () => {
    const result = await invokeHandler(
      createEvent("DELETE", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("restores a list", async () => {
    dbMock.restoreList.mockResolvedValueOnce({ ...mockList, version: 3 });

    const result = await invokeHandler(
      createEvent(
        "POST",
        "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/restore",
        {
          body: JSON.stringify({ expectedVersion: 2 }),
        },
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(dbMock.restoreList).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      2,
      "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("returns 409 on conflict error", async () => {
    dbMock.updateList.mockRejectedValueOnce(
      new ConflictError("version mismatch"),
    );
    const result = await invokeHandler(
      createEvent("PATCH", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        body: JSON.stringify({ name: "x", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body ?? "{}").code).toBe("CONFLICT");
  });

  it("returns 404 on not found", async () => {
    dbMock.deleteList.mockRejectedValueOnce(new NotFoundError("not found"));
    const result = await invokeHandler(
      createEvent("DELETE", "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", {
        query: { expectedVersion: "1" },
      }),
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body ?? "{}").code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid JSON body", async () => {
    const result = await invokeHandler(
      createEvent("POST", "/api/lists", { body: "not-json" }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is missing", async () => {
    const result = await invokeHandler(
      createEvent(
        "POST",
        "/api/lists/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/restore",
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown route", async () => {
    const result = await invokeHandler(
      createEvent("GET", "/api/lists/unknown/route"),
    );
    expect(result.statusCode).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    dbMock.queryActiveLists.mockRejectedValueOnce(new Error("boom"));
    const result = await invokeHandler(createEvent("GET", "/api/lists"));
    expect(result.statusCode).toBe(500);
  });

  it("falls back to unknown user id when sub is missing", async () => {
    const event = createEvent("GET", "/api/lists");
    (event.requestContext.authorizer.jwt.claims as { sub?: unknown }).sub =
      undefined;
    dbMock.queryActiveLists.mockResolvedValueOnce({ items: [] });

    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
  });

  it("falls back to unknown user id when sub is not a string", async () => {
    const event = createEvent("GET", "/api/lists");
    (event.requestContext.authorizer.jwt.claims as { sub?: unknown }).sub = 123;
    dbMock.queryActiveLists.mockResolvedValueOnce({ items: [] });

    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
  });

  it("is typed as APIGatewayProxyHandlerV2WithJWTAuthorizer", () => {
    const typed: APIGatewayProxyHandlerV2WithJWTAuthorizer = handler;
    expect(typed).toBeDefined();
  });
});
