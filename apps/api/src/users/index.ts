import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  type ApiResponse,
  CursorError,
  type User,
  ValidationError,
  buildResponse,
  decodeCursor,
  encodeCursor,
  errorResponse,
  listQuerySchema,
  parseRequest,
  userSchema,
} from "@lyco/shared";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda";

const client = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<ApiResponse> => {
  try {
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
      return errorResponse("USER_POOL_ID not configured");
    }

    const query = parseRequest(listQuerySchema, {
      limit: event.queryStringParameters?.limit,
      cursor: event.queryStringParameters?.cursor,
    });

    let cognitoToken: string | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (typeof decoded.paginationToken !== "string") {
        throw new CursorError("Invalid cursor: missing paginationToken");
      }
      cognitoToken = decoded.paginationToken;
    }

    const users: User[] = [];
    let nextCognitoToken: string | undefined = cognitoToken;

    while (users.length < query.limit) {
      const remaining = query.limit - users.length;
      const response = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Limit: Math.min(remaining, 60),
          ...(nextCognitoToken ? { PaginationToken: nextCognitoToken } : {}),
        }),
      );

      for (const cognitoUser of response.Users ?? []) {
        const mapped = mapCognitoUser(cognitoUser);
        if (mapped) {
          users.push(mapped);
        }
      }

      nextCognitoToken = response.PaginationToken;
      if (!nextCognitoToken) break;
    }

    const nextCursor = nextCognitoToken
      ? encodeCursor({ paginationToken: nextCognitoToken })
      : undefined;

    return buildResponse(200, {
      items: users,
      ...(nextCursor ? { nextCursor } : {}),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(error.message, "VALIDATION_ERROR", 400);
    }
    if (error instanceof CursorError) {
      return errorResponse(error.message, "INVALID_CURSOR", 400);
    }
    console.error(error);
    return errorResponse("failed to list users");
  }
};

function mapCognitoUser(cognitoUser: UserType): User | null {
  const attributes = new Map(
    (cognitoUser.Attributes ?? []).map((attr) => [
      attr.Name ?? "",
      attr.Value ?? "",
    ]),
  );

  const id = attributes.get("sub");
  const name = attributes.get("name");

  if (!id || !name) return null;

  const parsed = userSchema.safeParse({ id, name });
  if (!parsed.success) return null;

  return parsed.data;
}
