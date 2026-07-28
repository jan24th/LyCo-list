import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  getNotificationById: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("./db.js", () => ({
  ...dbMock,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

import { ValidationError, encodeCursor } from "@lyco/shared";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import {
  ConflictError as DbConflictError,
  NotFoundError as DbNotFoundError,
} from "./db.js";
import { handler } from "./index.js";

const NOTIFICATION_ID = "7cb8c922-aebd-22e2-91c5-11d15ee541d9";
const SECOND_NOTIFICATION_ID = "8dc9d033-bfce-43f3-a2d6-22e26ff652ea";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const NOW = "2026-01-01T00:00:00.000Z";

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
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 1767225600000,
      accountId: "",
      apiId: "",
      authorizer: {
        principalId: "current-user",
        integrationLatency: 0,
        jwt: {
          claims: { sub: USER_ID },
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

const mockNotification = {
  id: NOTIFICATION_ID,
  type: "assignment" as const,
  recipientId: USER_ID,
  taskId: TASK_ID,
  taskTitle: "买牛奶",
  message: "你被分配了一个新任务",
  isRead: false,
  version: 1,
  createdAt: NOW,
};

describe("notifications handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date(NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("GET /api/notifications", () => {
    it("returns notifications list with 200", async () => {
      dbMock.listNotifications.mockResolvedValueOnce({
        items: [mockNotification],
      });

      const event = createEvent("GET", "/api/notifications");
      const response = await invokeHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(NOTIFICATION_ID);
      expect(dbMock.listNotifications).toHaveBeenCalledWith(
        USER_ID,
        50,
        undefined,
      );
    });

    it("returns cursor when more items exist", async () => {
      const cursorKey = { PK: "next", SK: "next" };
      dbMock.listNotifications.mockResolvedValueOnce({
        items: [mockNotification],
        nextCursor: cursorKey,
      });

      const event = createEvent("GET", "/api/notifications");
      const response = await invokeHandler(event);

      const body = JSON.parse(response.body ?? "{}");
      expect(body.nextCursor).toBe(encodeCursor(cursorKey));
    });

    it("supports limit and cursor query parameters", async () => {
      dbMock.listNotifications.mockResolvedValueOnce({ items: [] });

      const event = createEvent("GET", "/api/notifications", {
        query: { limit: "10", cursor: encodeCursor({ PK: "x", SK: "y" }) },
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      expect(dbMock.listNotifications).toHaveBeenCalledWith(USER_ID, 10, {
        PK: "x",
        SK: "y",
      });
    });

    it("returns 400 when limit is not a valid number", async () => {
      const event = createEvent("GET", "/api/notifications", {
        query: { limit: "not-a-number" },
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body ?? "{}").code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid cursor", async () => {
      const event = createEvent("GET", "/api/notifications", {
        query: { cursor: "not-valid-base64" },
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body ?? "{}").code).toBe("INVALID_CURSOR");
    });
  });

  describe("PATCH /api/notifications/{id}/read", () => {
    it("marks notification as read and returns 200", async () => {
      const readNotification = {
        ...mockNotification,
        isRead: true,
        readAt: NOW,
        version: 2,
      };
      dbMock.markNotificationRead.mockResolvedValueOnce(readNotification);

      const event = createEvent(
        "PATCH",
        `/api/notifications/${NOTIFICATION_ID}/read`,
        {
          body: JSON.stringify({ expectedVersion: 1 }),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.isRead).toBe(true);
      expect(body.version).toBe(2);
      expect(dbMock.markNotificationRead).toHaveBeenCalledWith(
        NOTIFICATION_ID,
        1,
        NOW,
      );
    });

    it("returns 400 when expectedVersion is missing", async () => {
      const event = createEvent(
        "PATCH",
        `/api/notifications/${NOTIFICATION_ID}/read`,
        {
          body: JSON.stringify({}),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid body", async () => {
      const event = createEvent(
        "PATCH",
        `/api/notifications/${NOTIFICATION_ID}/read`,
        {
          body: "not json",
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
    });

    it("returns 409 on version conflict", async () => {
      dbMock.markNotificationRead.mockRejectedValueOnce(
        new DbConflictError("version mismatch"),
      );

      const event = createEvent(
        "PATCH",
        `/api/notifications/${NOTIFICATION_ID}/read`,
        {
          body: JSON.stringify({ expectedVersion: 1 }),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(409);
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unknown method", async () => {
      const event = createEvent("POST", "/api/notifications");
      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(404);
    });

    it("returns 404 for unknown path", async () => {
      const event = createEvent("GET", "/api/something-else");
      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(404);
    });
  });

  describe("error handling", () => {
    it("returns 500 on unknown errors", async () => {
      dbMock.listNotifications.mockRejectedValueOnce(
        new Error("something went wrong"),
      );

      const event = createEvent("GET", "/api/notifications");
      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(500);
    });
  });
});
