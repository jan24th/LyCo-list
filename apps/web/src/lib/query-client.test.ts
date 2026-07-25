import { describe, expect, it } from "vitest";
import { queryClient } from "./query-client";

describe("queryClient", () => {
  it("is configured with retry disabled and sane defaults", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
