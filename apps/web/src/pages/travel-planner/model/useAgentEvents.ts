import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAgentEvents, type AgentSuggestion } from "@/shared/api";
import { queryKeys } from "@/shared/config";

const POLL_INTERVAL_MS = 12_000;

/** Poll the shared agent session so every online member sees new messages and
 * intervention suggestions. Returns the currently relevant suggestions. */
export function useAgentEvents(
  tripId: string,
  enabled: boolean,
): AgentSuggestion[] {
  const queryClient = useQueryClient();
  // Cursor of the last message seq this client has accounted for. -1 marks the
  // very first poll, which only establishes the cursor.
  const lastSeqRef = useRef(-1);

  const { data } = useQuery({
    queryKey: queryKeys.agentEvents(tripId),
    queryFn: () => fetchAgentEvents(tripId, Math.max(lastSeqRef.current, 0)),
    refetchInterval: POLL_INTERVAL_MS,
    enabled,
  });

  useEffect(() => {
    if (!data) return;
    const first = lastSeqRef.current === -1;
    if (data.latestSeq > lastSeqRef.current) {
      lastSeqRef.current = data.latestSeq;
      if (!first && data.messages.length > 0) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.agentMessages(tripId),
        });
      }
    }
  }, [data, queryClient, tripId]);

  return data?.suggestions ?? [];
}
