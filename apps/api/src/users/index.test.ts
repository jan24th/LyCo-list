import { encodeCursor } from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  const event = {
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

  return event;
}

async function invokeHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
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
    // biome-ignore lint/performance/noDelete: need to actually remove the env var, not set it to "undefined"
    delete process.env.USER_POOL_ID;
  });

  it("returns mapped users from Cognito", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "alice",
          Attributes: [
            { Name: "sub", Value: "d92a155c-70a1-70cf-8bd5-0dd5d4772093" },
            { Name: "name", Value: "志辉" },
          ],
        },
        {
          Username: "bob",
          Attributes: [
            { Name: "sub", Value: "f9da35bc-a051-7055-42ec-9c75719b9a9f" },
            { Name: "name", Value: "LZH" },
          ],
        },
      ],
    });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(result.statusCode).toBe(200);
    expect(body.items).toEqual([
      { id: "d92a155c-70a1-70cf-8bd5-0dd5d4772093", name: "志辉" },
      { id: "f9da35bc-a051-7055-42ec-9c75719b9a9f", name: "LZH" },
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

  it("excludes users with invalid sub", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "invalid-sub",
          Attributes: [
            { Name: "sub", Value: "not-a-uuid" },
            { Name: "name", Value: "Invalid" },
          ],
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

  it("handles Cognito response without Users field", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toEqual([]);
  });

  it("handles attributes missing name or value", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [
        {
          Username: "missing-name",
          Attributes: [{ Value: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }],
        },
        {
          Username: "missing-value",
          Attributes: [{ Name: "sub" }],
        },
        {
          Username: "valid",
          Attributes: [
            { Name: "sub", Value: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
            { Name: "name", Value: "Valid" },
          ],
        },
      ],
    });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toEqual([
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Valid" },
    ]);
  });

  it("excludes users without Attributes field", async () => {
    sendMock.mockResolvedValueOnce({
      Users: [{ Username: "no-attributes" }],
    });

    const result = await invokeHandler(createEvent());
    const body = JSON.parse(result.body ?? "{}");

    expect(body.items).toEqual([]);
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

  it("returns 400 for cursor missing paginationToken", async () => {
    const cursor = encodeCursor({ other: "value" });
    const result = await invokeHandler(createEvent({ cursor }));
    const body = JSON.parse(result.body ?? "{}");

    expect(result.statusCode).toBe(400);
    expect(body.code).toBe("INVALID_CURSOR");
  });

  it("returns 500 when USER_POOL_ID is missing", async () => {
    // biome-ignore lint/performance/noDelete: need to actually remove the env var, not set it to "undefined"
    delete process.env.USER_POOL_ID;

    const result = await invokeHandler(createEvent());

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when Cognito call fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("Cognito down"));

    const result = await invokeHandler(createEvent());

    expect(result.statusCode).toBe(500);
  });

  it("is typed as APIGatewayProxyHandlerV2WithJWTAuthorizer", () => {
    const typed: APIGatewayProxyHandlerV2WithJWTAuthorizer = handler;
    expect(typed).toBeDefined();
  });
});
