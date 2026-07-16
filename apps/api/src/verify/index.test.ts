import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handler } from "./index";

function createVerifyEvent(
  userId?: string,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const event = {
    version: "2.0",
    routeKey: "GET /api/verify",
    rawPath: "/api/verify",
    rawQueryString: "",
    headers: {},
    requestContext: {
      domainId: "",
      domainName: "",
      domainPrefix: "",
      http: {
        method: "GET",
        path: "/api/verify",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: "GET /api/verify",
      stage: "dev",
      time: "14/Jul/2026:00:00:00 +0000",
      timeEpoch: 1752460800000,
      accountId: "",
      apiId: "",
      authorizer: {
        principalId: userId ?? "",
        integrationLatency: 0,
        jwt: {
          claims: {
            sub: userId ?? "",
          },
          scopes: [],
        },
      },
    },
    isBase64Encoded: false,
  };

  return event;
}

async function invokeHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const result = await handler(event, {} as never, () => {});
  if (typeof result === "string" || result === undefined) {
    throw new Error("expected object response");
  }
  return result;
}

describe("verify handler", () => {
  it("returns 200 with authenticated user id", async () => {
    const event = createVerifyEvent("user-123");
    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("user-123");
  });

  it("returns unknown when authorizer claims are missing", async () => {
    const event = createVerifyEvent();
    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.userId).toBe("unknown");
  });

  it("is typed as APIGatewayProxyHandlerV2WithJWTAuthorizer", () => {
    const typed: APIGatewayProxyHandlerV2WithJWTAuthorizer = handler;
    expect(typed).toBeDefined();
  });
});
