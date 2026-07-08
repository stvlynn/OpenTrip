import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { fetchAgentMessages, postAgentMessage } from "@/shared/api";
import { config, queryKeys } from "@/shared/config";

const MENTION_PATTERN = /@agent\b/i;

/** Shared-session chat for the agent panel.
 *
 * Persisted history lives in a React Query cache (shared across members via
 * polling); `useChat` is only the streaming buffer for replies this client
 * explicitly requested with an @agent mention. Once a stream settles, the
 * history is refetched and the buffer cleared so nothing renders twice. */
export function useAgentChat(tripId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: queryKeys.agentMessages(tripId),
    queryFn: () => fetchAgentMessages(tripId),
    enabled,
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${config.baseUrl}/api/trips/${tripId}/agent/chat`,
        credentials: "include",
        // The server owns the shared history; only the new message travels.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { message: messages[messages.length - 1] ?? null },
        }),
      }),
    [tripId],
  );

  const chat = useChat({
    id: `trip-agent-${tripId}`,
    transport,
  });

  const { status, messages: liveMessages, setMessages } = chat;
  const settledRef = useRef(false);
  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      settledRef.current = true;
      return;
    }
    if (!settledRef.current || liveMessages.length === 0) return;
    settledRef.current = false;
    void queryClient
      .invalidateQueries({ queryKey: queryKeys.agentMessages(tripId) })
      .then(() => setMessages([]));
  }, [status, liveMessages.length, queryClient, tripId, setMessages]);

  /** Route input: @agent mentions stream a reply; plain messages just land in
   * the shared session (ambient replies arrive via polling). */
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (MENTION_PATTERN.test(trimmed)) {
      await chat.sendMessage({ text: trimmed });
    } else {
      await postAgentMessage(tripId, trimmed);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentMessages(tripId),
      });
    }
  };

  return {
    history: history.data,
    historyPending: history.isPending,
    liveMessages: chat.messages,
    streaming: status === "streaming" || status === "submitted",
    error: chat.error,
    send,
  };
}
