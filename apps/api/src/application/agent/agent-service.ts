import { DomainError, NotFoundError } from "../../domain/shared/errors";
import type {
  AgentMessage,
  AgentModel,
  AgentSessionRepository,
  OperationEvent,
  PendingPatch,
} from "../../domain/agent";
import type { Trip, TripRepository } from "../../domain/trip";
import { ForbiddenError } from "../use-cases";
import { toTripDto, type TripDto } from "../dto";
import {
  toAgentMessageDto,
  toAgentSuggestionDto,
  type AgentEventsDto,
  type AgentHistoryDto,
} from "./dto";

/** Thrown when an apply attempt loses a race or targets a stale suggestion.
 * Mapped to HTTP 409 at the edge. */
export class ConflictError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Schedules work that must outlive the response (evaluations, ambient
 * replies). Routes pass `executionCtx.waitUntil` on Workers and a floating
 * promise on Node. */
export type Defer = (task: Promise<void>) => void;

export interface AgentServiceOptions {
  /** Minimum model confidence before a proactive suggestion is created. */
  proactiveThreshold: number;
  /** User messages since the last assistant reply that trigger an ambient reply. */
  replyThreshold: number;
}

const MENTION_PATTERN = /@agent\b/i;
const HISTORY_LIMIT = 200;
const CHAT_CONTEXT_LIMIT = 50;
/** Status changes stay in the polling window this long so clients can retire toasts. */
const SUGGESTION_UPDATE_WINDOW_MS = 10 * 60 * 1000;

function newId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function containsAgentMention(text: string): boolean {
  return MENTION_PATTERN.test(text);
}

/** Use cases for the shared per-trip agent session: chat, operation-triggered
 * evaluation, and suggestion lifecycle. Wired only when AI is configured. */
export class AgentService {
  constructor(
    private tripRepo: TripRepository,
    private sessionRepo: AgentSessionRepository,
    private model: AgentModel,
    private options: AgentServiceOptions,
  ) {}

  private async load(tripId: string): Promise<Trip> {
    const trip = await this.tripRepo.findById(tripId);
    if (!trip) {
      throw new NotFoundError("trip_not_found", `Trip ${tripId} not found`);
    }
    return trip;
  }

  /** Members (including viewers) may read and talk; non-members get 404. */
  private async loadReadable(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.load(tripId);
    if (!trip.permissionsFor(userId).isMember) {
      throw new NotFoundError("trip_not_found", `Trip ${tripId} not found`);
    }
    return trip;
  }

  private async loadEditable(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.loadReadable(tripId, userId);
    if (!trip.permissionsFor(userId).canEdit) {
      throw new ForbiddenError(
        "insufficient_permissions",
        "You do not have permission to edit this trip",
      );
    }
    return trip;
  }

  async getHistory(tripId: string, userId: string): Promise<AgentHistoryDto> {
    const trip = await this.loadReadable(tripId, userId);
    const [messages, suggestions] = await Promise.all([
      this.sessionRepo.listMessages(tripId, { limit: HISTORY_LIMIT }),
      this.sessionRepo.listActiveSuggestions(
        tripId,
        userId,
        new Date(Date.now() - SUGGESTION_UPDATE_WINDOW_MS).toISOString(),
      ),
    ]);
    return {
      messages: messages.map((m) => toAgentMessageDto(m, trip)),
      suggestions: suggestions.map(toAgentSuggestionDto),
    };
  }

  async listEvents(
    tripId: string,
    userId: string,
    afterSeq: number,
  ): Promise<AgentEventsDto> {
    const trip = await this.loadReadable(tripId, userId);
    const [latestSeq, messages, suggestions] = await Promise.all([
      this.sessionRepo.latestSeq(tripId),
      this.sessionRepo.listMessages(tripId, { afterSeq, limit: 50 }),
      this.sessionRepo.listActiveSuggestions(
        tripId,
        userId,
        new Date(Date.now() - SUGGESTION_UPDATE_WINDOW_MS).toISOString(),
      ),
    ]);
    return {
      latestSeq,
      messages: messages.map((m) => toAgentMessageDto(m, trip)),
      suggestions: suggestions.map(toAgentSuggestionDto),
    };
  }

