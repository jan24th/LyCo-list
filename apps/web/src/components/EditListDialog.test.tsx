import type { List } from "@lyco/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditListDialog } from "./EditListDialog";

const { mockUseUpdateListMutation } = vi.hoisted(() => ({
  mockUseUpdateListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists", () => ({
  useUpdateListMutation: mockUseUpdateListMutation,
}));

const mockList: List = {
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

function mockMutation(overrides: Record<string, unknown> = {}) {
  const mutate = vi.fn();
  mockUseUpdateListMutation.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    ...overrides,
  });
  return mutate;
}

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <EditListDialog list={mockList} open={true} onOpenChange={onOpenChange} />,
  );
  return onOpenChange;
}

describe("EditListDialog", () => {
  beforeEach(() => {
    mockUseUpdateListMutation.mockReset();
  });

  it("submits trimmed name and color with expectedVersion", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderDialog();

    const nameInput = screen.getByLabelText("名称");
    await user.clear(nameInput);
    await user.type(nameInput, "  新名称  ");
    fireEvent.change(screen.getByLabelText("颜色"), {
      target: { value: "#ef4444" },
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        id: mockList.id,
        input: {
          name: "新名称",
          color: "#ef4444",
          expectedVersion: 1,
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("closes the dialog on success", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    const onOpenChange = renderDialog();

    await user.click(screen.getByRole("button", { name: "保存" }));
    mutate.mock.calls[0][1].onSuccess();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows validation error and blocks submit when name is blank", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderDialog();

    const nameInput = screen.getByLabelText("名称");
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent("名称不能为空");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows conflict message from the mutation error", () => {
    mockMutation({ error: new Error("数据已过期，请刷新后重试") });
    renderDialog();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "数据已过期，请刷新后重试",
    );
  });

  it("disables submit while pending", () => {
    mockMutation({ isPending: true });
    renderDialog();

    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("resets form state when remounted with a different list", async () => {
    const user = userEvent.setup();
    mockMutation();
    const anotherList: List = {
      ...mockList,
      id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      name: "工作",
      color: "#ef4444",
      version: 3,
    };

    const { rerender } = render(
      <EditListDialog
        key={mockList.id}
        list={mockList}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const nameInput = screen.getByLabelText("名称");
    await user.clear(nameInput);
    await user.type(nameInput, "临时改动");

    rerender(
      <EditListDialog
        key={anotherList.id}
        list={anotherList}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("名称")).toHaveValue("工作"),
    );
    expect(screen.getByLabelText("颜色")).toHaveValue("#ef4444");
  });
});
