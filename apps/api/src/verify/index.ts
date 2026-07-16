import { buildResponse } from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const userId =
    typeof claims.sub === "string" && claims.sub.length > 0
      ? claims.sub
      : "unknown";

  return buildResponse(200, {
    ok: true,
    userId,
  });
};
