import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

const MAX_QUERY_RETRIES = 3;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 30 * 60 * 1000,
            retry: (failureCount) => failureCount < MAX_QUERY_RETRIES,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8_000),
            // Avoid refetch storms when the browser tab regains focus (root cause of blank hangs).
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchIntervalInBackground: false,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
