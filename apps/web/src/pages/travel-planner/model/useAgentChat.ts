import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import {
  fetchAgentMessages,
  postAgentMessage,
  type AgentFilePart,
  type AgentHistory,
  type AgentMessage,
} from "@/shared/api";
import { uploadTripMedia } from "@/shared/api/media";
import { config, queryKeys } from "@/shared/config";

const MENTION_PATTERN = /@agent\b/i;

/** Merge a POST …/messages echo into the shared history cache. */
export function appendAgentMessageToHistory(
  old: AgentHistory | undefined,
  message: AgentMessage,
): AgentHistory {
  if (!old) return { messages: [message], suggestions: [] };
  if (old.messages.some((m) => m.id === message.id)) return old;
  return { ...old, messages: [...old.messages, message] };
}

function hasPendingToolApproval(messages: UIMessage[]): boolean {
  return messages.some((m) =>
    m.parts.some(
      (p) =>
        isToolUIPart(p) &&
        p.state === "approval-requested" &&
        !p.approval?.isAutomatic,
    ),
  );
}

async function uploadFilesAsParts(
  tripId: string,
  files: File[],
): Promise<AgentFilePart[]> {
  const parts: AgentFilePart[] = [];
  for (const file of files) {
    const url = await uploadTripMedia(tripId, file);
    parts.push({
      type: "file",
      mediaType: mediaTypeOf(file),
      url,
      filename: file.name,
    });
  }
  return parts;
}

function mediaTypeOf(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

/** Shared-session chat for the agent panel.
 *
 * Persisted history lives in a React Query cache (shared across members via
 * polling); `useChat` is only the streaming buffer for replies this client
 * explicitly requested with an @agent mention, including AI SDK tool-approval
 * turns. Once a stream settles and no tool is waiting on the user, the history
 * is refetched and the buffer cleared so nothing renders twice. */
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
        // Send the full live turn so approval-responded parts reach the server
        // (AI SDK convertToModelMessages + tool execute).
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages },
        }),
      }),
    [tripId],
  );

  const chat = useChat({
    id: `trip-agent-${tripId}`,
    transport,
    // After the user approves/denies tools, auto-continue the stream so execute runs.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const { status, messages: liveMessages, setMessages } = chat;
  const settledRef = useRef(false);
  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      settledRef.current = true;
      return;
    }
    if (!settledRef.current || liveMessages.length === 0) return;
    // Keep the live buffer while a write tool is waiting for Approve/Deny.
    if (hasPendingToolApproval(liveMessages)) return;
    settledRef.current = false;
    void queryClient
      .invalidateQueries({ queryKey: queryKeys.agentMessages(tripId) })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
        setMessages([]);
      });
  }, [status, liveMessages, queryClient, tripId, setMessages]);

  /** Route input: @agent mentions stream a reply; plain messages land in the
   * shared session and the server decides whether the agent was addressed
   * (ambient replies arrive via polling). */
  const send = async (text: string, files: File[] = []) => {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;

    const fileParts =
      files.length > 0 ? await uploadFilesAsParts(tripId, files) : [];

    if (MENTION_PATTERN.test(trimmed)) {
      await chat.sendMessage({
        role: "user",
        parts: [
          ...fileParts,
          ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
        ],
      });
      return;
    }

    // Cancel in-flight history GETs so a stale Hyperdrive-cached response
    // cannot overwrite the write echo we are about to merge.
    await queryClient.cancelQueries({
      queryKey: queryKeys.agentMessages(tripId),
    });
    const { message } = await postAgentMessage(tripId, {
      text: trimmed || undefined,
      files: fileParts.length > 0 ? fileParts : undefined,
    });
    queryClient.setQueryData(
      queryKeys.agentMessages(tripId),
      (old: AgentHistory | undefined) =>
        appendAgentMessageToHistory(old, message),
    );
  };

  return {
    history: history.data,
    historyPending: history.isPending,
    liveMessages: chat.messages,
    streaming: status === "streaming" || status === "submitted",
    error: chat.error,
    send,
    addToolApprovalResponse: chat.addToolApprovalResponse,
  };
}
