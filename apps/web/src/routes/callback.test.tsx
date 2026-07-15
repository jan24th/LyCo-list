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

describe("Callback route", () => {
  it("shows loading state initially", async () => {
    mockGetCurrentUser.mockImplementation(() => new Promise(() => {}));
    await renderRouter("/callback");
    expect(screen.getByText("正在完成登录…")).toBeInTheDocument();
  });

  it("displays user id on success", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-123" });
    await renderRouter("/callback");
    expect(await screen.findByText(/user-123/)).toBeInTheDocument();
  });

  it("displays error on failure", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("invalid session"));
    await renderRouter("/callback");
    expect(await screen.findByText(/invalid session/)).toBeInTheDocument();
  });

  it("displays generic error when rejection is not an Error", async () => {
    mockGetCurrentUser.mockRejectedValue("unknown failure");
    await renderRouter("/callback");
    expect(await screen.findByText(/登录失败/)).toBeInTheDocument();
  });
});
