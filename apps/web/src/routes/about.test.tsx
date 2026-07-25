import { routeTree } from "@/routeTree.gen";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

window.scrollTo = vi.fn();

async function renderRouter(initialUrl: string) {
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] });
  const router = createRouter({ routeTree, history: memoryHistory });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("About route", () => {
  it("renders the about page content", async () => {
    await renderRouter("/about");
    expect(screen.getByText("关于 LyCo-list")).toBeInTheDocument();
  });

  it("navigates back to home", async () => {
    await renderRouter("/about");
    await screen.getByRole("button", { name: "返回" }).click();
    expect(
      await screen.findByRole("heading", { level: 2, name: "今天" }),
    ).toBeInTheDocument();
  });

  it("uses route static data as the application header title", async () => {
    await renderRouter("/about");
    expect(
      screen.getByRole("heading", { level: 1, name: "关于" }),
    ).toBeInTheDocument();
  });

  it("navigates through the shell while preserving its main element", async () => {
    await renderRouter("/about");
    const main = screen.getByRole("main");
    fireEvent.click(screen.getAllByRole("link", { name: "首页" })[0]);
    expect(await screen.findByText("智能列表占位页")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBe(main);
  });
});
