import type { List } from "@lyco/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

const { mockUseListsQuery } = vi.hoisted(() => ({
  mockUseListsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-lists", () => ({
  useListsQuery: mockUseListsQuery,
  useCreateListMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useUpdateListMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

const customList: List = {
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

function mockQuery(overrides: Record<string, unknown> = {}) {
  mockUseListsQuery.mockReturnValue({
    data: { items: [] },
    isLoading: false,
    error: null,
    ...overrides,
  });
}

describe("Sidebar", () => {
  beforeEach(() => {
    mockUseListsQuery.mockReset();
  });

  it("renders all smart list entries", () => {
    mockQuery();
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "智能列表" });
    for (const name of [
      "今天",
      "计划",
      "全部",
      "已标记",
      "已完成",
      "分配给我",
    ]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("renders custom lists with name, color and settings entry", () => {
    mockQuery({ data: { items: [customList] } });
    render(<Sidebar />);

    const section = screen.getByRole("region", { name: "我的列表" });
    const link = within(section).getByRole("link", { name: /购物/ });
    expect(link).toBeInTheDocument();
    expect(link.querySelector("[data-color-dot]")).toHaveStyle({
      backgroundColor: "#3b82f6",
    });
    expect(
      within(section).getByRole("button", { name: "列表设置" }),
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockQuery({ data: undefined, isLoading: true });
    render(<Sidebar />);

    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockQuery({ data: undefined, error: new Error("boom") });
    render(<Sidebar />);

    expect(screen.getByRole("alert")).toHaveTextContent("加载失败");
  });

  it("shows empty hint when there are no custom lists", () => {
    mockQuery();
    render(<Sidebar />);

    expect(screen.getByText("暂无自定义列表")).toBeInTheDocument();
  });

  it("offers the new list dialog trigger", () => {
    mockQuery();
    render(<Sidebar />);

    expect(
      screen.getByRole("button", { name: "新建列表" }),
    ).toBeInTheDocument();
  });

  it("opens the edit dialog when edit is clicked", async () => {
    const user = userEvent.setup();
    mockQuery({ data: { items: [customList] } });
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "列表设置" }));
    await user.click(await screen.findByRole("menuitem", { name: "编辑" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("编辑列表")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("名称")).toHaveValue("购物");
    expect(within(dialog).getByLabelText("颜色")).toHaveValue("#3b82f6");
  });

  it("closes the edit dialog via onOpenChange", async () => {
    const user = userEvent.setup();
    mockQuery({ data: { items: [customList] } });
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "列表设置" }));
    await user.click(await screen.findByRole("menuitem", { name: "编辑" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the list when delete is clicked before 008C is wired", async () => {
    const user = userEvent.setup();
    mockQuery({ data: { items: [customList] } });
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "列表设置" }));
    await user.click(await screen.findByRole("menuitem", { name: "删除" }));

    expect(
      screen.getByRole("link", { name: /购物/ }),
    ).toBeInTheDocument();
  });
});
