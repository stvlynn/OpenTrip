import type {
  AgentMessage,
  AgentMessagePart,
  AgentMessageRole,
  AgentMessageSource,
  AgentSeverity,
  AgentSuggestion,
  AgentSuggestionStatus,
  PendingPatch,
} from "../../domain/agent";
import type { Trip } from "../../domain/trip";

export interface AgentMessageDto {
  id: string;
  seq: number;
  role: AgentMessageRole;
  parts: AgentMessagePart[];
  actorUserId: string | null;
  /** Display name of the human actor, resolved from trip membership. */
  actorName: string | null;
  source: AgentMessageSource;
  createdAt: string;
}

export interface AgentSuggestionDto {
  id: string;
  messageId: string | null;
  status: AgentSuggestionStatus;
  severity: AgentSeverity;
  reason: string;
  suggestionText: string;
  patch: PendingPatch;
  expiresAt: string | null;
  appliedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentHistoryDto {
  messages: AgentMessageDto[];
  suggestions: AgentSuggestionDto[];
}

export interface AgentEventsDto {
  latestSeq: number;
  messages: AgentMessageDto[];
  suggestions: AgentSuggestionDto[];
}

export function toAgentMessageDto(message: AgentMessage, trip: Trip): AgentMessageDto {
  const actorName = message.actorUserId
    ? (trip.memberByUserId(message.actorUserId)?.name ?? null)
    : null;
  return {
    id: message.id,
    seq: message.seq,
    role: message.role,
    parts: message.parts,
    actorUserId: message.actorUserId,
    actorName,
    source: message.source,
    createdAt: message.createdAt,
  };
}

export function toAgentSuggestionDto(suggestion: AgentSuggestion): AgentSuggestionDto {
  return {
    id: suggestion.id,
    messageId: suggestion.messageId,
    status: suggestion.status,
    severity: suggestion.severity,
    reason: suggestion.reason,
    suggestionText: suggestion.suggestionText,
    patch: suggestion.patch,
    expiresAt: suggestion.expiresAt,
    appliedBy: suggestion.appliedBy,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
  };
}
