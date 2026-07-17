import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function createQueryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

export function renderWithQuery(
  ui: ReactElement,
): RenderResult & { client: QueryClient } {
  const client = createTestQueryClient();
  return {
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
    client,
  };
}
