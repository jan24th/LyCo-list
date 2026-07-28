import { randomUUID } from "node:crypto";
import {
  type CursorKey,
  ValidationError,
  buildResponse,
  decodeCursor,
  encodeCursor,
  errorResponse,
  listQuerySchema,
  parseRequest,
  reminderInputSchema,
  reminderUpdateSchema,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";
import {
  ConflictError,
  NotFoundError,
  createReminder,
  deleteReminder,
  getReminderById,
  getRemindersByTask,
  processDueReminders,
  updateReminder,
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

function parseExpectedVersion(body: unknown): number {
  const raw = (body as Record<string, unknown>)?.expectedVersion;
  const num = typeof raw === "string" ? Number(raw) : raw;
  if (
    typeof num !== "number" ||
    !Number.isFinite(num) ||
    num < 0 ||
    !Number.isInteger(num)
  ) {
    throw new ValidationError("expectedVersion must be a non-negative integer");
  }
  return num;
}

function parseDeleteExpectedVersion(
  query: Record<string, string | undefined> | undefined,
): number {
  const raw = query?.expectedVersion;
  if (!raw) {
    throw new ValidationError("expectedVersion query parameter is required");
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    throw new ValidationError("expectedVersion must be a non-negative integer");
  }
  return num;
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const userId = getUserId(event);
    const now = new Date().toISOString();

    // POST /api/tasks/{taskId}/reminders
    if (method === "POST") {
      const createMatch = /^\/api\/tasks\/([0-9a-f-]+)\/reminders$/.exec(path);
      if (createMatch) {
        const taskId = createMatch[1];
        const body = parseRequest(reminderInputSchema, parseBody(event.body));
        const reminder = await createReminder(body, {
          id: randomUUID(),
          userId,
          now,
        });
        return buildResponse(201, reminder);
      }
    }

    // GET /api/tasks/{taskId}/reminders
    if (method === "GET") {
      const listMatch = /^\/api\/tasks\/([0-9a-f-]+)\/reminders$/.exec(path);
      if (listMatch) {
        const taskId = listMatch[1];
        const query = parseRequest(listQuerySchema, {
          limit: event.queryStringParameters?.limit,
          cursor: event.queryStringParameters?.cursor,
        });
        let startKey: CursorKey | undefined;
        if (query.cursor) {
          startKey = decodeCursor(query.cursor);
        }
        const result = await getRemindersByTask(taskId, query.limit, startKey);
        return buildResponse(200, {
          items: result.items,
          ...(result.nextCursor
            ? { nextCursor: encodeCursor(result.nextCursor) }
            : {}),
        });
      }
    }

    // PATCH /api/tasks/{taskId}/reminders/{id}
    // DELETE /api/tasks/{taskId}/reminders/{id}
    const singleMatch =
      /^\/api\/tasks\/([0-9a-f-]+)\/reminders\/([0-9a-f-]+)$/.exec(path);
    if (singleMatch) {
      const [, taskId, id] = singleMatch;

      if (method === "PATCH") {
        const rawBody = parseBody(event.body);
        const updateInput = parseRequest(reminderUpdateSchema, rawBody);
        const expectedVersion = parseExpectedVersion(rawBody);
        const reminder = await updateReminder(
          id,
          updateInput,
          expectedVersion,
          now,
          userId,
        );
        return buildResponse(200, reminder);
      }

      if (method === "DELETE") {
        const expectedVersion = parseDeleteExpectedVersion(
          event.queryStringParameters,
        );
        const result = await deleteReminder(id, expectedVersion);
        return buildResponse(200, result);
      }
    }

    // POST /api/reminders/process-due
    if (method === "POST" && path === "/api/reminders/process-due") {
      const result = await processDueReminders(now);
      return buildResponse(200, result);
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
    console.error(error);
    return errorResponse("failed to process reminder request");
  }
};
