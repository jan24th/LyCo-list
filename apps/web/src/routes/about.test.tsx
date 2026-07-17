import { createTestQueryClient } from "@/lib/test-utils.js";
import { routeTree } from "@/routeTree.gen";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

window.scrollTo = vi.fn();

async function renderRouter(initialUrl: string) {
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] });
  const router = createRouter({ routeTree, history: memoryHistory });
  await router.load();
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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
      await screen.findByRole("heading", { name: "今天" }),
    ).toBeInTheDocument();
  });
});
