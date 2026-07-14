import { buildResponse } from "@lyco/shared";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return buildResponse(200, { ok: true });
};
