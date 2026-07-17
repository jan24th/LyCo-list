import { renderWithQuery } from "@/lib/test-utils.js";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewListDialog } from "./NewListDialog.js";

const { mockUseCreateListMutation } = vi.hoisted(() => ({
  mockUseCreateListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists.js", () => ({
  useCreateListMutation: mockUseCreateListMutation,
  useListsQuery: () => ({
    data: { items: [] },
    isLoading: false,
    error: null,
  }),
}));

describe("NewListDialog", () => {
  it("creates a list with selected color", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_input, options) => {
      options?.onSuccess?.();
    });
    mockUseCreateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    await user.click(screen.getByText("新建列表"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "购物" },
    });
    await user.click(screen.getByRole("button", { name: "红色" }));
    await user.click(screen.getByText("创建"));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith(
      { name: "购物", color: "#ef4444", order: 0 },
      expect.any(Object),
    );
  });

  it("uses default color when none is selected", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseCreateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    await user.click(screen.getByText("新建列表"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "购物" },
    });
    await user.click(screen.getByText("创建"));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { name: "购物", color: "#3b82f6", order: 0 },
        expect.any(Object),
      ),
    );
  });

  it("does not submit when name is empty", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseCreateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    await user.click(screen.getByText("新建列表"));
    await user.click(screen.getByText("创建"));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("ignores submit when name is only whitespace", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseCreateListMutation.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    await user.click(screen.getByText("新建列表"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "   " },
    });
    const form = screen.getByLabelText("名称").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("displays error message on failure", async () => {
    const user = userEvent.setup();
    mockUseCreateListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("创建失败"),
    });

    renderWithQuery(<NewListDialog />);

    await user.click(screen.getByText("新建列表"));
    expect(screen.getByText("创建失败")).toBeInTheDocument();
  });

  it("disables submit while pending", async () => {
    const user = userEvent.setup();
    mockUseCreateListMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      error: null,
    });

    renderWithQuery(<NewListDialog />);

    await user.click(screen.getByText("新建列表"));
    expect(screen.getByText("创建")).toBeDisabled();
  });
});
