import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "./errors.js";
import { parseRequest } from "./validate.js";

describe("parseRequest", () => {
  const schema = z.object({ name: z.string(), count: z.number() });

  it("returns parsed data for valid input", () => {
    const result = parseRequest(schema, { name: "test", count: 1 });
    expect(result).toEqual({ name: "test", count: 1 });
  });

  it("throws ValidationError for invalid input", () => {
    expect(() => parseRequest(schema, { name: "test", count: "one" })).toThrow(
      ValidationError,
    );
    expect(() => parseRequest(schema, { name: "test", count: "one" })).toThrow(
      "count: Invalid input: expected number, received string",
    );
  });
});
