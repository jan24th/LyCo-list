import { renderWithQuery } from "@/lib/test-utils";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LISTS_QUERY_KEY,
  useCreateListMutation,
  useListsQuery,
} from "./use-lists";

const { mockFetchLists, mockCreateList } = vi.hoisted(() => ({
  mockFetchLists: vi.fn(),
  mockCreateList: vi.fn(),
}));

vi.mock("@/lib/lists", () => ({
  fetchLists: mockFetchLists,
  createList: mockCreateList,
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
