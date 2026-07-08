import type { TripSnapshot } from "../trip";
import type {
  AgentMessage,
  AgentMessagePart,
  AgentSuggestion,
  InterventionDecision,
  NewAgentMessage,
  NewAgentSuggestion,
  OperationEvent,
} from "./types";

/** Persistence port for the per-trip agent session (messages + suggestions). */
export interface AgentSessionRepository {
  listMessages(
    tripId: string,
    opts?: { afterSeq?: number; limit?: number },
  ): Promise<AgentMessage[]>;
  appendMessage(message: NewAgentMessage): Promise<AgentMessage>;
  /** User-authored messages since the last assistant reply, for the ambient
   * reply threshold. */
  countUserMessagesSinceLastAssistant(tripId: string): Promise<number>;
  latestSeq(tripId: string): Promise<number>;

  createSuggestion(suggestion: NewAgentSuggestion): Promise<AgentSuggestion>;
  findSuggestion(id: string): Promise<AgentSuggestion | null>;
  /** Pending suggestions not dismissed by the given user, plus any suggestion
   * whose status changed after `updatedAfter` (so clients can retire toasts). */
  listActiveSuggestions(
    tripId: string,
    userId: string,
    updatedAfter: string,
  ): Promise<AgentSuggestion[]>;
  /** Atomically claim a pending suggestion for apply. Returns false when it
   * was no longer pending (someone else applied or it went stale). */
  claimForApply(id: string, userId: string): Promise<boolean>;
  setStatus(id: string, status: "pending" | "stale" | "expired"): Promise<void>;
  dismissForUser(id: string, userId: string): Promise<void>;
}

export interface AgentChatRequest {
  trip: TripSnapshot;
  history: AgentMessage[];
  /** Called with the assistant's UI-message parts once the stream completes. */
  onFinish: (parts: AgentMessagePart[]) => Promise<void>;
}

export interface AgentEvaluationRequest {
  trip: TripSnapshot;
  event: OperationEvent;
  /** Recent session context so repeated notifications stay suppressed. */
  history: AgentMessage[];
}

/** Model port. Implemented in infrastructure with the Vercel AI SDK; the
 * domain and application layers never touch provider APIs directly. */
export interface AgentModel {
  /** Stream a chat reply as a web Response carrying an AI SDK UI message stream. */
  streamChat(request: AgentChatRequest): Response;
  /** Generate a non-streaming reply (ambient threshold replies). */
  generateReply(request: Omit<AgentChatRequest, "onFinish">): Promise<AgentMessagePart[]>;
  /** Judge a whitelisted operation and return a structured decision. */
  evaluateOperation(request: AgentEvaluationRequest): Promise<InterventionDecision>;
}
