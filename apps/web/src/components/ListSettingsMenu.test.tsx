import type { List } from "@lyco/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListSettingsMenu } from "./ListSettingsMenu";

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

describe("ListSettingsMenu", () => {
  it("triggers onEdit when edit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ListSettingsMenu list={mockList} onEdit={onEdit} onDelete={onDelete} />,
    );

    await user.click(screen.getByRole("button", { name: "列表设置" }));
    await user.click(await screen.findByRole("menuitem", { name: "编辑" }));

    expect(onEdit).toHaveBeenCalledWith(mockList);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("triggers onDelete when delete is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ListSettingsMenu list={mockList} onEdit={onEdit} onDelete={onDelete} />,
    );

    await user.click(screen.getByRole("button", { name: "列表设置" }));
    await user.click(await screen.findByRole("menuitem", { name: "删除" }));

    expect(onDelete).toHaveBeenCalledWith(mockList);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
