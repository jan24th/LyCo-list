import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  resolve(process.cwd(), "apps/web/index.html"),
  "utf8",
);

describe("initial theme bootstrap", () => {
  it("applies the system color scheme before the application bundle", () => {
    const themeScript = html.indexOf("matchMedia");
    const applicationScript = html.indexOf("/src/main.tsx");

    expect(themeScript).toBeGreaterThan(-1);
    expect(html).toContain("classList.toggle");
    expect(themeScript).toBeLessThan(applicationScript);
  });
});
