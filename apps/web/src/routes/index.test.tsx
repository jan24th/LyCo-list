import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

window.scrollTo = vi.fn();

async function renderRouter(initialUrl: string) {
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] });
  const router = createRouter({ routeTree, history: memoryHistory });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("Home route", () => {
  it("renders the home page content", async () => {
    await renderRouter("/");
    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关于" })).toBeInTheDocument();
  });

  it("navigates to about page", async () => {
    await renderRouter("/");
    await screen.getByRole("button", { name: "关于" }).click();
    expect(await screen.findByText("关于 LyCo-list")).toBeInTheDocument();
  });
});
