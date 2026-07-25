import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewListDialog } from "./NewListDialog";

const { mockUseCreateListMutation } = vi.hoisted(() => ({
  mockUseCreateListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists", () => ({
  useCreateListMutation: mockUseCreateListMutation,
}));

function mockMutation(overrides: Record<string, unknown> = {}) {
  const mutate = vi.fn();
  mockUseCreateListMutation.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    ...overrides,
  });
  return mutate;
}

describe("NewListDialog", () => {
  beforeEach(() => {
    mockUseCreateListMutation.mockReset();
  });

  it("creates a list with trimmed name and selected color", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    render(<NewListDialog />);

    await user.click(screen.getByRole("button", { name: "新建列表" }));
    await user.type(screen.getByLabelText("名称"), "  购物  ");
    fireEvent.change(screen.getByLabelText("颜色"), {
      target: { value: "#ef4444" },
    });
    await user.click(screen.getByRole("button", { name: "创建" }));

    expect(mutate).toHaveBeenCalledWith(
      { name: "购物", color: "#ef4444", order: 0 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("closes and resets the form on success", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    render(<NewListDialog />);

    await user.click(screen.getByRole("button", { name: "新建列表" }));
    await user.type(screen.getByLabelText("名称"), "购物");
    await user.click(screen.getByRole("button", { name: "创建" }));

    const options = mutate.mock.calls[0][1];
    options.onSuccess();

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "新建列表" }));
    expect(screen.getByLabelText("名称")).toHaveValue("");
  });

  it("does not submit when name is blank", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    render(<NewListDialog />);

    await user.click(screen.getByRole("button", { name: "新建列表" }));
    expect(screen.getByRole("button", { name: "创建" })).toBeDisabled();

    await user.type(screen.getByLabelText("名称"), "   ");
    expect(screen.getByRole("button", { name: "创建" })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("ignores direct form submission when name is blank", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    render(<NewListDialog />);

    await user.click(screen.getByRole("button", { name: "新建列表" }));
    await user.type(screen.getByLabelText("名称"), "   ");
    fireEvent.submit(
      screen
        .getByRole("button", { name: "创建" })
        .closest("form") as HTMLFormElement,
    );

    expect(mutate).not.toHaveBeenCalled();
  });

  it("displays error message on failure", async () => {
    const user = userEvent.setup();
    mockMutation({ error: new Error("创建失败") });
    render(<NewListDialog />);

    await user.click(screen.getByRole("button", { name: "新建列表" }));

    expect(screen.getByRole("alert")).toHaveTextContent("创建失败");
  });

  it("disables submit while pending", async () => {
    const user = userEvent.setup();
    mockMutation({ isPending: true });
    render(<NewListDialog />);

    await user.click(screen.getByRole("button", { name: "新建列表" }));
    await user.type(screen.getByLabelText("名称"), "购物");

    expect(screen.getByRole("button", { name: "创建" })).toBeDisabled();
  });
});
