import type { List, ListInput } from "@lyco/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createList, fetchLists } from "./lists";

const { mockApiClient } = vi.hoisted(() => ({ mockApiClient: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiClient: mockApiClient,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchLists", () => {
  it("fetches lists with default limit", async () => {
    mockApiClient.mockResolvedValueOnce({ items: [{ id: "1", name: "购物" }] });

    const result = await fetchLists();

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists?limit=50");
    expect(result.items).toHaveLength(1);
  });

  it("passes cursor when provided", async () => {
    mockApiClient.mockResolvedValueOnce({ items: [] });

    await fetchLists("cursor-123");

    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/lists?limit=50&cursor=cursor-123",
    );
  });
});

describe("createList", () => {
  it("posts list input to api", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "2", name: "工作" });

    const input: ListInput = { name: "工作", color: "#ef4444", order: 1 };
    const result: List = await createList(input);

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists", {
      method: "POST",
      body: JSON.stringify(input),
    });
    expect(result.name).toBe("工作");
  });
});
