import { routeTree } from "@/routeTree.gen";
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
}));

window.scrollTo = vi.fn();

async function renderRouter(initialUrl: string) {
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] });
  const router = createRouter({ routeTree, history: memoryHistory });
  await router.load();
  return render(<RouterProvider router={router} />);
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
});
