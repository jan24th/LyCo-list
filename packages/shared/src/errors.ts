import { CursorError } from "./cursor.js";
import { errorResponse } from "./response.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Maps known domain errors to HTTP responses.
 * Use as a catch-all in Lambda handlers.
 */
export function handleError(error: unknown) {
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
  console.error("Unhandled error:", error);
  return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
}

export function formatZodError(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
    .join("; ");
}
