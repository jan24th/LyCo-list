import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginButton } from "./LoginButton";

const { mockSignInWithRedirect } = vi.hoisted(() => ({
  mockSignInWithRedirect: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  signInWithRedirect: mockSignInWithRedirect,
}));

describe("LoginButton", () => {
  it("renders login button", () => {
    render(<LoginButton />);
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  it("calls signInWithRedirect when clicked", () => {
    render(<LoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(mockSignInWithRedirect).toHaveBeenCalledWith();
  });
});
