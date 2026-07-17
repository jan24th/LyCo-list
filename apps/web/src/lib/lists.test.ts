import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createList, fetchLists } from "./lists.js";

const { mockApiClient } = vi.hoisted(() => ({ mockApiClient: vi.fn() }));

vi.mock("./api.js", () => ({
  apiClient: mockApiClient,
}));

describe("fetchLists", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("fetches lists with default limit", async () => {
    mockApiClient.mockResolvedValueOnce({
      items: [{ id: "1", name: "购物" }],
    });

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
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("posts list input to api", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "2", name: "工作" });

    const result = await createList({
      name: "工作",
      color: "#ef4444",
      icon: "briefcase",
      order: 1,
    });

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists", {
      method: "POST",
      body: JSON.stringify({
        name: "工作",
        color: "#ef4444",
        icon: "briefcase",
        order: 1,
      }),
    });
    expect(result.name).toBe("工作");
  });
});
