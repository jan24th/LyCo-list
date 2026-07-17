import { describe, expect, it } from "vitest";
import { queryClient } from "./query-client.js";

describe("queryClient", () => {
  it("is configured with retry disabled by default", () => {
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
