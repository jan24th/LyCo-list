export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function buildResponse(
  statusCode: number,
  body: Record<string, unknown>,
): ApiResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  message: string,
  code?: string,
  statusCode = 500,
): ApiResponse {
  return buildResponse(statusCode, {
    error: message,
    ...(code ? { code } : {}),
  });
}
