import type { CursorKey } from "@lyco/shared";
import { processCleanup } from "./db.js";

/**
 * Cleanup Lambda — invoked by SST CronV2 (EventBridge Scheduler) every 5 minutes.
 * Processes expired DELETION_JOB records, hard-deleting tasks whose deletion
 * version matches. Supports cursor-based resume on timeout.
 */
export const handler = async (): Promise<void> => {
  const now = new Date().toISOString();
  let cursor: CursorKey | undefined;
  let totalProcessed = 0;

  // Process in batches until no more expired jobs or Lambda is about to timeout.
  // The 14-minute safety margin allows for Lambda's 15-minute max timeout.
  const deadlineMs = Date.now() + 14 * 60 * 1000;

  do {
    const result = await processCleanup(now, 100, cursor);
    totalProcessed += result.processedCount;
    cursor = result.nextCursor;

    // If we're close to timeout, stop and let the next invocation continue.
    // Note: cursor is not persisted across invocations — next Cron invocation
    // will re-scan from the start. This is safe because deletion is conditional
    // on deletionVersion matching, and scale is well within 14-minute capacity.
    if (Date.now() > deadlineMs) {
      console.log(
        `Cleanup timeout: processed ${totalProcessed} items, cursor: ${JSON.stringify(cursor)}`,
      );
      break;
    }
  } while (cursor);

  console.log(`Cleanup complete: processed ${totalProcessed} deletion jobs`);
};