  /** Persist a plain (non-mention) member message. When the ambient reply
   * threshold is reached, a reply is generated in the background and lands in
   * the session for everyone via polling. */
  async postMessage(
    tripId: string,
    userId: string,
    text: string,
    defer: Defer,
  ): Promise<{ thresholdReached: boolean }> {
    const trip = await this.loadReadable(tripId, userId);
    const trimmed = text.trim();
    if (!trimmed) throw new DomainError("empty_message", "Message text is required");

    await this.appendMessage(trip, {
      role: "user",
      parts: [{ type: "text", text: trimmed }],
      actorUserId: userId,
      source: containsAgentMention(trimmed) ? "mention" : "chat",
    });

    const sinceLastReply =
      await this.sessionRepo.countUserMessagesSinceLastAssistant(tripId);
    const thresholdReached =
      this.options.replyThreshold > 0 &&
      sinceLastReply >= this.options.replyThreshold;

    if (thresholdReached) {
      defer(this.generateAmbientReply(tripId));
    }
    return { thresholdReached };
  }

  /** Stream a reply to an explicit chat/mention message. The user message (if
   * present) is persisted before generation; the assistant message is
   * persisted when the stream finishes. */
  async streamChat(
    tripId: string,
    userId: string,
    text: string | null,
  ): Promise<Response> {
    const trip = await this.loadReadable(tripId, userId);

    if (text !== null) {
      const trimmed = text.trim();
      if (!trimmed) throw new DomainError("empty_message", "Message text is required");
      await this.appendMessage(trip, {
        role: "user",
        parts: [{ type: "text", text: trimmed }],
        actorUserId: userId,
        source: containsAgentMention(trimmed) ? "mention" : "chat",
      });
    }

    const history = await this.sessionRepo.listMessages(tripId, {
      limit: CHAT_CONTEXT_LIMIT,
    });
    return this.model.streamChat({
      trip: trip.toSnapshot(),
      history,
      onFinish: async (parts) => {
        await this.appendMessage(trip, {
          role: "assistant",
          parts,
          actorUserId: null,
          source: "chat",
        });
      },
    });
  }

  /** Record a whitelisted write operation in the session and schedule the
   * AI-judged intervention decision. */
  async recordOperation(event: OperationEvent, defer: Defer): Promise<void> {
    const trip = await this.load(event.tripId);
    await this.appendMessage(trip, {
      role: "system",
      parts: [{ type: "text", text: event.summary }],
      actorUserId: event.actorUserId,
      source: "operation",
    });
    defer(this.evaluateOperation(trip, event));
  }

  /** Record an @agent mention from a collaborative surface (stop comments) and
   * schedule an ambient reply so the panel session picks it up. */
  async recordMention(
    tripId: string,
    userId: string,
    text: string,
    defer: Defer,
  ): Promise<void> {
    const trip = await this.load(tripId);
    await this.appendMessage(trip, {
      role: "user",
      parts: [{ type: "text", text }],
      actorUserId: userId,
      source: "mention",
    });
    defer(this.generateAmbientReply(tripId));
  }

  async applySuggestion(
    tripId: string,
    suggestionId: string,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const suggestion = await this.sessionRepo.findSuggestion(suggestionId);
    if (!suggestion || suggestion.tripId !== tripId) {
      throw new NotFoundError("suggestion_not_found", "Suggestion not found");
    }
    if (suggestion.status !== "pending") {
      throw new ConflictError(
        "suggestion_not_pending",
        "This suggestion has already been resolved",
      );
    }
    if (suggestion.expiresAt && new Date(suggestion.expiresAt) <= new Date()) {
      await this.sessionRepo.setStatus(suggestionId, "expired");
      throw new ConflictError("suggestion_expired", "This suggestion has expired");
    }
    if (trip.toSnapshot().version !== suggestion.tripVersion) {
      await this.sessionRepo.setStatus(suggestionId, "stale");
      throw new ConflictError(
        "suggestion_stale",
        "The trip changed since this suggestion was created",
      );
    }

    // Claim first so concurrent applies cannot double-run the domain operation.
    const claimed = await this.sessionRepo.claimForApply(suggestionId, userId);
    if (!claimed) {
      throw new ConflictError(
        "suggestion_not_pending",
        "This suggestion has already been resolved",
      );
    }

    try {
      await this.applyPatch(trip, suggestion.patch);
    } catch (err) {
      // The patch no longer fits the trip; surface it as stale, not applied.
      await this.sessionRepo.setStatus(suggestionId, "stale");
      throw err;
    }

    const actorName = trip.memberByUserId(userId)?.name ?? "A member";
    await this.appendMessage(trip, {
      role: "system",
      parts: [
        { type: "text", text: `${actorName} applied the suggestion: ${suggestion.suggestionText}` },
      ],
      actorUserId: userId,
      source: "threshold",
    });

    // Reload so the DTO reflects the bumped version and persisted state.
    const updated = await this.load(tripId);
    return toTripDto(updated, userId);
  }

