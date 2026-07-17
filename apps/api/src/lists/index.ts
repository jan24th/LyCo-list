import { randomUUID } from "node:crypto";
import {
  type CursorKey,
  ValidationError,
  buildResponse,
  decodeCursor,
  encodeCursor,
  errorResponse,
  listDeleteQuerySchema,
  listInputSchema,
  listQuerySchema,
  listRestoreBodySchema,
  listUpdateBodySchema,
  parseRequest,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  ConflictError,
  NotFoundError,
  createList,
  deleteList,
  queryActiveLists,
  restoreList,
  updateList,
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

    if (method === "GET" && path === "/api/lists") {
      const query = parseRequest(listQuerySchema, {
        limit: event.queryStringParameters?.limit,
        cursor: event.queryStringParameters?.cursor,
      });
      let startKey: CursorKey | undefined;
      if (query.cursor) {
        startKey = decodeCursor(query.cursor);
      }
      const result = await queryActiveLists(query.limit, startKey);
      return buildResponse(200, {
        items: result.items,
        ...(result.nextCursor
          ? { nextCursor: encodeCursor(result.nextCursor) }
          : {}),
      });
    }

    if (method === "POST" && path === "/api/lists") {
      const body = parseRequest(listInputSchema, parseBody(event.body));
      const list = await createList(body, {
        id: randomUUID(),
        userId,
        now,
      });
      return buildResponse(201, list);
    }

    const singleMatch = /^\/api\/lists\/([0-9a-f-]+)$/.exec(path);
    if (singleMatch) {
      const id = singleMatch[1];

      if (method === "PATCH") {
        const body = parseRequest(listUpdateBodySchema, parseBody(event.body));
        const { expectedVersion, ...input } = body;
        const list = await updateList(id, input, expectedVersion, userId, now);
        return buildResponse(200, list);
      }

      if (method === "DELETE") {
        const query = parseRequest(listDeleteQuerySchema, {
          expectedVersion: event.queryStringParameters?.expectedVersion,
        });
        const list = await deleteList(id, query.expectedVersion, userId, now);
        return buildResponse(200, list);
      }
    }

    const restoreMatch = /^\/api\/lists\/([0-9a-f-]+)\/restore$/.exec(path);
    if (restoreMatch && method === "POST") {
      const id = restoreMatch[1];
      const body = parseRequest(listRestoreBodySchema, parseBody(event.body));
      const list = await restoreList(id, body.expectedVersion, userId, now);
      return buildResponse(200, list);
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
    if (error instanceof Error && error.name === "CursorError") {
      return errorResponse(error.message, "INVALID_CURSOR", 400);
    }
    console.error(error);
    return errorResponse("failed to process list request");
  }
};
