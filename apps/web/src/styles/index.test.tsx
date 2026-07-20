import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  resolve(process.cwd(), "apps/web/src/index.css"),
  "utf8",
);

const semanticTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
];

describe("shadcn theme contract", () => {
  it("imports Tailwind and animation utilities", () => {
    expect(styles).toContain('@import "tailwindcss"');
    expect(styles).toContain('@import "tw-animate-css"');
    expect(styles).toContain('@import "shadcn/tailwind.css"');
    expect(styles).toContain("@custom-variant dark");
  });

  it.each(semanticTokens)("maps the %s semantic token", (token) => {
    expect(styles).toContain(`--color-${token}: var(--${token});`);
    expect(styles.match(new RegExp(`--${token}:`, "g"))).toHaveLength(2);
  });

  it("defines radius, charts, and sidebar mappings", () => {
    for (const token of ["radius-sm", "radius-md", "radius-lg", "radius-xl"]) {
      expect(styles).toContain(`--${token}:`);
    }
    for (const token of [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ]) {
      expect(styles).toContain(`--color-${token}:`);
    }
  });
});
