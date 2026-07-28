import { randomUUID } from "node:crypto";
import {
  ConflictError,
  CursorError,
  type CursorKey,
  NotFoundError,
  ValidationError,
  buildResponse,
  decodeCursor,
  encodeCursor,
  errorResponse,
  moveTaskInputSchema,
  parseRequest,
  taskCompleteBodySchema,
  taskDeleteQuerySchema,
  taskInputSchema,
  taskQuerySchema,
  taskRestoreBodySchema,
  taskUpdateBodySchema,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  completeTask,
  createTask,
  deleteTask,
  getTaskTree,
  moveTask,
  queryTasksByList,
  restoreTask,
  updateTask,
} from "./db.js";

function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return typeof event.requestContext.authorizer.jwt.claims.sub === "string"
    ? event.requestContext.authorizer.jwt.claims.sub
    : "unknown";
}

function parseBody(body: string | undefined): unknown {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const userId = getUserId(event);
    const now = new Date().toISOString();

    if (method === "GET" && path === "/api/tasks") {
      const query = parseRequest(taskQuerySchema, {
        listId: event.queryStringParameters?.listId,
        limit: event.queryStringParameters?.limit,
        cursor: event.queryStringParameters?.cursor,
      });
      let startKey: CursorKey | undefined;
      if (query.cursor) {
        startKey = decodeCursor(query.cursor);
      }
      const result = await queryTasksByList(
        query.listId,
        query.limit,
        startKey,
      );
      return buildResponse(200, {
        items: result.items,
        ...(result.nextCursor
          ? { nextCursor: encodeCursor(result.nextCursor) }
          : {}),
      });
    }

    if (method === "POST" && path === "/api/tasks") {
      const body = parseRequest(taskInputSchema, parseBody(event.body));
      const task = await createTask(body, {
        id: randomUUID(),
        userId,
        now,
      });
      return buildResponse(201, task);
    }

    const actionMatch =
      /^\/api\/tasks\/([0-9a-f-]+)\/(complete|restore|move)$/.exec(path);
    if (method === "POST" && actionMatch) {
      const [, id, action] = actionMatch;
      if (action === "complete") {
        const body = parseRequest(
          taskCompleteBodySchema,
          parseBody(event.body),
        );
        const task = await completeTask(id, body.expectedVersion, userId, now);
        return buildResponse(200, task);
      }
      if (action === "restore") {
        const body = parseRequest(taskRestoreBodySchema, parseBody(event.body));
        const task = await restoreTask(id, body.expectedVersion, userId, now);
        return buildResponse(200, task);
      }
      const body = parseRequest(moveTaskInputSchema, parseBody(event.body));
      const { expectedVersion, ...input } = body;
      const task = await moveTask(id, input, expectedVersion, userId, now);
      return buildResponse(200, task);
    }

    const singleMatch = /^\/api\/tasks\/([0-9a-f-]+)$/.exec(path);
    if (singleMatch) {
      const id = singleMatch[1];

      if (method === "GET") {
        const tree = await getTaskTree(id);
        if (!tree) {
          return errorResponse(`Task ${id} not found`, "NOT_FOUND", 404);
        }
        return buildResponse(200, tree);
      }

      if (method === "PATCH") {
        const body = parseRequest(taskUpdateBodySchema, parseBody(event.body));
        const { expectedVersion, ...input } = body;
        const task = await updateTask(id, input, expectedVersion, userId, now);
        return buildResponse(200, task);
      }

      if (method === "DELETE") {
        const query = parseRequest(taskDeleteQuerySchema, {
          expectedVersion: event.queryStringParameters?.expectedVersion,
        });
        const task = await deleteTask(id, query.expectedVersion, userId, now);
        return buildResponse(200, task);
      }
    }

    return buildResponse(404, { error: "Not found" });
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(error.message, "VALIDATION_ERROR", 400);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, "NOT_FOUND", 404);
    }
    if (error instanceof ConflictError) {
      return errorResponse(error.message, "CONFLICT", 409);
    }
    if (error instanceof CursorError) {
      return errorResponse(error.message, "INVALID_CURSOR", 400);
    }
    console.error(error);
    return errorResponse("failed to process task request");
  }
};