  /** Hide a suggestion's toast for this user only; the shared record stays. */
  async dismissSuggestion(
    tripId: string,
    suggestionId: string,
    userId: string,
  ): Promise<void> {
    await this.loadReadable(tripId, userId);
    const suggestion = await this.sessionRepo.findSuggestion(suggestionId);
    if (!suggestion || suggestion.tripId !== tripId) {
      throw new NotFoundError("suggestion_not_found", "Suggestion not found");
    }
    await this.sessionRepo.dismissForUser(suggestionId, userId);
  }

  private async appendMessage(
    trip: Trip,
    message: Pick<AgentMessage, "role" | "parts" | "actorUserId" | "source">,
  ): Promise<AgentMessage> {
    return this.sessionRepo.appendMessage({
      id: newId("am"),
      tripId: trip.id,
      tripVersion: trip.toSnapshot().version,
      ...message,
    });
  }

  private async generateAmbientReply(tripId: string): Promise<void> {
    try {
      const trip = await this.load(tripId);
      const history = await this.sessionRepo.listMessages(tripId, {
        limit: CHAT_CONTEXT_LIMIT,
      });
      const parts = await this.model.generateReply({
        trip: trip.toSnapshot(),
        history,
      });
      await this.appendMessage(trip, {
        role: "assistant",
        parts,
        actorUserId: null,
        source: "threshold",
      });
    } catch (err) {
      console.error("Agent ambient reply failed:", err);
    }
  }

  private async evaluateOperation(trip: Trip, event: OperationEvent): Promise<void> {
    try {
      const history = await this.sessionRepo.listMessages(event.tripId, {
        limit: CHAT_CONTEXT_LIMIT,
      });
      const decision = await this.model.evaluateOperation({
        trip: trip.toSnapshot(),
        event,
        history,
      });

      if (!decision.shouldNotify) return;

      const notify =
        decision.confidence >= this.options.proactiveThreshold &&
        decision.pendingPatch !== null;

      if (!notify) {
        // Quiet context: visible in the session timeline, but no toast.
        await this.appendMessage(trip, {
          role: "system",
          parts: [{ type: "text", text: `Observation: ${decision.reason}` }],
          actorUserId: null,
          source: "operation",
        });
        return;
      }

      const message = await this.appendMessage(trip, {
        role: "assistant",
        parts: [
          { type: "text", text: `${decision.reason}\n\n${decision.suggestion}` },
        ],
        actorUserId: null,
        source: "threshold",
      });
      await this.sessionRepo.createSuggestion({
        id: newId("as"),
        tripId: event.tripId,
        messageId: message.id,
        severity: decision.severity,
        confidence: decision.confidence,
        reason: decision.reason,
        suggestionText: decision.suggestion,
        patch: decision.pendingPatch!,
        tripVersion: trip.toSnapshot().version,
        expiresAt: decision.expiresInMinutes
          ? new Date(Date.now() + decision.expiresInMinutes * 60 * 1000).toISOString()
          : null,
      });
    } catch (err) {
      console.error("Agent operation evaluation failed:", err);
    }
  }

  /** Run the pending patch through the normal domain operations. */
  private async applyPatch(trip: Trip, patch: PendingPatch): Promise<void> {
    switch (patch.kind) {
      case "update_stop":
        trip.updateStop(patch.stopId, patch.changes);
        await this.tripRepo.save(trip);
        return;
      case "move_stop":
        trip.moveStop(patch.move);
        await this.tripRepo.save(trip);
        return;
      case "update_day": {
        const day = trip.updateDay(patch.dayNumber, patch.changes);
        await this.tripRepo.updateDay(trip.id, day);
        return;
      }
      case "reorder_days":
        trip.reorderDays(patch.order);
        await this.tripRepo.reorderDays(trip);
        return;
      case "update_expense":
        trip.updateExpense(patch.expenseId, patch.changes);
        await this.tripRepo.save(trip);
        return;
    }
  }
}
