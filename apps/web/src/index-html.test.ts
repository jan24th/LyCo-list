import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(
  resolve(process.cwd(), "apps/web/index.html"),
  "utf8",
);
const markup = new DOMParser().parseFromString(html, "text/html");
const scripts = Array.from(markup.scripts);
const themeScript = markup.head.querySelector("script:not([src])");

function executeThemeScript(matches: boolean) {
  const matchMedia = vi.fn(() => ({ matches }));
  Function(
    "window",
    "document",
    themeScript?.textContent ?? "",
  )({ matchMedia }, document);
  return matchMedia;
}

describe("initial theme bootstrap", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("runs from the head before the application bundle", () => {
    const applicationScript = scripts.find(
      (script) => script.getAttribute("src") === "/src/main.tsx",
    );

    expect(themeScript).not.toBeNull();
    expect(scripts.indexOf(themeScript as HTMLScriptElement)).toBeLessThan(
      scripts.indexOf(applicationScript as HTMLScriptElement),
    );
  });

  it.each([true, false])(
    "applies a %s dark system preference before React starts",
    (matches) => {
      document.documentElement.classList.toggle("dark", !matches);

      const matchMedia = executeThemeScript(matches);

      expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
      expect(document.documentElement.classList.contains("dark")).toBe(matches);
    },
  );
});
