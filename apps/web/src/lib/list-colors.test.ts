import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_COLORS, randomListColor } from "./list-colors.js";

describe("randomListColor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("excludes the current color from the pool", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomListColor("#3b82f6")).toBe(LIST_COLORS[1].value);
  });

  it("matches the current color case-insensitively", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomListColor("#3B82F6")).toBe(LIST_COLORS[1].value);
  });

  it("uses the full pool when current color is custom", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomListColor("#000000")).toBe(LIST_COLORS[0].value);
  });
});
