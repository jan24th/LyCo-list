import type { List } from "@lyco/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteListDialog } from "./DeleteListDialog";

const { mockUseDeleteListMutation } = vi.hoisted(() => ({
  mockUseDeleteListMutation: vi.fn(),
}));

vi.mock("@/hooks/use-lists", () => ({
  useDeleteListMutation: mockUseDeleteListMutation,
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
  mockUseDeleteListMutation.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    ...overrides,
  });
  return mutate;
}

function renderDialog(
  props: Partial<Parameters<typeof DeleteListDialog>[0]> = {},
) {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  render(
    <DeleteListDialog
      list={mockList}
      open={true}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      {...props}
    />,
  );
  return { onOpenChange, onDeleted };
}

describe("DeleteListDialog", () => {
  beforeEach(() => {
    mockUseDeleteListMutation.mockReset();
  });

  it("calls delete mutation with expectedVersion on confirm", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderDialog();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "删除" }));

    expect(mutate).toHaveBeenCalledWith(
      { id: mockList.id, expectedVersion: 1 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("closes the dialog and notifies parent with the deleted list on success", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    const { onOpenChange, onDeleted } = renderDialog();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "删除" }));
    const deletedList = { ...mockList, version: 2 };
    mutate.mock.calls[0][1].onSuccess(deletedList);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDeleted).toHaveBeenCalledWith(deletedList);
  });

  it("does not delete on cancel", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    const { onOpenChange, onDeleted } = renderDialog();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "取消" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows the list name in the confirmation text", () => {
    mockMutation();
    renderDialog();

    expect(screen.getByRole("dialog")).toHaveTextContent("购物");
  });

  it("shows conflict message from the mutation error", () => {
    mockMutation({ error: new Error("数据已过期，请刷新后重试") });
    renderDialog();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "数据已过期，请刷新后重试",
    );
  });

  it("disables the delete button while pending", () => {
    mockMutation({ isPending: true });
    renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "删除" })).toBeDisabled();
  });
});
