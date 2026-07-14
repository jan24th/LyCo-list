import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handler } from "./index.js";

describe("health handler", () => {
  it("returns 200 with ok: true", async () => {
    const result = await handler({} as never, {} as never, () => {});

    if (typeof result === "string" || result === undefined) {
      throw new Error("expected object response");
    }
    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(result.body ?? "{}")).toEqual({ ok: true });
  });

  it("is typed as APIGatewayProxyHandlerV2", () => {
    const typed: APIGatewayProxyHandlerV2 = handler;
    expect(typed).toBeDefined();
  });
});
