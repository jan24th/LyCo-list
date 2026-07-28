import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.hoisted(() =>
  vi.fn(() => "7cb8c922-aebd-22e2-91c5-11d15ee541d9"),
);

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}));

const dbMock = vi.hoisted(() => ({
  createReminder: vi.fn(),
  getRemindersByTask: vi.fn(),
  getReminderById: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
  processDueReminders: vi.fn(),
}));

vi.mock("./db.js", () => ({
  ...dbMock,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

import { ValidationError, encodeCursor } from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  ConflictError as DbConflictError,
  NotFoundError as DbNotFoundError,
} from "./db.js";
import { handler } from "./index.js";

const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const REMINDER_ID = "7cb8c922-aebd-22e2-91c5-11d15ee541d9";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const NOW = "2026-01-01T00:00:00.000Z";
const TRIGGER_AT = "2026-01-15T08:00:00.000Z";

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

const mockReminder = {
  id: REMINDER_ID,
  taskId: TASK_ID,
  triggerAt: TRIGGER_AT,
  recurrence: "none" as const,
  timeZone: "Asia/Shanghai",
  isEnabled: true,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  createdBy: USER_ID,
  updatedBy: USER_ID,
};

describe("reminders handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date(NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST /api/tasks/{taskId}/reminders", () => {
    it("creates a reminder and returns 201", async () => {
      dbMock.createReminder.mockResolvedValueOnce(mockReminder);

      const event = createEvent("POST", `/api/tasks/${TASK_ID}/reminders`, {
        body: JSON.stringify({
          taskId: TASK_ID,
          triggerAt: TRIGGER_AT,
          timeZone: "Asia/Shanghai",
        }),
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.id).toBe(REMINDER_ID);
      expect(dbMock.createReminder).toHaveBeenCalledTimes(1);
    });

    it("returns 400 for invalid body", async () => {
      const event = createEvent("POST", `/api/tasks/${TASK_ID}/reminders`, {
        body: "not json",
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
    });

    it("returns 404 when task not found", async () => {
      dbMock.createReminder.mockRejectedValueOnce(
        new DbNotFoundError("Task not found"),
      );

      const event = createEvent("POST", `/api/tasks/${TASK_ID}/reminders`, {
        body: JSON.stringify({
          taskId: TASK_ID,
          triggerAt: TRIGGER_AT,
          timeZone: "Asia/Shanghai",
        }),
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/tasks/{taskId}/reminders", () => {
    it("returns reminders list with 200", async () => {
      dbMock.getRemindersByTask.mockResolvedValueOnce({
        items: [mockReminder],
      });

      const event = createEvent("GET", `/api/tasks/${TASK_ID}/reminders`);

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(REMINDER_ID);
    });

    it("returns cursor when more items exist", async () => {
      const cursor = { PK: "next", SK: "next" };
      dbMock.getRemindersByTask.mockResolvedValueOnce({
        items: [mockReminder],
        nextCursor: cursor,
      });

      const event = createEvent("GET", `/api/tasks/${TASK_ID}/reminders`);

      const response = await invokeHandler(event);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.nextCursor).toBe(encodeCursor(cursor));
    });

    it("supports limit and cursor query parameters", async () => {
      dbMock.getRemindersByTask.mockResolvedValueOnce({ items: [] });

      const event = createEvent("GET", `/api/tasks/${TASK_ID}/reminders`, {
        query: { limit: "10", cursor: encodeCursor({ PK: "x", SK: "y" }) },
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      expect(dbMock.getRemindersByTask).toHaveBeenCalledWith(TASK_ID, 10, {
        PK: "x",
        SK: "y",
      });
    });
  });

  describe("PATCH /api/tasks/{taskId}/reminders/{id}", () => {
    it("updates a reminder and returns 200", async () => {
      const updated = { ...mockReminder, isEnabled: false, version: 2 };
      dbMock.updateReminder.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
        {
          body: JSON.stringify({
            isEnabled: false,
            expectedVersion: 1,
          }),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.isEnabled).toBe(false);
      expect(body.version).toBe(2);
    });

    it("returns 409 on version conflict", async () => {
      dbMock.updateReminder.mockRejectedValueOnce(
        new DbConflictError("version mismatch"),
      );

      const event = createEvent(
        "PATCH",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
        {
          body: JSON.stringify({
            isEnabled: false,
            expectedVersion: 1,
          }),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(409);
    });

    it("returns 404 when reminder not found", async () => {
      dbMock.updateReminder.mockRejectedValueOnce(
        new DbNotFoundError("not found"),
      );

      const event = createEvent(
        "PATCH",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
        {
          body: JSON.stringify({
            isEnabled: false,
            expectedVersion: 1,
          }),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(404);
    });

    it("returns 400 when expectedVersion is missing", async () => {
      const event = createEvent(
        "PATCH",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
        {
          body: JSON.stringify({ isEnabled: false }),
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/tasks/{taskId}/reminders/{id}", () => {
    it("deletes a reminder and returns 200", async () => {
      dbMock.deleteReminder.mockResolvedValueOnce({ id: REMINDER_ID });

      const event = createEvent(
        "DELETE",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
        {
          query: { expectedVersion: "1" },
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
    });

    it("returns 409 on version conflict", async () => {
      dbMock.deleteReminder.mockRejectedValueOnce(
        new DbConflictError("version mismatch"),
      );

      const event = createEvent(
        "DELETE",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
        {
          query: { expectedVersion: "1" },
        },
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(409);
    });

    it("returns 400 when expectedVersion is missing", async () => {
      const event = createEvent(
        "DELETE",
        `/api/tasks/${TASK_ID}/reminders/${REMINDER_ID}`,
      );

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/reminders/process-due", () => {
    it("processes due reminders and returns 200", async () => {
      dbMock.processDueReminders.mockResolvedValueOnce({
        processedCount: 3,
        nextCursor: { PK: "next", SK: "next" },
      });

      const event = createEvent("POST", "/api/reminders/process-due");

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body ?? "{}");
      expect(body.processedCount).toBe(3);
      expect(body.nextCursor).toBeDefined();
    });

    it("returns 200 with zero when nothing due", async () => {
      dbMock.processDueReminders.mockResolvedValueOnce({
        processedCount: 0,
      });

      const event = createEvent("POST", "/api/reminders/process-due");

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body ?? "{}").processedCount).toBe(0);
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unknown method", async () => {
      const event = createEvent("PUT", `/api/tasks/${TASK_ID}/reminders`);

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(404);
    });

    it("returns 404 for unknown path", async () => {
      const event = createEvent("GET", "/api/reminders");

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(404);
    });
  });

  describe("error handling", () => {
    it("returns 400 on ValidationError", async () => {
      dbMock.createReminder.mockRejectedValueOnce(
        new ValidationError("Invalid input"),
      );

      const event = createEvent("POST", `/api/tasks/${TASK_ID}/reminders`, {
        body: JSON.stringify({
          taskId: TASK_ID,
          triggerAt: TRIGGER_AT,
          timeZone: "Asia/Shanghai",
        }),
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(400);
    });

    it("returns 500 on unknown errors", async () => {
      dbMock.createReminder.mockRejectedValueOnce(
        new Error("something went wrong"),
      );

      const event = createEvent("POST", `/api/tasks/${TASK_ID}/reminders`, {
        body: JSON.stringify({
          taskId: TASK_ID,
          triggerAt: TRIGGER_AT,
          timeZone: "Asia/Shanghai",
        }),
      });

      const response = await invokeHandler(event);
      expect(response.statusCode).toBe(500);
    });
  });
});
