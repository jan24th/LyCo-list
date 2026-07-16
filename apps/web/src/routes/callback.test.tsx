import { CallbackPage } from "@/routes/callback";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockNavigate, mockUseLocation } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return {
    ...actual,
    useLocation: mockUseLocation,
    useNavigate: () => mockNavigate,
  };
});

const { mockFetchAuthSession } = vi.hoisted(() => ({
  mockFetchAuthSession: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: mockFetchAuthSession,
  signInWithRedirect: vi.fn(),
}));

function renderCallback(search: string) {
  mockUseLocation.mockReturnValue({ searchStr: search } as unknown as ReturnType<
    typeof mockUseLocation
  >);
  return render(<CallbackPage />);
}

describe("CallbackPage", () => {
  it("shows loading state while processing the code", () => {
    mockFetchAuthSession.mockImplementation(() => new Promise(() => {}));

    renderCallback("?code=abc123");

    expect(screen.getByText("正在完成登录…")).toBeInTheDocument();
  });

  it("navigates to home after session is established", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    renderCallback("?code=abc123");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("shows error and login button when code is missing", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    renderCallback("");

    expect(await screen.findByText(/缺少授权码/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  it("shows error message when session fetch fails", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("invalid session"));

    renderCallback("?code=abc123");

    expect(await screen.findByText(/invalid session/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  it("shows generic error when rejection is not an Error", async () => {
    mockFetchAuthSession.mockRejectedValue("unknown failure");

    renderCallback("?code=abc123");

    expect(await screen.findByText(/登录失败/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });
});
