import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processDueReminders } from "./reminders";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("processDueReminders", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ processedCount: 3 }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("calls POST /api/reminders/process-due", async () => {
    await processDueReminders();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/reminders/process-due",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns processed count", async () => {
    const result = await processDueReminders();

    expect(result.processedCount).toBe(3);
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    });

    await expect(processDueReminders()).rejects.toThrow();
  });
});
