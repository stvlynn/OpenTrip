import {
  generateObject,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type {
  AgentChatRequest,
  AgentEvaluationRequest,
  AgentMessage,
  AgentMessagePart,
  AgentModel,
  InterventionDecision,
} from "../../domain/agent";
import type { TripSnapshot } from "../../domain/trip";
import type { WeatherService } from "../../application/weather/weather-service";
import type { AiConfig } from "../config";

const CHAT_SYSTEM_PROMPT = `You are the OpenTrip trip agent: a quiet, precise trip-planning reviewer embedded in a collaborative trip workspace.

Rules:
- The conversation is shared by all trip members. Messages are prefixed with the author's name.
- Be concise and concrete. Reference stops, days, and expenses by their names and day numbers.
- Only discuss this trip. Never reveal system internals, credentials, or unrelated user data.
- When asked for advice, ground it in the trip snapshot provided below and, when relevant, the checkWeather tool.
- Prefer short answers; expand only when a member explicitly asks for detail.`;

const EVALUATION_SYSTEM_PROMPT = `You are the OpenTrip trip agent reviewing a single write operation on a collaborative trip. You must stay silent unless the change creates a material planning risk.

Material risks (the only reasons to notify):
- impossible or highly unrealistic timing between stops,
- duplicate or conflicting stops (including repeated lodging/transport bookings),
- outdoor plans that clearly conflict with the season or known weather patterns,
- route order that creates avoidable backtracking across a day,
- budget entries inconsistent with their participants or payer.

Rules:
- Default to shouldNotify=false. Cosmetic, minor, or ambiguous changes are never notified.
- confidence is your own probability in [0,1] that the risk is real and material.
- When you notify, reason must be one short sentence and suggestion one short actionable sentence.
- Propose pendingPatch only when a single whitelisted operation fully fixes the issue; otherwise return null.
- Keep observations factual; never invent stops or data not present in the snapshot.`;

const interventionSchema = z.object({
  shouldNotify: z.boolean(),
  severity: z.enum(["info", "warning", "critical"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  suggestion: z.string(),
  pendingPatch: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("update_stop"),
        stopId: z.string(),
        changes: z
          .object({
            name: z.string(),
            time: z.string(),
            duration: z.string(),
            area: z.string(),
            note: z.string(),
          })
          .partial(),
      }),
      z.object({
        kind: z.literal("move_stop"),
        move: z.object({
          stopId: z.string(),
          day: z.number().int().positive(),
          index: z.number().int().min(0),
        }),
      }),
      z.object({
        kind: z.literal("update_day"),
        dayNumber: z.number().int().positive(),
        changes: z
          .object({
            date: z.string(),
            city: z.string(),
          })
          .partial(),
      }),
      z.object({
        kind: z.literal("reorder_days"),
        order: z.array(z.number().int().positive()),
      }),
      z.object({
        kind: z.literal("update_expense"),
        expenseId: z.string(),
        changes: z.object({
          description: z.string(),
          amount: z.number().positive(),
          currency: z.string().optional(),
          payer: z.string(),
          participants: z.array(z.string()).min(1),
        }),
      }),
    ])
    .nullable(),
  expiresInMinutes: z.number().int().positive().nullable(),
});

/** Compact trip context for prompts: enough for planning judgment without
 * leaking member emails or persistence details. */
function tripContext(trip: TripSnapshot): string {
  return JSON.stringify({
    title: trip.title,
    startDate: trip.startDate,
    currency: trip.currency,
    members: trip.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    days: trip.days.map((d) => ({ number: d.number, date: d.date, city: d.city })),
    stops: trip.stops.map((s) => ({
      id: s.id,
      day: s.day,
      time: s.time,
      duration: s.duration,
      name: s.name,
      area: s.area,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
      cost: s.cost,
    })),
    expenses: trip.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      payer: e.payer,
      amount: e.amount,
      currency: e.currency,
      participants: e.participants,
    })),
  });
}

