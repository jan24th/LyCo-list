import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  processCleanup: vi.fn(),
}));

vi.mock("./db.js", () => dbMock);

import { handler } from "./index.js";

const NOW = "2026-01-01T00:00:00.000Z";
const NOW_EPOCH = new Date(NOW).getTime();

describe("cleanup handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date(NOW) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes all jobs in a single batch when no cursor", async () => {
    dbMock.processCleanup.mockResolvedValueOnce({
      processedCount: 3,
    });

    await handler();

    expect(dbMock.processCleanup).toHaveBeenCalledTimes(1);
    expect(dbMock.processCleanup).toHaveBeenCalledWith(NOW, 100, undefined);
  });

  it("processes multiple batches when cursor is returned", async () => {
    const cursor = { PK: "DELETION_JOB#next", SK: "METADATA" };
    dbMock.processCleanup
      .mockResolvedValueOnce({
        processedCount: 2,
        nextCursor: cursor,
      })
      .mockResolvedValueOnce({
        processedCount: 1,
      });

    await handler();

    expect(dbMock.processCleanup).toHaveBeenCalledTimes(2);
    expect(dbMock.processCleanup).toHaveBeenNthCalledWith(2, NOW, 100, cursor);
  });

  it("stops when nextCursor is undefined", async () => {
    dbMock.processCleanup.mockResolvedValueOnce({
      processedCount: 5,
    });

    await handler();

    expect(dbMock.processCleanup).toHaveBeenCalledTimes(1);
  });

  it("handles zero results gracefully", async () => {
    dbMock.processCleanup.mockResolvedValueOnce({
      processedCount: 0,
    });

    await handler();

    expect(dbMock.processCleanup).toHaveBeenCalledTimes(1);
  });
});
