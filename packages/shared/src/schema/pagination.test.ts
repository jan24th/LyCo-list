import { describe, expect, it } from "vitest";
import { listQuerySchema, taskQuerySchema } from "./pagination.js";

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

describe("taskQuerySchema", () => {
  const listId = "550e8400-e29b-41d4-a716-446655440000";

  it("requires listId and defaults limit to 50", () => {
    expect(taskQuerySchema.parse({ listId })).toEqual({ listId, limit: 50 });
  });

  it("rejects missing listId", () => {
    expect(taskQuerySchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-uuid listId", () => {
    expect(taskQuerySchema.safeParse({ listId: "not-a-uuid" }).success).toBe(
      false,
    );
  });

  it("accepts limit and cursor", () => {
    expect(
      taskQuerySchema.parse({ listId, limit: "10", cursor: "abc" }),
    ).toEqual({ listId, limit: 10, cursor: "abc" });
  });
});
