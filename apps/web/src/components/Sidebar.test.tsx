import { renderWithQuery } from "@/lib/test-utils.js";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar.js";

const { mockUseListsQuery } = vi.hoisted(() => ({
  mockUseListsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-lists.js", () => ({
  useListsQuery: mockUseListsQuery,
  useCreateListMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

describe("Sidebar", () => {
  it("renders smart lists", () => {
    mockUseListsQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: null,
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("计划")).toBeInTheDocument();
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("已标记")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("分配给我")).toBeInTheDocument();
  });

  it("renders custom lists with name, color and settings", () => {
    mockUseListsQuery.mockReturnValue({
      data: {
        items: [
          {
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
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("购物")).toBeInTheDocument();
    expect(screen.getByLabelText("列表设置")).toBeInTheDocument();
  });

  it("opens settings menu and allows clicking menu items", async () => {
    const user = userEvent.setup();
    mockUseListsQuery.mockReturnValue({
      data: {
        items: [
          {
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
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderWithQuery(<Sidebar />);

    await user.click(screen.getByLabelText("列表设置"));
    await user.click(await screen.findByText("编辑"));
    await waitFor(() =>
      expect(screen.queryByText("编辑")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByLabelText("列表设置"));
    await user.click(await screen.findByText("删除"));
    await waitFor(() =>
      expect(screen.queryByText("删除")).not.toBeInTheDocument(),
    );
  });

  it("shows loading state", () => {
    mockUseListsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseListsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });

    renderWithQuery(<Sidebar />);

    expect(screen.getByText("加载失败")).toBeInTheDocument();
  });
});
