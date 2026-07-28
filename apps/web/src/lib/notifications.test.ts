import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNotifications } from "./notifications";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("fetchNotifications", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "1", type: "REMINDER_DUE", title: "提醒", isRead: false },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("calls GET /api/notifications with limit", async () => {
    await fetchNotifications();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/notifications?limit=20",
      expect.objectContaining({}),
    );
  });

  it("returns notification items", async () => {
    const result = await fetchNotifications();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("1");
  });

  it("uses custom limit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    await fetchNotifications(10);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/notifications?limit=10",
      expect.objectContaining({}),
    );
  });
});
