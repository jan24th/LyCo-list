import { buildResponse } from "@lyco/shared";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2,
) => {
  const requestId = event.requestContext?.requestId ?? "unknown";
  return buildResponse(200, {
    ok: true,
    timestamp: new Date().toISOString(),
    requestId,
  });
};
