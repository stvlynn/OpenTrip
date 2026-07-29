import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { installAbortController } from "@/shared/lib/abort-controller";
import { SessionProvider } from "@/shared/session";

import "./app.scss";

// React Query builds an AbortController per fetch, which the Mini Program
// runtime does not provide. Install the shim before any query can run.
installAbortController();

/**
 * Hyperdrive can serve a stale read for up to a minute after a write, so trip
 * data is refreshed from mutation responses (write-echo) rather than by
 * refetching lists immediately. See docs/frontend/data-caching.md.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
