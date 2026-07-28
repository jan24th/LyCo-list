import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("./db.js", () => dbMock);

import { encodeCursor } from "@lyco/shared";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { handler } from "./index.js";

function createEvent(
  path: string,
  queryParams?: Record<string, string>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const url = new URL(`http://localhost${path}`);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v);
    }
  }
  return {
    version: "2.0",
    routeKey: `GET ${path}`,
    rawPath: path,
    rawQueryString: url.search,
    headers: {},
    queryStringParameters: queryParams ?? {},
    body: undefined,
    requestContext: {
      domainName: "",
      domainPrefix: "",
      http: {
        method: "GET",
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: `GET ${path}`,
      stage: "dev",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 1767225600000,
      accountId: "",
      apiId: "",
      authorizer: {
        principalId: "current-user",
        integrationLatency: 0,
        jwt: {
          claims: { sub: "user-1" },
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

describe("search handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results with 200", async () => {
    dbMock.search.mockResolvedValueOnce({
      items: [
        {
          type: "task",
          id: "t1",
          title: "买牛奶",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          type: "list",
          id: "l1",
          title: "购物清单",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });

    const event = createEvent("/api/search", { q: "牛奶" });
    const response = await invokeHandler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body ?? "{}");
    expect(body.items).toHaveLength(2);
    expect(body.items[0].type).toBe("task");
    expect(dbMock.search).toHaveBeenCalledWith("牛奶", 50, undefined);
  });

  it("returns nextCursor when present", async () => {
    const cursor = { offset: 10 };
    dbMock.search.mockResolvedValueOnce({
      items: [{ type: "task", id: "t1", title: "x", updatedAt: "t" }],
      nextCursor: cursor,
    });

    const event = createEvent("/api/search", { q: "x" });
    const response = await invokeHandler(event);

    const body = JSON.parse(response.body ?? "{}");
    expect(body.nextCursor).toBe(encodeCursor(cursor));
  });

  it("passes limit and cursor parameters", async () => {
    dbMock.search.mockResolvedValueOnce({ items: [] });
    const cursorStr = encodeCursor({ offset: 20 });

    const event = createEvent("/api/search", {
      q: "test",
      limit: "10",
      cursor: cursorStr,
    });
    await invokeHandler(event);

    expect(dbMock.search).toHaveBeenCalledWith("test", 10, { offset: 20 });
  });

  it("returns 400 when q is missing", async () => {
    const event = createEvent("/api/search");
    const response = await invokeHandler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid cursor", async () => {
    const event = createEvent("/api/search", { q: "test", cursor: "!!!" });
    const response = await invokeHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for non-GET method", async () => {
    const event = createEvent("/api/search");
    event.requestContext.http.method = "POST";

    const response = await invokeHandler(event);
    expect(response.statusCode).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    dbMock.search.mockRejectedValueOnce(new Error("boom"));

    const event = createEvent("/api/search", { q: "test" });
    const response = await invokeHandler(event);

    expect(response.statusCode).toBe(500);
  });
});
