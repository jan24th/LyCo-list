import type { List, ListInput } from "@lyco/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  createList,
  deleteList,
  fetchLists,
  restoreList,
  updateList,
} from "./lists";

const { mockApiClient } = vi.hoisted(() => ({ mockApiClient: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiClient: mockApiClient };
});

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

describe("deleteList", () => {
  it("sends DELETE with expectedVersion as query param", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "1", version: 2 });

    const result = await deleteList("1", 1);

    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/lists/1?expectedVersion=1",
      { method: "DELETE" },
    );
    expect(result.version).toBe(2);
  });

  it("converts 409 ApiError to refresh-and-retry message", async () => {
    mockApiClient.mockRejectedValueOnce(
      new ApiError(409, "conflict", "请求失败：409"),
    );

    await expect(deleteList("1", 1)).rejects.toThrow(
      "数据已过期，请刷新后重试",
    );
  });

  it("rethrows non-409 errors unchanged", async () => {
    const failure = new ApiError(500, "boom", "请求失败：500");
    mockApiClient.mockRejectedValueOnce(failure);

    await expect(deleteList("1", 1)).rejects.toBe(failure);
  });
});

describe("restoreList", () => {
  it("sends POST restore with expectedVersion in body", async () => {
    mockApiClient.mockResolvedValueOnce({ id: "1", version: 3 });

    const result = await restoreList("1", 2);

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists/1/restore", {
      method: "POST",
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(result.version).toBe(3);
  });

  it("converts 409 ApiError to refresh-and-retry message", async () => {
    mockApiClient.mockRejectedValueOnce(
      new ApiError(409, "conflict", "请求失败：409"),
    );

    await expect(restoreList("1", 2)).rejects.toThrow(
      "数据已过期，请刷新后重试",
    );
  });

  it("rethrows non-409 errors unchanged", async () => {
    const failure = new ApiError(500, "boom", "请求失败：500");
    mockApiClient.mockRejectedValueOnce(failure);

    await expect(restoreList("1", 2)).rejects.toBe(failure);
  });
});

describe("updateList", () => {
  it("patches list with expectedVersion", async () => {
    mockApiClient.mockResolvedValueOnce({
      id: "1",
      name: "新名称",
      version: 2,
    });

    const result = await updateList("1", {
      name: "新名称",
      expectedVersion: 1,
    });

    expect(mockApiClient).toHaveBeenCalledWith("/api/lists/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "新名称", expectedVersion: 1 }),
    });
    expect(result.version).toBe(2);
  });

  it("throws refresh-and-retry message on 409", async () => {
    mockApiClient.mockRejectedValueOnce(
      new ApiError(409, '{"code":"CONFLICT"}', "conflict"),
    );

    await expect(
      updateList("1", { name: "x", expectedVersion: 1 }),
    ).rejects.toThrow("数据已过期，请刷新后重试");
  });

  it("rethrows non-409 errors unchanged", async () => {
    const serverError = new ApiError(500, "boom", "server error");
    mockApiClient.mockRejectedValueOnce(serverError);

    await expect(
      updateList("1", { name: "x", expectedVersion: 1 }),
    ).rejects.toBe(serverError);
  });
});
