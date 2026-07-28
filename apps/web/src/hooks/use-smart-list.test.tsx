import type { SmartListType } from "@/lib/tasks";
import { renderWithQuery } from "@/lib/test-utils";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockFetchSmartList = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tasks", () => ({
  fetchSmartList: mockFetchSmartList,
  fetchTasksByList: vi.fn(),
}));

import { useSmartList } from "./use-smart-list";

describe("useSmartList", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls fetchSmartList with correct type", async () => {
    mockFetchSmartList.mockResolvedValueOnce({
      items: [{ id: "a", title: "test", isCompleted: false }],
    });

    const { result } = renderWithQuery(() => useSmartList("all"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchSmartList).toHaveBeenCalledWith("all", 100);
  });

  it("passes different smart list types", async () => {
    mockFetchSmartList.mockResolvedValueOnce({ items: [] });
    const { result } = renderWithQuery(() => useSmartList("today"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchSmartList).toHaveBeenCalledWith("today", 100);
  });

  it("does not fetch assigned when userId is undefined", () => {
    const { result } = renderWithQuery(() =>
      useSmartList("assigned", undefined),
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchSmartList).not.toHaveBeenCalled();
  });
});
