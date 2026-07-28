import { renderWithQuery } from "@/lib/test-utils";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearch } from "./use-search";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("useSearch", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { type: "task", id: "t1", title: "买牛奶", updatedAt: "t" },
          { type: "list", id: "l1", title: "购物", updatedAt: "t" },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not fetch when query is empty", async () => {
    const { result } = renderWithQuery(() => useSearch(""));

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches when query is non-empty", async () => {
    const { result } = renderWithQuery(() => useSearch("牛奶"));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/search?q=%E7%89%9B%E5%A5%B6&limit=50",
      expect.objectContaining({}),
    );
  });

  it("returns search results", async () => {
    const { result } = renderWithQuery(() => useSearch("牛奶"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(2);
  });
});
