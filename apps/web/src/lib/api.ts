import { fetchAuthSession, signInWithRedirect } from "aws-amplify/auth";

export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    return accessToken ? accessToken.toString() : null;
  } catch {
    return null;
  }
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    throw new Error("VITE_API_URL is not configured");
  }

  const token = await getAuthToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (response.status === 401) {
    await signInWithRedirect();
    throw new Error("Unauthorized: redirecting to login");
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`API request failed: ${response.status} ${bodyText}`);
  }

  return response.json() as Promise<T>;
}
