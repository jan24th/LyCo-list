import { describe, expect, it } from "vitest";
import {
  listDeleteQuerySchema,
  listRestoreBodySchema,
  listUpdateBodySchema,
} from "./index.js";

describe("listUpdateBodySchema", () => {
  it("requires expectedVersion and allows partial list fields", () => {
    const result = listUpdateBodySchema.parse({
      name: "购物",
      expectedVersion: 2,
    });
    expect(result).toEqual({ name: "购物", expectedVersion: 2 });
  });

  it("rejects negative expectedVersion", () => {
    expect(() => listUpdateBodySchema.parse({ expectedVersion: -1 })).toThrow();
  });

  it("rejects missing expectedVersion", () => {
    expect(() => listUpdateBodySchema.parse({ name: "购物" })).toThrow();
  });
});

describe("listRestoreBodySchema", () => {
  it("requires expectedVersion", () => {
    expect(listRestoreBodySchema.parse({ expectedVersion: 3 })).toEqual({
      expectedVersion: 3,
    });
  });

  it("rejects string expectedVersion", () => {
    expect(() =>
      listRestoreBodySchema.parse({ expectedVersion: "3" }),
    ).toThrow();
  });
});

describe("listDeleteQuerySchema", () => {
  it("coerces string expectedVersion", () => {
    expect(listDeleteQuerySchema.parse({ expectedVersion: "3" })).toEqual({
      expectedVersion: 3,
    });
  });

  it("rejects missing expectedVersion", () => {
    expect(() => listDeleteQuerySchema.parse({})).toThrow();
  });
});
