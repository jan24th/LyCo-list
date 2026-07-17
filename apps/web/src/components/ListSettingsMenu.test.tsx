import type { List } from "@lyco/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListSettingsMenu } from "./ListSettingsMenu.js";

const mockList: List = {
  id: "list-1",
  name: "购物",
  color: "#3b82f6",
  icon: "list",
  order: 0,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "u1",
  updatedBy: "u1",
};

describe("ListSettingsMenu", () => {
  it("triggers onEdit when edit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ListSettingsMenu list={mockList} onEdit={onEdit} onDelete={onDelete} />,
    );

    await user.click(screen.getByLabelText("列表设置"));
    await user.click(await screen.findByText("编辑"));

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

    await user.click(screen.getByLabelText("列表设置"));
    await user.click(await screen.findByText("删除"));

    expect(onDelete).toHaveBeenCalledWith(mockList);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
