import { createQueryWrapper, createTestQueryClient } from "@/lib/test-utils.js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateListMutation, useListsQuery } from "./use-lists.js";

const { mockFetchLists, mockCreateList } = vi.hoisted(() => ({
  mockFetchLists: vi.fn(),
  mockCreateList: vi.fn(),
}));

vi.mock("@/lib/lists.js", () => ({
  fetchLists: mockFetchLists,
  createList: mockCreateList,
}));

describe("useListsQuery", () => {
  beforeEach(() => {
    mockFetchLists.mockReset();
  });

  it("returns lists on success", async () => {
    mockFetchLists.mockResolvedValueOnce({
      items: [{ id: "1", name: "购物" }],
    });

    const client = createTestQueryClient();
    const { result } = renderHook(() => useListsQuery(), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it("returns error state on failure", async () => {
    mockFetchLists.mockRejectedValueOnce(new Error("network error"));

    const client = createTestQueryClient();
    const { result } = renderHook(() => useListsQuery(), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("network error");
  });
});

describe("useCreateListMutation", () => {
  beforeEach(() => {
    mockFetchLists.mockReset();
    mockCreateList.mockReset();
  });

  it("invalidates lists query on success", async () => {
    mockCreateList.mockResolvedValueOnce({ id: "2", name: "工作" });
    mockFetchLists
      .mockResolvedValueOnce({ items: [{ id: "1", name: "购物" }] })
      .mockResolvedValueOnce({
        items: [
          { id: "1", name: "购物" },
          { id: "2", name: "工作" },
        ],
      });

    const client = createTestQueryClient();
    const { result } = renderHook(
      () => ({
        query: useListsQuery(),
        mutation: useCreateListMutation(),
      }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.query.data?.items).toHaveLength(1);

    act(() => {
      result.current.mutation.mutate({
        name: "工作",
        color: "#ef4444",
        icon: "briefcase",
        order: 1,
      });
    });

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));
    expect(mockCreateList).toHaveBeenCalledWith(
      {
        name: "工作",
        color: "#ef4444",
        icon: "briefcase",
        order: 1,
      },
      expect.anything(),
    );

    await waitFor(() => expect(mockFetchLists).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.query.data?.items).toHaveLength(2),
    );
  });
});
