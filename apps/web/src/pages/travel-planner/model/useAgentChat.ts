import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import type { Trip } from "@/entities/trip";
import {
  fetchAgentMessages,
  postAgentMessage,
  type AgentFilePart,
  type AgentHistory,
  type AgentMessage,
} from "@/shared/api";
import { uploadTripMedia } from "@/shared/api/media";
import { config, queryKeys } from "@/shared/config";
import { looksLikeAgentThreadFollowUp } from "../lib/agentThreadFollowUp";
import { mergeTripToolEcho } from "./mergeTripToolEcho";

const MENTION_PATTERN = /@agent\b/i;

/**
 * Fold write-tool trip echoes onto the current trip cache.
 * Each tool only overlays the entity it mutated (Hyperdrive-safe).
 */
export function tripFromToolOutputs(
  messages: UIMessage[],
  previous: Trip | null = null,
): Trip | null {
  let merged: Trip | null = previous;
  let sawEcho = false;
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") continue;
      const output = part.output;
      if (!output || typeof output !== "object") continue;
      const record = output as { ok?: unknown; trip?: unknown };
      if (record.ok !== true || !isTripEcho(record.trip)) continue;
      sawEcho = true;
      merged = mergeTripToolEcho(
        merged,
        getToolName(part),
        "input" in part ? part.input : undefined,
        record.trip,
      );
    }
  }
  return sawEcho ? merged : null;
}

function isTripEcho(value: unknown): value is Trip {
  if (!value || typeof value !== "object") return false;
  const trip = value as Partial<Trip>;
  return (
    typeof trip.id === "string" &&
    Array.isArray(trip.stops) &&
    Array.isArray(trip.days) &&
    Array.isArray(trip.members)
  );
}

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
 * polling); `useChat` is the streaming buffer for `@agent` turns and for
 * thread follow-ups (e.g. “确认”) that need write tools + approval.
 * Once a stream settles and no tool is waiting on the user, the history
 * is refetched and the buffer cleared so nothing renders twice. */
export function useAgentChat(tripId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const streamDebugRef = useRef<{
    requestId?: string;
    turnId?: string;
  }>({});

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
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          streamDebugRef.current = {
            requestId: response.headers.get("x-request-id") ?? undefined,
            turnId: response.headers.get("x-agent-turn-id") ?? undefined,
          };
          return response;
        },
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

  // Apply write-tool trip echoes as they land — merge per op, never replace the
  // whole trip with a later half-stale echo (Hyperdrive). Do not invalidate
  // GET /trips/:id after a stream.
  useEffect(() => {
    const cached = queryClient.getQueryData<Trip>(queryKeys.trip(tripId)) ?? null;
    const echoed = tripFromToolOutputs(liveMessages, cached);
    if (!echoed) return;
    void queryClient.cancelQueries({ queryKey: queryKeys.trip(tripId) });
    queryClient.setQueryData(queryKeys.trip(tripId), echoed);
  }, [liveMessages, queryClient, tripId]);

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
        setMessages([]);
      });
  }, [status, liveMessages, queryClient, tripId, setMessages]);

  /** Route input: `@agent` and agent-thread follow-ups stream (write tools);
   * other plain messages land in the shared session and the server decides
   * whether the agent was addressed (ambient replies arrive via polling). */
  const send = async (text: string, files: File[] = []) => {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;

    const fileParts =
      files.length > 0 ? await uploadFilesAsParts(tripId, files) : [];

    const threadForFollowUp = [
      ...(history.data?.messages ?? []),
      ...chat.messages,
    ];
    const useStream =
      MENTION_PATTERN.test(trimmed) ||
      looksLikeAgentThreadFollowUp(threadForFollowUp, trimmed);

    if (useStream) {
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
    streamDebug: streamDebugRef.current,
  };
}