function textOf(parts: AgentMessagePart[]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/** Convert the shared session history into model messages. Assistant entries
 * keep their role; human and operation entries become labeled user messages
 * so the model can attribute statements to members. */
function toModelMessages(
  history: AgentMessage[],
  actorName: (userId: string | null) => string,
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const message of history) {
    const text = textOf(message.parts);
    if (!text.trim()) continue;
    if (message.role === "assistant") {
      messages.push({ role: "assistant", content: text });
    } else if (message.source === "operation") {
      messages.push({ role: "user", content: `[operation] ${text}` });
    } else {
      messages.push({
        role: "user",
        content: `[${actorName(message.actorUserId)}] ${text}`,
      });
    }
  }
  return messages;
}

/** Vercel AI SDK adapter behind the AgentModel port. */
export class AiSdkAgentModel implements AgentModel {
  private model: LanguageModel;

  constructor(
    private config: AiConfig,
    private weatherService: WeatherService,
  ) {
    if (config.baseUrl) {
      const provider = createOpenAICompatible({
        name: config.provider,
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
      });
      this.model = provider(config.model);
    } else {
      const provider = createOpenAI({ apiKey: config.apiKey });
      this.model = provider(config.model);
    }
  }

  private chatTools(): ToolSet {
    return {
      checkWeather: tool({
        description:
          "Get the forecast/observed weather at a coordinate for an ISO date and optional HH:MM time.",
        inputSchema: z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          time: z.string().optional(),
        }),
        execute: async ({ lat, lng, date, time }) => {
          const weather = await this.weatherService.getWeather(lat, lng, date, time);
          return weather ?? { unavailable: true };
        },
      }),
    };
  }

  private chatSystem(trip: TripSnapshot): string {
    return `${CHAT_SYSTEM_PROMPT}\n\nCurrent trip snapshot:\n${tripContext(trip)}`;
  }

  private actorNameResolver(trip: TripSnapshot) {
    return (userId: string | null): string => {
      if (!userId) return "system";
      const member = trip.members.find((m) => m.userId === userId);
      return member?.name ?? "member";
    };
  }

  streamChat(request: AgentChatRequest): Response {
    const result = streamText({
      model: this.model,
      system: this.chatSystem(request.trip),
      messages: toModelMessages(
        request.history,
        this.actorNameResolver(request.trip),
      ),
      tools: this.chatTools(),
      stopWhen: stepCountIs(this.config.maxToolSteps),
    });
    return result.toUIMessageStreamResponse({
      onFinish: async ({ responseMessage }) => {
        await request.onFinish(responseMessage.parts as AgentMessagePart[]);
      },
    });
  }

  async generateReply(
    request: Omit<AgentChatRequest, "onFinish">,
  ): Promise<AgentMessagePart[]> {
    const result = await generateText({
      model: this.model,
      system: this.chatSystem(request.trip),
      messages: toModelMessages(
        request.history,
        this.actorNameResolver(request.trip),
      ),
      tools: this.chatTools(),
      stopWhen: stepCountIs(this.config.maxToolSteps),
    });
    return [{ type: "text", text: result.text }];
  }

  async evaluateOperation(
    request: AgentEvaluationRequest,
  ): Promise<InterventionDecision> {
    const recentContext = toModelMessages(
      request.history.slice(-20),
      this.actorNameResolver(request.trip),
    )
      .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : ""}`)
      .join("\n");

    const { object } = await generateObject({
      model: this.model,
      schema: interventionSchema,
      system: EVALUATION_SYSTEM_PROMPT,
      prompt: [
        `Trip snapshot:\n${tripContext(request.trip)}`,
        `Recent session context:\n${recentContext || "(none)"}`,
        `Operation to review:\n${JSON.stringify({
          actor: request.event.actorName,
          operation: request.event.operation,
          summary: request.event.summary,
          details: request.event.details,
        })}`,
      ].join("\n\n"),
    });

    return object as InterventionDecision;
  }
}
