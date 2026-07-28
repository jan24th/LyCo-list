import {
  ConflictError,
  type CursorKey,
  NotFoundError,
  ValidationError,
  buildResponse,
  decodeCursor,
  encodeCursor,
  listQuerySchema,
  markNotificationReadInputSchema,
  parseRequest,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  listNotifications,
  markNotificationRead,
} from "./db.js";

function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims.sub as string;
}

function parseBody(body: string | undefined): unknown {
  if (!body) {
    throw new ValidationError("Request body is required");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new ValidationError("Invalid JSON in request body");
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
) => {
  try {
    const userId = getUserId(event);
    const { method } = event.requestContext.http;
    const path = event.rawPath;

    // GET /api/notifications
    if (method === "GET" && path === "/api/notifications") {
      const query = parseRequest(
        listQuerySchema,
        event.queryStringParameters ?? {},
      );
      let startKey: CursorKey | undefined;
      if (query.cursor) {
        try {
          startKey = decodeCursor(query.cursor);
        } catch {
          return buildResponse(400, {
            error: "Invalid cursor",
            code: "INVALID_CURSOR",
          });
        }
      }

      const result = await listNotifications(userId, query.limit, startKey);
      return buildResponse(200, {
        items: result.items,
        ...(result.nextCursor
          ? { nextCursor: encodeCursor(result.nextCursor) }
          : {}),
      });
    }

    // PATCH /api/notifications/{id}/read
    const readMatch = /^\/api\/notifications\/([0-9a-f-]+)\/read$/.exec(path);
    if (method === "PATCH" && readMatch) {
      const id = readMatch[1];
      const rawBody = parseBody(event.body);
      const input = parseRequest(markNotificationReadInputSchema, rawBody);
      const notification = await markNotificationRead(
        id,
        input.expectedVersion,
        new Date().toISOString(),
      );
      return buildResponse(200, notification);
    }

    return buildResponse(404, { error: "Not found" });
  } catch (error) {
    if (error instanceof ValidationError) {
      return buildResponse(400, {
        error: error.message,
        code: "VALIDATION_ERROR",
      });
    }
    if (error instanceof ConflictError) {
      return buildResponse(409, { error: error.message, code: "CONFLICT" });
    }
    if (error instanceof NotFoundError) {
      return buildResponse(404, { error: error.message, code: "NOT_FOUND" });
    }
    console.error("Unhandled error:", error);
    return buildResponse(500, {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
};
