import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeProvider";

type Listener = (event: MediaQueryListEvent) => void;

function installColorScheme(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const media = "(prefers-color-scheme: dark)";
  const query = {
    get matches() {
      return matches;
    },
    media,
    addEventListener: vi.fn((_type: "change", listener: Listener) =>
      listeners.add(listener),
    ),
    removeEventListener: vi.fn((_type: "change", listener: Listener) =>
      listeners.delete(listener),
    ),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    query,
    change(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of listeners) {
          listener({ matches, media } as MediaQueryListEvent);
        }
      });
    },
  };
}

describe("ThemeProvider", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it.each([
    [true, true],
    [false, false],
  ])("applies the initial system preference", (preference, expected) => {
    installColorScheme(preference);
    render(
      <ThemeProvider>
        <p>内容</p>
      </ThemeProvider>,
    );
    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(expected);
  });

  it("tracks system changes and removes its listener", () => {
    const media = installColorScheme(false);
    const view = render(
      <ThemeProvider>
        <p>内容</p>
      </ThemeProvider>,
    );
    media.change(true);
    expect(document.documentElement).toHaveClass("dark");
    media.change(false);
    expect(document.documentElement).not.toHaveClass("dark");
    view.unmount();
    expect(media.query.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
