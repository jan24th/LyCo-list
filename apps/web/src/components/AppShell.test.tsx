import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

type MediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia() {
  let matches = false;
  const listeners = new Set<MediaListener>();
  const media = "(min-width: 64rem)";
  const value = {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: vi.fn((_type: "change", fn: MediaListener) =>
      listeners.add(fn),
    ),
    removeEventListener: vi.fn((_type: "change", fn: MediaListener) =>
      listeners.delete(fn),
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => value),
  );
  return {
    value,
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

function renderShell(navigation: ReactNode = <a href="/lists">列表</a>) {
  return render(
    <AppShell title="今天" navigation={navigation}>
      <p>当前路由内容</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  beforeEach(() => installMatchMedia());
  afterEach(() => vi.unstubAllGlobals());

  it("renders responsive regions and all slots", () => {
    renderShell();
    expect(screen.getByRole("heading", { name: "今天" })).toBeInTheDocument();
    expect(screen.getByText("当前路由内容")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-navigation")).toHaveClass(
      "hidden",
      "lg:flex",
      "fixed",
    );
    expect(screen.getByTestId("mobile-header")).toHaveClass(
      "flex",
      "lg:hidden",
    );
    expect(screen.getByRole("main")).toHaveClass(
      "min-w-0",
      "overflow-x-hidden",
    );
  });

  it("applies safe areas and a 44px menu target", () => {
    renderShell();
    expect(screen.getByTestId("mobile-header")).toHaveClass(
      "pt-[env(safe-area-inset-top)]",
    );
    expect(screen.getByTestId("desktop-navigation")).toHaveClass(
      "pt-[env(safe-area-inset-top)]",
      "pb-[env(safe-area-inset-bottom)]",
    );
    expect(screen.getByRole("main")).toHaveClass(
      "pl-[max(1rem,env(safe-area-inset-left))]",
      "pr-[max(1rem,env(safe-area-inset-right))]",
      "pb-[max(1rem,env(safe-area-inset-bottom))]",
    );
    expect(screen.getByRole("button", { name: "打开导航" })).toHaveClass(
      "size-11",
    );
  });

  it("opens and closes after link navigation", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const dialog = await screen.findByRole("dialog", { name: "导航" });
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole("link", { name: "列表" }));
    expect(
      screen.queryByRole("dialog", { name: "导航" }),
    ).not.toBeInTheDocument();
  });

  it("closes after a data-navigation-item is selected", () => {
    renderShell(
      <button type="button" data-navigation-item="">
        新建
      </button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const dialog = screen.getByRole("dialog", { name: "导航" });
    fireEvent.click(within(dialog).getByRole("button", { name: "新建" }));
    expect(
      screen.queryByRole("dialog", { name: "导航" }),
    ).not.toBeInTheDocument();
  });

  it("stays open for a non-navigation click", async () => {
    renderShell(<span>导航说明</span>);
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    const dialog = await screen.findByRole("dialog", { name: "导航" });
    fireEvent.click(within(dialog).getByText("导航说明"));
    expect(dialog).toBeVisible();
  });

  it("closes with Escape and with the close button", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "导航" }), {
      key: "Escape",
    });
    expect(
      screen.queryByRole("dialog", { name: "导航" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    fireEvent.click(await screen.findByRole("button", { name: /close|关闭/i }));
    expect(
      screen.queryByRole("dialog", { name: "导航" }),
    ).not.toBeInTheDocument();
  });

  it("closes only when media changes into lg", async () => {
    const media = installMatchMedia();
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    media.change(false);
    expect(await screen.findByRole("dialog", { name: "导航" })).toBeVisible();
    media.change(true);
    expect(
      screen.queryByRole("dialog", { name: "导航" }),
    ).not.toBeInTheDocument();
  });

  it("removes the media listener on unmount", () => {
    const media = installMatchMedia();
    const view = renderShell();
    view.unmount();
    expect(media.value.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
