import { renderWithQuery } from "@/lib/test-utils";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LISTS_QUERY_KEY,
  useCreateListMutation,
  useDeleteListMutation,
  useListsQuery,
  useRestoreListMutation,
  useUpdateListMutation,
} from "./use-lists";

const {
  mockFetchLists,
  mockCreateList,
  mockUpdateList,
  mockDeleteList,
  mockRestoreList,
} = vi.hoisted(() => ({
  mockFetchLists: vi.fn(),
  mockCreateList: vi.fn(),
  mockUpdateList: vi.fn(),
  mockDeleteList: vi.fn(),
  mockRestoreList: vi.fn(),
}));

vi.mock("@/lib/lists", () => ({
  fetchLists: mockFetchLists,
  createList: mockCreateList,
  updateList: mockUpdateList,
  deleteList: mockDeleteList,
  restoreList: mockRestoreList,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("useListsQuery", () => {
  it("returns lists on success", async () => {
    mockFetchLists.mockResolvedValueOnce({
      items: [{ id: "1", name: "购物" }],
    });

    const { result } = renderWithQuery(() => useListsQuery());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it("returns error state on failure", async () => {
    mockFetchLists.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderWithQuery(() => useListsQuery());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("network error");
  });
});

describe("useCreateListMutation", () => {
  it("calls createList and invalidates the lists query on success", async () => {
    mockCreateList.mockResolvedValueOnce({ id: "2", name: "工作" });

    const { result, client } = renderWithQuery(() => useCreateListMutation());
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    result.current.mutate({ name: "工作", color: "#ef4444", order: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateList).toHaveBeenCalledWith(
      {
        name: "工作",
        color: "#ef4444",
        order: 1,
      },
      expect.anything(),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LISTS_QUERY_KEY });
  });
});

describe("useDeleteListMutation", () => {
  it("calls deleteList and invalidates the lists query on success", async () => {
    mockDeleteList.mockResolvedValueOnce({ id: "1", version: 2 });

    const { result, client } = renderWithQuery(() => useDeleteListMutation());
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    result.current.mutate({ id: "1", expectedVersion: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteList).toHaveBeenCalledWith("1", 1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LISTS_QUERY_KEY });
  });
});

describe("useRestoreListMutation", () => {
  it("calls restoreList and invalidates the lists query on success", async () => {
    mockRestoreList.mockResolvedValueOnce({ id: "1", version: 3 });

    const { result, client } = renderWithQuery(() => useRestoreListMutation());
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    result.current.mutate({ id: "1", expectedVersion: 2 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRestoreList).toHaveBeenCalledWith("1", 2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LISTS_QUERY_KEY });
  });
});

describe("useUpdateListMutation", () => {
  it("calls updateList and invalidates the lists query on success", async () => {
    mockUpdateList.mockResolvedValueOnce({
      id: "1",
      name: "新名称",
      version: 2,
    });

    const { result, client } = renderWithQuery(() => useUpdateListMutation());
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    result.current.mutate({
      id: "1",
      input: { name: "新名称", expectedVersion: 1 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateList).toHaveBeenCalledWith("1", {
      name: "新名称",
      expectedVersion: 1,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LISTS_QUERY_KEY });
  });
});
