import { describe, expect, it } from "vitest";
import { ValidationError, formatZodError } from "./errors.js";

describe("errors", () => {
  it("creates ValidationError", () => {
    const error = new ValidationError("bad input");
    expect(error.name).toBe("ValidationError");
    expect(error.message).toBe("bad input");
  });

  it("formats zod issues", () => {
    const error = {
      issues: [
        { path: ["name"], message: "Required" },
        { path: ["age"], message: "Expected number" },
      ],
    };
    expect(formatZodError(error)).toBe("name: Required; age: Expected number");
  });
});
