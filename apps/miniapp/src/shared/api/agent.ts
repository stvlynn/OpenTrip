import type { Trip } from "@/entities/trip";

import { apiFetch } from "./client";

export type AgentMessageRole = "user" | "assistant" | "system";
export type AgentSuggestionStatus = "pending" | "applied" | "stale" | "expired";
export type AgentSeverity = "info" | "warning" | "critical";

export interface AgentMessagePart {
  type: string;
  text?: string;
}

export interface AgentMessage {
  id: string;
  seq: number;
  role: AgentMessageRole;
  parts: AgentMessagePart[];
  actorUserId: string | null;
  actorName: string | null;
  source: string;
  mentionedUserIds: string[];
  createdAt: string;
}

export interface AgentSuggestion {
  id: string;
  messageId: string | null;
  status: AgentSuggestionStatus;
  severity: AgentSeverity;
  reason: string;
  suggestionText: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface AgentHistory {
  messages: AgentMessage[];
  suggestions: AgentSuggestion[];
}

export interface AgentEvents {
  latestSeq: number;
  messages: AgentMessage[];
  suggestions: AgentSuggestion[];
}

export function fetchAgentStatus(): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>("/api/agent/status");
}

export function fetchAgentMessages(tripId: string): Promise<AgentHistory> {
  return apiFetch<AgentHistory>(
    `/api/trips/${encodeURIComponent(tripId)}/agent/messages`,
  );
}

export function postAgentMessage(
  tripId: string,
  text: string,
): Promise<{ addressed: boolean; message: AgentMessage }> {
  return apiFetch<{ addressed: boolean; message: AgentMessage }>(
    `/api/trips/${encodeURIComponent(tripId)}/agent/messages`,
    { method: "POST", body: { text } },
  );
}

/**
 * Cursor-based catch-up. The Mini Program polls this instead of consuming the
 * chat stream, which the platform's request API cannot read incrementally.
 */
export function fetchAgentEvents(
  tripId: string,
  afterSeq: number,
): Promise<AgentEvents> {
  return apiFetch<AgentEvents>(
    `/api/trips/${encodeURIComponent(tripId)}/agent/events?after=${afterSeq}`,
  );
}

export function approveAgentSuggestion(
  tripId: string,
  suggestionId: string,
  approved: boolean,
): Promise<Trip | { dismissed: boolean }> {
  return apiFetch<Trip | { dismissed: boolean }>(
    `/api/trips/${encodeURIComponent(tripId)}/agent/suggestions/${encodeURIComponent(suggestionId)}/approve`,
    { method: "POST", body: { id: suggestionId, approved } },
  );
}

/** Plain text of a message, ignoring non-text parts the shell cannot render. */
export function messageText(message: AgentMessage): string {
  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}
