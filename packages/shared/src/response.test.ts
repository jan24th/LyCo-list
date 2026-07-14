import { describe, expect, it } from "vitest";
import { buildResponse, errorResponse } from "./index";

describe("buildResponse", () => {
  it("returns a JSON API response with the given status code", () => {
    const result = buildResponse(200, { ok: true });

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.body).toBe(JSON.stringify({ ok: true }));
  });

  it("serializes nested objects", () => {
    const result = buildResponse(201, { nested: { value: 1 } });

    expect(result.body).toBe(JSON.stringify({ nested: { value: 1 } }));
  });
});

describe("errorResponse", () => {
  it("returns a 500 error body by default", () => {
    const result = errorResponse("something went wrong");

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: "something went wrong",
    });
  });

  it("includes a code when provided", () => {
    const result = errorResponse("conflict", "CONFLICT", 409);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: "conflict",
      code: "CONFLICT",
    });
  });
});
