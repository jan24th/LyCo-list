import { createTestQueryClient } from "@/lib/test-utils";
import { routeTree } from "@/routeTree.gen";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockFetchLists } = vi.hoisted(() => ({ mockFetchLists: vi.fn() }));

vi.mock("@/lib/lists", () => ({
  fetchLists: mockFetchLists,
  createList: vi.fn(),
}));

const customList = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "购物",
  color: "#3b82f6",
  order: 0,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
  updatedBy: "d92a155c-70a1-70cf-8bd5-0dd5d4772093",
};

window.scrollTo = vi.fn();

async function renderRouter(initialUrl: string) {
  mockFetchLists.mockResolvedValue({ items: [customList] });
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
      await screen.findByRole("heading", { level: 2, name: "今天" }),
    ).toBeInTheDocument();
  });

  it("uses route static data as the application header title", async () => {
    await renderRouter("/about");
    expect(
      screen.getByRole("heading", { level: 1, name: "关于" }),
    ).toBeInTheDocument();
  });

  it("keeps the shell mounted when navigating through sidebar links", async () => {
    await renderRouter("/about");
    const main = screen.getByRole("main");
    const desktopNav = screen.getByTestId("desktop-navigation");
    fireEvent.click(
      await within(desktopNav).findByRole("link", { name: /购物/ }),
    );
    expect(screen.getByRole("main")).toBe(main);
  });
});
