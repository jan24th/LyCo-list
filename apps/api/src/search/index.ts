import {
  type CursorKey,
  buildResponse,
  decodeCursor,
  encodeCursor,
  handleError,
  listQuerySchema,
  parseRequest,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import { search } from "./db.js";

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
) => {
  try {
    const { method } = event.requestContext.http;
    const path = event.rawPath;

    if (method !== "GET" || path !== "/api/search") {
      return buildResponse(404, { error: "Not found" });
    }

    const q = event.queryStringParameters?.q;
    if (!q || q.trim().length === 0) {
      return buildResponse(400, {
        error: "Query parameter 'q' is required",
        code: "VALIDATION_ERROR",
      });
    }

    const query = parseRequest(listQuerySchema, {
      limit: event.queryStringParameters?.limit,
      cursor: event.queryStringParameters?.cursor,
    });

    let startCursor: CursorKey | undefined;
    if (query.cursor) {
      try {
        startCursor = decodeCursor(query.cursor) as CursorKey;
      } catch {
        return buildResponse(400, {
          error: "Invalid cursor",
          code: "INVALID_CURSOR",
        });
      }
    }

    const result = await search(q.trim(), query.limit, startCursor);
    return buildResponse(200, {
      items: result.items,
      ...(result.nextCursor
        ? { nextCursor: encodeCursor(result.nextCursor) }
        : {}),
    });
  } catch (error) {
    return handleError(error);
  }
};
