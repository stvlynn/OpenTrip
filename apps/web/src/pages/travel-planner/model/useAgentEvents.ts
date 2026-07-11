import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAgentEvents, type AgentMessage, type AgentSuggestion } from "@/shared/api";
import { queryKeys } from "@/shared/config";

const POLL_INTERVAL_MS = 12_000;

/** Poll the shared agent session so every online member sees new messages and
 * intervention suggestions. Returns suggestions plus the latest polled message
 * batch (empty on the first cursor sync) for mention toasts. */
export function useAgentEvents(
  tripId: string,
  enabled: boolean,
): { suggestions: AgentSuggestion[]; newMessages: AgentMessage[] } {
  const queryClient = useQueryClient();
  const lastSeqRef = useRef(-1);
  const [newMessages, setNewMessages] = useState<AgentMessage[]>([]);

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
      const batch = first ? [] : data.messages;
      lastSeqRef.current = data.latestSeq;
      setNewMessages(batch);
      // Always refresh history when the cursor advances — even if this poll
      // returned an empty batch (e.g. stale Hyperdrive cache on the delta
      // query). Skipping invalidate left clients stuck past the new seq.
      if (!first) {
        // Agent history uses poolFresh — safe to invalidate. Do not invalidate
        // queryKeys.trip: Hyperdrive-cached GET /trips/:id can overwrite a
        // write-echo (e.g. a just-added stop) with a stale SELECT for ~60s.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.agentMessages(tripId),
        });
      }
    }
  }, [data, queryClient, tripId]);

  return {
    suggestions: data?.suggestions ?? [],
    newMessages,
  };
}
