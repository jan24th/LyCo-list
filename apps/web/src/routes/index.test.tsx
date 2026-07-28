import { createTestQueryClient } from "@/lib/test-utils";
import { routeTree } from "@/routeTree.gen";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
  signInWithRedirect: vi.fn(),
}));

const { mockFetchLists } = vi.hoisted(() => ({ mockFetchLists: vi.fn() }));

vi.mock("@/lib/lists", () => ({
  fetchLists: mockFetchLists,
  createList: vi.fn(),
}));

vi.mock("@/lib/tasks", () => ({
  fetchTasksByList: vi
    .fn()
    .mockResolvedValue({ items: [], nextCursor: undefined }),
}));

window.scrollTo = vi.fn();

async function renderRouter(initialUrl: string) {
  mockFetchLists.mockResolvedValue({ items: [] });
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] });
  const router = createRouter({ routeTree, history: memoryHistory });
  await router.load();
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Home route", () => {
  it("shows the smart list title", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));
    await renderRouter("/");
    expect(
      screen.getByRole("heading", { level: 2, name: "今天" }),
    ).toBeInTheDocument();
  });

  it("shows the current route title in the application header", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));
    await renderRouter("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "今天" }),
    ).toBeInTheDocument();
  });

  it("renders smart list navigation in the shell", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));
    await renderRouter("/");
    const nav = await screen.findAllByRole("navigation", { name: "智能列表" });
    expect(nav.length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "分配给我" })[0],
    ).toBeInTheDocument();
  });
});
