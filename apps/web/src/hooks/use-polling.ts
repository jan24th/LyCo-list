import { fetchNotifications } from "@/lib/notifications";
import { processDueReminders } from "@/lib/reminders";
import { useCallback, useEffect, useRef } from "react";

interface UsePollingOptions {
  /** Polling interval in milliseconds (default: 30000) */
  intervalMs?: number;
  /** Called when due reminders are processed */
  onRemindersProcessed?: () => void;
  /** Called when new notifications are fetched */
  onNotificationsFetched?: () => void;
}

/**
 * Polls for due reminders and new notifications.
 *
 * Triggers on:
 * - Mount (app open)
 * - Visibility change to visible (tab switch / foreground)
 * - Periodic interval while visible
 */
export function usePolling(options: UsePollingOptions = {}) {
  const { intervalMs = 30000 } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const poll = useCallback(async () => {
    const { onRemindersProcessed, onNotificationsFetched } = optionsRef.current;

    try {
      await processDueReminders();
      onRemindersProcessed?.();
    } catch {
      // Polling failures are silent
    }

    try {
      await fetchNotifications();
      onNotificationsFetched?.();
    } catch {
      // Polling failures are silent
    }
  }, []);

  useEffect(() => {
    // Initial poll on mount
    poll();

    // Periodic polling while visible
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        poll();
      }
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [poll, intervalMs]);
}
