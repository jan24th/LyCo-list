import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockProcessDue = vi.hoisted(() => vi.fn());
const mockFetchNotifications = vi.hoisted(() => vi.fn());

vi.mock("@/lib/reminders", () => ({
  processDueReminders: mockProcessDue,
}));
vi.mock("@/lib/notifications", () => ({
  fetchNotifications: mockFetchNotifications,
}));

import { usePolling } from "./use-polling";

describe("usePolling", () => {
  let visibilityCallbacks: Array<() => void> = [];
  let storedVisibilityState = "visible";

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessDue.mockResolvedValue({ processedCount: 1 });
    mockFetchNotifications.mockResolvedValue({ items: [] });

    visibilityCallbacks = [];
    storedVisibilityState = "visible";

    vi.spyOn(document, "addEventListener").mockImplementation(
      (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityCallbacks.push(handler as () => void);
        }
      },
    );
    vi.spyOn(document, "removeEventListener").mockReturnValue();

    Object.defineProperty(document, "visibilityState", {
      get: () => storedVisibilityState,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fireVisibilityChange = (state: "visible" | "hidden") => {
    storedVisibilityState = state;
    for (const cb of visibilityCallbacks) {
      cb();
    }
  };

  it("polls due reminders on mount", async () => {
    renderHook(() => usePolling());

    // Wait for async poll() to settle
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockProcessDue).toHaveBeenCalledTimes(1);
  });

  it("polls notifications on mount", async () => {
    renderHook(() => usePolling());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
  });

  it("does not crash when processDueReminders rejects", () => {
    mockProcessDue.mockRejectedValue(new Error("network error"));

    expect(() => {
      renderHook(() => usePolling());
    }).not.toThrow();
  });

  it("does not crash when fetchNotifications rejects", () => {
    mockFetchNotifications.mockRejectedValue(new Error("network error"));

    expect(() => {
      renderHook(() => usePolling());
    }).not.toThrow();
  });

  it("polls on visibility change to visible", async () => {
    renderHook(() => usePolling());
    await act(async () => {
      await Promise.resolve();
    });
    const initialCalls = mockProcessDue.mock.calls.length;

    await act(async () => {
      fireVisibilityChange("visible");
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockProcessDue.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("does not poll on visibility change to hidden", async () => {
    renderHook(() => usePolling());
    await act(async () => {
      await Promise.resolve();
    });
    const initialCalls = mockProcessDue.mock.calls.length;

    await act(async () => {
      fireVisibilityChange("hidden");
    });

    expect(mockProcessDue.mock.calls.length).toBe(initialCalls);
  });

  it("calls onRemindersProcessed callback", async () => {
    const callback = vi.fn();

    renderHook(() => usePolling({ onRemindersProcessed: callback }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(callback).toHaveBeenCalled();
  });

  it("calls onNotificationsFetched callback", async () => {
    const callback = vi.fn();

    renderHook(() => usePolling({ onNotificationsFetched: callback }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(callback).toHaveBeenCalled();
  });

  it("periodically polls on interval while visible", async () => {
    vi.useFakeTimers();
    renderHook(() => usePolling({ intervalMs: 5000 }));
    await act(async () => {
      await Promise.resolve();
    });
    const initialCalls = mockProcessDue.mock.calls.length;

    storedVisibilityState = "visible";

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockProcessDue.mock.calls.length).toBeGreaterThanOrEqual(
      initialCalls + 1,
    );
  });

  it("skips interval poll when hidden", async () => {
    vi.useFakeTimers();
    renderHook(() => usePolling({ intervalMs: 5000 }));
    await act(async () => {
      await Promise.resolve();
    });
    const initialCalls = mockProcessDue.mock.calls.length;

    storedVisibilityState = "hidden";

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockProcessDue.mock.calls.length).toBe(initialCalls);
  });

  it("cleans up interval on unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => usePolling());
    await act(async () => {
      await Promise.resolve();
    });
    const initialCalls = mockProcessDue.mock.calls.length;

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockProcessDue.mock.calls.length).toBe(initialCalls);
  });

  it("cleans up visibility listener on unmount", () => {
    const { unmount } = renderHook(() => usePolling());

    unmount();

    expect(document.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
