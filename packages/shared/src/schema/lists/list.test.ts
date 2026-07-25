import { describe, expect, it } from "vitest";
import { listInputSchema, listSchema, listUpdateSchema } from "./index.js";

describe("list schemas", () => {
  it("accepts valid input", () => {
    expect(listInputSchema.safeParse({ name: "购物清单" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(listInputSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects invalid color", () => {
    expect(
      listInputSchema.safeParse({ name: "A", color: "blue" }).success,
    ).toBe(false);
  });

  it("applies defaults", () => {
    const result = listInputSchema.parse({ name: "默认" });
    expect(result.color).toBe("#3b82f6");
    expect(result.order).toBe(0);
  });

  it("allows partial update", () => {
    expect(listUpdateSchema.safeParse({ color: "#ef4444" }).success).toBe(true);
  });

  it("accepts full record", () => {
    const result = listSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "购物清单",
      color: "#3b82f6",
      order: 1,
      version: 1,
      createdAt: "2026-07-14T00:00:00Z",
      updatedAt: "2026-07-14T00:00:00Z",
      createdBy: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      updatedBy: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing audit fields", () => {
    expect(
      listSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "购物清单",
        version: 1,
      }).success,
    ).toBe(false);
  });
});
