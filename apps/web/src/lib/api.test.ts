import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, getAuthToken } from "./api";

const { mockFetchAuthSession, mockSignInWithRedirect } = vi.hoisted(() => ({
  mockFetchAuthSession: vi.fn(),
  mockSignInWithRedirect: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: mockFetchAuthSession,
  signInWithRedirect: mockSignInWithRedirect,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("getAuthToken", () => {
  it("returns the access token string when session exists", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: { accessToken: "access-token-123" },
    });

    const token = await getAuthToken();

    expect(token).toBe("access-token-123");
  });

  it("returns null when tokens are missing", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    const token = await getAuthToken();

    expect(token).toBeNull();
  });

  it("returns null when fetchAuthSession throws", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("no session"));

    const token = await getAuthToken();

    expect(token).toBeNull();
  });
});

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("throws when VITE_API_URL is not configured", async () => {
    vi.unstubAllEnvs();

    await expect(apiClient("/lists")).rejects.toThrow(
      "VITE_API_URL is not configured",
    );
  });

  it("sends Authorization header with access token", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: { accessToken: "token-abc" },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiClient("/lists");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/lists",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("omits Authorization header when no token is available", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiClient("/lists");

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
  });

  it("sets Content-Type to application/json when body is provided", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "1" }),
    });

    await apiClient("/lists", {
      method: "POST",
      body: JSON.stringify({ name: "购物" }),
    });

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("preserves custom Content-Type header", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiClient("/lists", {
      method: "POST",
      body: "text payload",
      headers: { "Content-Type": "text/plain" },
    });

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Content-Type")).toBe("text/plain");
  });

  it("returns parsed JSON on success", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ lists: [] }),
    });

    const result = await apiClient("/lists");

    expect(result).toEqual({ lists: [] });
  });

  it("redirects to login and throws on 401", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: { accessToken: "expired-token" },
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(apiClient("/lists")).rejects.toThrow(
      "Unauthorized: redirecting to login",
    );
    expect(mockSignInWithRedirect).toHaveBeenCalledWith();
  });

  it("throws on other non-ok responses", async () => {
    mockFetchAuthSession.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(apiClient("/lists")).rejects.toThrow(
      "API request failed: 500 Internal Server Error",
    );
  });
});
