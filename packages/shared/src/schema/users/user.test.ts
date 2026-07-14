import { describe, expect, it } from "vitest";
import { userSchema } from "./index.js";

describe("userSchema", () => {
  it("accepts a valid user", () => {
    const result = userSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Alice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = userSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sub", () => {
    const result = userSchema.safeParse({ id: "not-a-uuid", name: "Alice" });
    expect(result.success).toBe(false);
  });
});
