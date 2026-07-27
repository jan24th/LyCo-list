import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.hoisted(() =>
  vi.fn(() => "6ba7b811-9dad-11d1-80b4-00c04fd430c8"),
);

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}));

const dbMock = vi.hoisted(() => ({
  createTask: vi.fn(),
  queryTasksByList: vi.fn(),
  getTaskTree: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  restoreTask: vi.fn(),
  moveTask: vi.fn(),
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
import {
  ConflictError as DbConflictError,
  NotFoundError as DbNotFoundError,
} from "./db.js";
import { handler } from "./index.js";

const LIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const USER_ID = "d92a155c-70a1-70cf-8bd5-0dd5d4772093";
const ASSIGNEE_ID = "11111111-2222-4333-8444-555555555555";
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

const mockTask = {
  id: TASK_ID,
  title: "买牛奶",
  notes: "",
  listId: LIST_ID,
  parentId: null,
  assigneeIds: [],
  isCompleted: false,
  isFlagged: false,
  priority: "none",
  recurrence: "none",
  order: 0,
  completedAt: null,
  lastCompletedAt: null,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  createdBy: USER_ID,
  updatedBy: USER_ID,
};

describe("tasks handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    for (const mock of Object.values(dbMock)) {
      mock.mockReset();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a task", async () => {
    dbMock.createTask.mockResolvedValueOnce(mockTask);

    const result = await invokeHandler(
      createEvent("POST", "/api/tasks", {
        body: JSON.stringify({ title: "买牛奶", listId: LIST_ID }),
      }),
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.title).toBe("买牛奶");
    expect(dbMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "买牛奶", listId: LIST_ID }),
      { id: TASK_ID, userId: USER_ID, now: NOW },
    );
  });

  it("creates a task with initial assignees", async () => {
    dbMock.createTask.mockResolvedValueOnce({
      ...mockTask,
      assigneeIds: [ASSIGNEE_ID],
    });

    const result = await invokeHandler(
      createEvent("POST", "/api/tasks", {
        body: JSON.stringify({
          title: "买牛奶",
          listId: LIST_ID,
          assigneeIds: [ASSIGNEE_ID],
        }),
      }),
    );

    expect(result.statusCode).toBe(201);
    expect(dbMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeIds: [ASSIGNEE_ID] }),
      { id: TASK_ID, userId: USER_ID, now: NOW },
    );
  });

  it("returns 400 for invalid create body", async () => {
    const result = await invokeHandler(
      createEvent("POST", "/api/tasks", {
        body: JSON.stringify({ title: "", listId: LIST_ID }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when the parent task does not exist", async () => {
    dbMock.createTask.mockRejectedValueOnce(
      new DbNotFoundError("parent not found"),
    );

    const result = await invokeHandler(
      createEvent("POST", "/api/tasks", {
        body: JSON.stringify({
          title: "子任务",
          listId: LIST_ID,
          parentId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        }),
      }),
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body ?? "{}").code).toBe("NOT_FOUND");
  });

  it("lists tasks of a list with pagination", async () => {
    dbMock.queryTasksByList.mockResolvedValueOnce({
      items: [mockTask],
      nextCursor: { PK: "TASK#x", SK: "METADATA" },
    });

    const result = await invokeHandler(
      createEvent("GET", "/api/tasks", {
        query: { listId: LIST_ID, limit: "10" },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.items).toEqual([mockTask]);
    expect(body.nextCursor).toBe(
      encodeCursor({ PK: "TASK#x", SK: "METADATA" }),
    );
    expect(dbMock.queryTasksByList).toHaveBeenCalledWith(
      LIST_ID,
      10,
      undefined,
    );
  });

  it("returns 400 when listId is missing", async () => {
    const result = await invokeHandler(createEvent("GET", "/api/tasks"));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid cursor", async () => {
    const result = await invokeHandler(
      createEvent("GET", "/api/tasks", {
        query: { listId: LIST_ID, cursor: "!!!" },
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("INVALID_CURSOR");
  });

  it("resumes from valid cursor", async () => {
    dbMock.queryTasksByList.mockResolvedValueOnce({ items: [] });
    const cursor = encodeCursor({ PK: "TASK#x", SK: "METADATA" });

    await invokeHandler(
      createEvent("GET", "/api/tasks", { query: { listId: LIST_ID, cursor } }),
    );

    expect(dbMock.queryTasksByList).toHaveBeenCalledWith(LIST_ID, 50, {
      PK: "TASK#x",
      SK: "METADATA",
    });
  });

  it("returns a task with its children tree", async () => {
    dbMock.getTaskTree.mockResolvedValueOnce({ ...mockTask, children: [] });

    const result = await invokeHandler(
      createEvent("GET", `/api/tasks/${TASK_ID}`),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.children).toEqual([]);
    expect(dbMock.getTaskTree).toHaveBeenCalledWith(TASK_ID);
  });

  it("returns 404 when the task does not exist", async () => {
    dbMock.getTaskTree.mockResolvedValueOnce(null);

    const result = await invokeHandler(
      createEvent("GET", `/api/tasks/${TASK_ID}`),
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body ?? "{}").code).toBe("NOT_FOUND");
  });

  it("updates a task", async () => {
    dbMock.updateTask.mockResolvedValueOnce({
      ...mockTask,
      title: "新标题",
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("PATCH", `/api/tasks/${TASK_ID}`, {
        body: JSON.stringify({ title: "新标题", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.title).toBe("新标题");
    expect(dbMock.updateTask).toHaveBeenCalledWith(
      TASK_ID,
      { title: "新标题" },
      1,
      USER_ID,
      NOW,
    );
  });

  it("updates assignees through the existing PATCH endpoint", async () => {
    dbMock.updateTask.mockResolvedValueOnce({
      ...mockTask,
      assigneeIds: [ASSIGNEE_ID],
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("PATCH", `/api/tasks/${TASK_ID}`, {
        body: JSON.stringify({
          assigneeIds: [ASSIGNEE_ID],
          expectedVersion: 1,
        }),
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(dbMock.updateTask).toHaveBeenCalledWith(
      TASK_ID,
      { assigneeIds: [ASSIGNEE_ID] },
      1,
      USER_ID,
      NOW,
    );
  });

  it("strips listId, parentId and isCompleted from updates", async () => {
    dbMock.updateTask.mockResolvedValueOnce({ ...mockTask, version: 2 });

    await invokeHandler(
      createEvent("PATCH", `/api/tasks/${TASK_ID}`, {
        body: JSON.stringify({
          title: "新标题",
          listId: LIST_ID,
          parentId: null,
          isCompleted: true,
          expectedVersion: 1,
        }),
      }),
    );

    expect(dbMock.updateTask).toHaveBeenCalledWith(
      TASK_ID,
      { title: "新标题" },
      1,
      USER_ID,
      NOW,
    );
  });

  it("rejects duplicate assignees in PATCH", async () => {
    const result = await invokeHandler(
      createEvent("PATCH", `/api/tasks/${TASK_ID}`, {
        body: JSON.stringify({
          assigneeIds: [ASSIGNEE_ID, ASSIGNEE_ID],
          expectedVersion: 1,
        }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(dbMock.updateTask).not.toHaveBeenCalled();
  });

  it("returns 400 for missing expectedVersion in update", async () => {
    const result = await invokeHandler(
      createEvent("PATCH", `/api/tasks/${TASK_ID}`, {
        body: JSON.stringify({ title: "x" }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("soft deletes a task", async () => {
    dbMock.deleteTask.mockResolvedValueOnce({
      ...mockTask,
      deletedAt: NOW,
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("DELETE", `/api/tasks/${TASK_ID}`, {
        query: { expectedVersion: "1" },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.deletedAt).toBeDefined();
    expect(dbMock.deleteTask).toHaveBeenCalledWith(TASK_ID, 1, USER_ID, NOW);
  });

  it("returns 400 for missing expectedVersion in delete", async () => {
    const result = await invokeHandler(
      createEvent("DELETE", `/api/tasks/${TASK_ID}`),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on conflict error", async () => {
    dbMock.updateTask.mockRejectedValueOnce(
      new DbConflictError("version mismatch"),
    );

    const result = await invokeHandler(
      createEvent("PATCH", `/api/tasks/${TASK_ID}`, {
        body: JSON.stringify({ title: "x", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body ?? "{}").code).toBe("CONFLICT");
  });

  it("returns 404 on not found error", async () => {
    dbMock.deleteTask.mockRejectedValueOnce(new DbNotFoundError("not found"));

    const result = await invokeHandler(
      createEvent("DELETE", `/api/tasks/${TASK_ID}`, {
        query: { expectedVersion: "1" },
      }),
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body ?? "{}").code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid JSON body", async () => {
    const result = await invokeHandler(
      createEvent("POST", "/api/tasks", { body: "not-json" }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing body on create", async () => {
    const result = await invokeHandler(createEvent("POST", "/api/tasks"));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown route", async () => {
    const result = await invokeHandler(
      createEvent("GET", "/api/tasks/unknown/route"),
    );
    expect(result.statusCode).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    dbMock.queryTasksByList.mockRejectedValueOnce(new Error("boom"));
    const result = await invokeHandler(
      createEvent("GET", "/api/tasks", { query: { listId: LIST_ID } }),
    );
    expect(result.statusCode).toBe(500);
  });

  it("falls back to unknown user id when sub is missing", async () => {
    const event = createEvent("GET", "/api/tasks", {
      query: { listId: LIST_ID },
    });
    (event.requestContext.authorizer.jwt.claims as { sub?: unknown }).sub =
      undefined;
    dbMock.queryTasksByList.mockResolvedValueOnce({ items: [] });

    const result = await invokeHandler(event);

    expect(result.statusCode).toBe(200);
  });

  it("is typed as APIGatewayProxyHandlerV2WithJWTAuthorizer", () => {
    const typed: APIGatewayProxyHandlerV2WithJWTAuthorizer = handler;
    expect(typed).toBeDefined();
  });

  it("completes a task", async () => {
    dbMock.completeTask.mockResolvedValueOnce({
      ...mockTask,
      isCompleted: true,
      completedAt: NOW,
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/complete`, {
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.isCompleted).toBe(true);
    expect(dbMock.completeTask).toHaveBeenCalledWith(TASK_ID, 1, USER_ID, NOW);
  });

  it("returns 400 for invalid complete body", async () => {
    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/complete`, {
        body: JSON.stringify({}),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when completing a missing task", async () => {
    dbMock.completeTask.mockRejectedValueOnce(
      new DbNotFoundError("task not found"),
    );

    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/complete`, {
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 409 on complete version conflict", async () => {
    dbMock.completeTask.mockRejectedValueOnce(
      new DbConflictError("version mismatch"),
    );

    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/complete`, {
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body ?? "{}").code).toBe("CONFLICT");
  });

  it("restores a completed task", async () => {
    dbMock.restoreTask.mockResolvedValueOnce({ ...mockTask, version: 3 });

    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/restore`, {
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(dbMock.restoreTask).toHaveBeenCalledWith(TASK_ID, 2, USER_ID, NOW);
  });

  it("returns 400 for invalid restore body", async () => {
    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/restore`, {
        body: JSON.stringify({}),
      }),
    );

    expect(result.statusCode).toBe(400);
  });

  it("moves a task to another list", async () => {
    dbMock.moveTask.mockResolvedValueOnce({
      ...mockTask,
      listId: "550e8400-e29b-41d4-a716-446655440001",
      version: 2,
    });

    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/move`, {
        body: JSON.stringify({
          listId: "550e8400-e29b-41d4-a716-446655440001",
          parentId: null,
          order: 5,
          expectedVersion: 1,
        }),
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body.listId).toBe("550e8400-e29b-41d4-a716-446655440001");
    expect(dbMock.moveTask).toHaveBeenCalledWith(
      TASK_ID,
      {
        listId: "550e8400-e29b-41d4-a716-446655440001",
        parentId: null,
        order: 5,
      },
      1,
      USER_ID,
      NOW,
    );
  });

  it("returns 400 for invalid move body", async () => {
    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/move`, {
        body: JSON.stringify({ listId: "not-a-uuid", expectedVersion: 1 }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? "{}").code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on move version conflict", async () => {
    dbMock.moveTask.mockRejectedValueOnce(
      new DbConflictError("version mismatch"),
    );

    const result = await invokeHandler(
      createEvent("POST", `/api/tasks/${TASK_ID}/move`, {
        body: JSON.stringify({
          listId: "550e8400-e29b-41d4-a716-446655440001",
          parentId: null,
          order: 5,
          expectedVersion: 1,
        }),
      }),
    );

    expect(result.statusCode).toBe(409);
  });
});
