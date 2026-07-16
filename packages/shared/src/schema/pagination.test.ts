import { describe, expect, it } from "vitest";
import { listQuerySchema } from "./pagination.js";

describe("listQuerySchema", () => {
  it("defaults limit to 50 and omits cursor", () => {
    const result = listQuerySchema.parse({});
    expect(result).toEqual({ limit: 50 });
  });

  it("parses numeric limit from string", () => {
    const result = listQuerySchema.parse({ limit: "10" });
    expect(result).toEqual({ limit: 10 });
  });

  it("rejects limit below 1", () => {
    expect(listQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("rejects limit above 100", () => {
    expect(listQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects non-numeric limit", () => {
    expect(listQuerySchema.safeParse({ limit: "ten" }).success).toBe(false);
  });

  it("accepts a cursor string", () => {
    const result = listQuerySchema.parse({ cursor: "abc123" });
    expect(result).toEqual({ limit: 50, cursor: "abc123" });
  });

  it("rejects an empty cursor string", () => {
    expect(listQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
  });
});
