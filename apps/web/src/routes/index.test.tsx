import { createTestQueryClient } from "@/lib/test-utils.js";
import { routeTree } from "@/routeTree.gen";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockGetCurrentUser, mockSignInWithRedirect } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockSignInWithRedirect: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
  signInWithRedirect: mockSignInWithRedirect,
}));

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiClient: mockApiClient,
}));

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

describe("Home route", () => {
  it("shows login button when user is not logged in", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("not signed in"));
    await renderRouter("/");
    expect(
      await screen.findByRole("button", { name: "登录" }),
    ).toBeInTheDocument();
  });

  it("shows user id when already logged in", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-456" });
    await renderRouter("/");
    expect(await screen.findByText(/user-456/)).toBeInTheDocument();
  });

  it("displays API verify result when button is clicked", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-456" });
    mockApiClient.mockImplementation((path: string) =>
      path.startsWith("/api/lists")
        ? Promise.resolve({ items: [] })
        : Promise.resolve({ userId: "api-user-789" }),
    );

    await renderRouter("/");
    fireEvent.click(screen.getByRole("button", { name: "验证 API" }));

    expect(await screen.findByText(/api-user-789/)).toBeInTheDocument();
    expect(mockApiClient).toHaveBeenCalledWith("/api/verify");
  });

  it("displays API verify error on failure", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-456" });
    mockApiClient.mockRejectedValue(new Error("network error"));

    await renderRouter("/");
    fireEvent.click(screen.getByRole("button", { name: "验证 API" }));

    expect(await screen.findByText(/network error/)).toBeInTheDocument();
  });

  it("displays generic verify error when rejection is not an Error", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-456" });
    mockApiClient.mockRejectedValue("unknown failure");

    await renderRouter("/");
    fireEvent.click(screen.getByRole("button", { name: "验证 API" }));

    expect(await screen.findByText(/验证失败/)).toBeInTheDocument();
  });
});
