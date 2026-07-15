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
      domainPrefix: "",
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

async function invokeHandler(event: APIGatewayProxyEventV2) {
  const result = await handler(event, {} as never, () => {});
  if (typeof result === "string" || result === undefined) {
    throw new Error("expected object response");
  }
  return result;
}

describe("health handler", () => {
  it("returns 200 with ok: true and timestamp", async () => {
    const event = createHealthEvent();
    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Content-Type"]).toBe("application/json");

    const body = JSON.parse(result.body ?? "{}");
    expect(body.ok).toBe(true);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.requestId).toBe("test-request-id");
  });

  it("returns 200 when requestId is missing", async () => {
    const event = createHealthEvent();
    (event.requestContext as { requestId?: string }).requestId = undefined;

    const result = await invokeHandler(event);
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
