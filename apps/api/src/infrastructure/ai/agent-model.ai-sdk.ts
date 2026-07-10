import {
  convertToModelMessages,
  generateId,
  generateObject,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type Experimental_DownloadFunction,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type {
  AgentAddressedRequest,
  AgentChatRequest,
  AgentClientUIMessage,
  AgentEvaluationRequest,
  AgentMessage,
  AgentMessagePart,
  AgentModel,
  AgentToolApplyResult,
  InterventionDecision,
  PendingPatch,
} from "../../domain/agent";
import type { TripSnapshot } from "../../domain/trip";
import type { WeatherService } from "../../application/weather/weather-service";
import type { GeoService } from "../../application/geo/geo-service";
import type { FileStorage } from "../../application/storage";
import {
  isTripMediaStoragePath,
  storageNamespaceOf,
  storagePathFromPublicUrl,
} from "../../application/storage";
import { isAgentFilePart } from "../../application/agent/file-parts";
import {
  listWriteOps,
  pendingPatchSchema,
  writeToolNames,
} from "../../application/trip/ops";
import type { AiConfig } from "../config";

const NOTE_CONTEXT_MAX = 2_000;

function chatSystemPrompt(): string {
  const tools = writeToolNames().join(", ");
  return `You are the OpenTrip trip agent: a quiet, precise trip-planning collaborator embedded in a collaborative trip workspace.

Rules:
- The conversation is shared by all trip members. Messages are prefixed with the author's name.
- Be concise and concrete. Reference stops, days, and expenses by their names and day numbers.
- Only discuss this trip. Never reveal system internals, credentials, or unrelated user data.
- When asked for advice, ground it in the trip snapshot provided below and available tools.
- Prefer short answers; expand only when a member explicitly asks for detail.
- You have the same trip-edit capabilities as a human editor. Prefer calling write tools over telling the member to do it manually.
- Write tools (${tools}) pause for member approval before they run — never claim a change already applied.
- For existing entities, only use stop/day/expense/member ids from the trip snapshot. insertStop and addExpense create new ids after approval.
- checkWeather, placeSearch, placeNearby, placeDetail, routeCompute, routeMatrix, reviewLookup, and readTripMedia are read-only and do not need approval.
- Members may attach images, PDFs, or text files in chat. Stop notes in the snapshot may embed trip upload URLs — call readTripMedia with those URLs when you need to see the file contents.
- Use geo read tools to discover places and travel times, then propose insertStop (or other write tools) when the member wants a found place added to the trip.`;
}

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
- Propose pendingPatch only when a single trip-edit operation fully fixes the issue; otherwise return null.
- Keep observations factual; never invent stop/day/expense ids not present in the snapshot (except insert_stop / add_expense which create new rows).
Respond with a JSON object matching the decision schema.`;

const ADDRESSED_SYSTEM_PROMPT = `You are the OpenTrip trip agent deciding whether a member message in the shared trip session is addressing you.

Return addressed=true only when the latest message clearly expects a reply from the agent, for example:
- an explicit @agent mention,
- a direct question or request aimed at the agent ("can you…", "帮我…", "agent, …"),
- asking the agent to check, suggest, fix, or explain something about this trip.

Return addressed=false for:
- member-to-member chatter that does not involve the agent,
- status updates, acknowledgements, or planning notes with no ask,
- messages that only discuss the trip among humans without inviting the agent.

Default to addressed=false when unsure.
Respond with a JSON object: {"addressed": true|false}.`;

const interventionSchema = z.object({
  shouldNotify: z.boolean(),
  severity: z.enum(["info", "warning", "critical"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  suggestion: z.string(),
  pendingPatch: pendingPatchSchema.nullable(),
  expiresInMinutes: z.number().int().positive().nullable(),
});

const addressedSchema = z.object({
  addressed: z.boolean(),
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
      note: s.note
        ? s.note.length > NOTE_CONTEXT_MAX
          ? `${s.note.slice(0, NOTE_CONTEXT_MAX)}…`
          : s.note
        : "",
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

type InlineFilePart = {
  type: "file";
  data: { type: "data"; data: Uint8Array };
  mediaType: string;
  filename?: string;
};

/**
 * Resolve persisted file parts to inline bytes via FileStorage.
 *
 * AI SDK's default URL downloader blocks localhost/private hosts (SSRF guard).
 * Best practice for private uploads: never ask the SDK to HTTP-fetch them —
 * load from our storage port and pass `{ type: "data" }` instead.
 */
async function fileContentParts(
  parts: AgentMessagePart[],
  fileStorage: FileStorage,
  tripId: string,
): Promise<InlineFilePart[]> {
  const tripNamespace = storageNamespaceOf(tripId);
  const content: InlineFilePart[] = [];
  for (const part of parts) {
    if (!isAgentFilePart(part)) continue;
    const path = storagePathFromPublicUrl(part.url);
    if (
      !path ||
      !isTripMediaStoragePath(path) ||
      path.split("/")[1] !== tripNamespace
    ) {
      continue;
    }
    const file = await fileStorage.read(path);
    if (!file) continue;
    content.push({
      type: "file",
      data: { type: "data", data: file.content },
      mediaType: file.contentType || part.mediaType,
      ...(part.filename ? { filename: part.filename } : {}),
    });
  }
  return content;
}

/**
 * AI SDK `experimental_download` for trip-owned upload URLs.
 * Reads from FileStorage so localhost/dev public URLs never hit the SSRF guard.
 * Non-trip URLs are passed through only when the model supports them natively.
 */
export function createTripMediaDownload(
  fileStorage: FileStorage,
  tripId: string,
): Experimental_DownloadFunction {
  const tripNamespace = storageNamespaceOf(tripId);
  return async (requestedDownloads) =>
    Promise.all(
      requestedDownloads.map(async ({ url, isUrlSupportedByModel }) => {
        const path = storagePathFromPublicUrl(url.href);
        if (
          path &&
          isTripMediaStoragePath(path) &&
          path.split("/")[1] === tripNamespace
        ) {
          const file = await fileStorage.read(path);
          if (!file) {
            throw new Error(`Trip media not found for ${url.href}`);
          }
          return { data: file.content, mediaType: file.contentType };
        }
        // Model can fetch public HTTPS itself — do not download here.
        if (isUrlSupportedByModel) return null;
        throw new Error(
          `Refusing to download non-trip media URL (${url.hostname})`,
        );
      }),
    );
}

/** Convert the shared session history into model messages. Assistant entries
 * keep their role; human and operation entries become labeled user messages
 * so the model can attribute statements to members. File parts stay multimodal. */
async function toModelMessages(
  history: AgentMessage[],
  actorName: (userId: string | null) => string,
  fileStorage: FileStorage,
  tripId: string,
): Promise<ModelMessage[]> {
  const messages: ModelMessage[] = [];
  for (const message of history) {
    const text = textOf(message.parts);
    const files = await fileContentParts(message.parts, fileStorage, tripId);

    if (message.role === "assistant") {
      if (!text.trim()) continue;
      messages.push({ role: "assistant", content: text });
      continue;
    }

    if (!text.trim() && files.length === 0) continue;

    const label =
      message.source === "operation"
        ? "[operation]"
        : `[${actorName(message.actorUserId)}]`;
    const labeledText = text.trim()
      ? `${label} ${text}`
      : `${label} (attachment)`;

    if (files.length === 0) {
      messages.push({ role: "user", content: labeledText });
      continue;
    }

    messages.push({
      role: "user",
      content: [{ type: "text", text: labeledText }, ...files],
    });
  }
  return messages;
}

function contextSnippetFromMessages(messages: ModelMessage[]): string {
  return messages
    .map((m) => {
      if (typeof m.content === "string") return `${m.role}: ${m.content}`;
      if (!Array.isArray(m.content)) return `${m.role}:`;
      const text = m.content
        .filter(
          (p): p is { type: "text"; text: string } =>
            typeof p === "object" &&
            p !== null &&
            "type" in p &&
            p.type === "text" &&
            "text" in p &&
            typeof p.text === "string",
        )
        .map((p) => p.text)
        .join(" ");
      const fileCount = m.content.filter(
        (p) => typeof p === "object" && p !== null && "type" in p && p.type === "file",
      ).length;
      const suffix = fileCount > 0 ? ` [${fileCount} attachment(s)]` : "";
      return `${m.role}: ${text}${suffix}`;
    })
    .join("\n");
}

function clientHasToolApprovalResponse(messages: AgentClientUIMessage[]): boolean {
  return messages.some((m) =>
    m.parts.some((p) => {
      if (typeof p !== "object" || p === null) return false;
      const state = (p as { state?: unknown }).state;
      const approval = (p as { approval?: { approved?: unknown } }).approval;
      return (
        state === "approval-responded" ||
        (typeof approval === "object" &&
          approval !== null &&
          typeof approval.approved === "boolean")
      );
    }),
  );
}

/** Build AI SDK toolApproval from the trip ops catalog. */
function buildWriteToolApproval(canEdit: boolean) {
  const denied = {
    type: "denied" as const,
    reason: "Only editors and owners can apply trip changes",
  };
  const entry = canEdit ? ("user-approval" as const) : denied;
  return Object.fromEntries(
    listWriteOps().map((op) => [op.toolName, entry]),
  ) as Record<string, typeof entry>;
}

/**
 * Generate write tools from the trip ops catalog (Novu/Mastra-style registry
 * projection). Execute only runs after AI SDK tool approval.
 */
function buildWriteTools(
  applyPatch: (patch: PendingPatch) => Promise<AgentToolApplyResult>,
): ToolSet {
  return Object.fromEntries(
    listWriteOps().map((op) => [
      op.toolName,
      tool({
        description: op.description,
        inputSchema: op.inputSchema,
        execute: async (input: unknown) => {
          const patch = op.toPatch(input as never);
          return applyPatch(patch);
        },
      }),
    ]),
  );
}

/** Vercel AI SDK adapter behind the AgentModel port. */
export class AiSdkAgentModel implements AgentModel {
  private model: LanguageModel;

  constructor(
    private config: AiConfig,
    private weatherService: WeatherService,
    private geoService: GeoService,
    private fileStorage: FileStorage,
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

  /** Read-only tools always available (no approval). Not part of trip ops.
   * Weather, geo, and trip media go through application/storage ports. */
  private readTools(tripId: string): ToolSet {
    return {
      ...buildWeatherReadTools(this.weatherService),
      ...buildGeoReadTools(this.geoService),
      ...buildTripMediaReadTools(this.fileStorage, tripId),
    };
  }

  private chatTools(
    tripId: string,
    applyPatch?: (patch: PendingPatch) => Promise<AgentToolApplyResult>,
  ): ToolSet {
    if (!applyPatch) return this.readTools(tripId);
    return { ...this.readTools(tripId), ...buildWriteTools(applyPatch) };
  }

  private chatSystem(trip: TripSnapshot): string {
    return `${chatSystemPrompt()}\n\nCurrent trip snapshot:\n${tripContext(trip)}`;
  }

  private actorNameResolver(trip: TripSnapshot) {
    return (userId: string | null): string => {
      if (!userId) return "system";
      const member = trip.members.find((m) => m.userId === userId);
      return member?.name ?? "member";
    };
  }

  private async resolveModelMessages(
    request: AgentChatRequest,
    tools: ToolSet,
  ): Promise<ModelMessage[]> {
    const clientMessages = request.clientMessages;
    if (clientMessages?.length && clientHasToolApprovalResponse(clientMessages)) {
      // Approval continuation must use the live UI message tree so AI SDK can
      // map approval-responded parts → tool-approval-response and run execute.
      return convertToModelMessages(clientMessages as unknown as UIMessage[], {
        tools,
      });
    }

    return toModelMessages(
      request.history,
      this.actorNameResolver(request.trip),
      this.fileStorage,
      request.trip.id,
    );
  }

  async streamChat(request: AgentChatRequest): Promise<Response> {
    const tools = this.chatTools(request.trip.id, request.applyPatch);
    const messages = await this.resolveModelMessages(request, tools);

    // When the last message is an assistant with tool parts, the UI stream
    // must continue that same message — pass originalMessages for approval
    // continuation (AI SDK official pattern).
    const originalMessages = (request.clientMessages ?? []).map((m) => ({
      id: m.id ?? generateId(),
      role: m.role as UIMessage["role"],
      parts: m.parts as UIMessage["parts"],
    })) as UIMessage[];

    const result = streamText({
      model: this.model,
      system: this.chatSystem(request.trip),
      messages,
      tools,
      toolApproval: buildWriteToolApproval(request.canEdit),
      experimental_toolApprovalSecret: this.config.apiKey,
      // Private trip uploads: resolve via FileStorage, never HTTP-fetch localhost.
      experimental_download: createTripMediaDownload(
        this.fileStorage,
        request.trip.id,
      ),
      stopWhen: stepCountIs(this.config.maxToolSteps),
    });

    return result.toUIMessageStreamResponse({
      originalMessages,
      generateMessageId: generateId,
      onFinish: async ({ responseMessage }) => {
        await request.onFinish(
          responseMessage.parts as AgentMessagePart[],
          responseMessage.id,
        );
      },
    });
  }

  async generateReply(
    request: Pick<AgentChatRequest, "trip" | "history">,
  ): Promise<AgentMessagePart[]> {
    // Ambient replies stay read-only: no write tools, no approval loop.
    const result = await generateText({
      model: this.model,
      system: this.chatSystem(request.trip),
      messages: await toModelMessages(
        request.history,
        this.actorNameResolver(request.trip),
        this.fileStorage,
        request.trip.id,
      ),
      tools: this.readTools(request.trip.id),
      experimental_download: createTripMediaDownload(
        this.fileStorage,
        request.trip.id,
      ),
      stopWhen: stepCountIs(this.config.maxToolSteps),
    });
    return [{ type: "text", text: result.text }];
  }

  async isAddressed(request: AgentAddressedRequest): Promise<boolean> {
    const recentContext = contextSnippetFromMessages(
      await toModelMessages(
        request.history.slice(-20),
        this.actorNameResolver(request.trip),
        this.fileStorage,
        request.trip.id,
      ),
    );

    const { object } = await generateObject({
      model: this.model,
      schema: addressedSchema,
      system: ADDRESSED_SYSTEM_PROMPT,
      prompt: [
        `Trip snapshot:\n${tripContext(request.trip)}`,
        `Recent session context:\n${recentContext || "(none)"}`,
        `Latest member message:\n${request.messageText}`,
      ].join("\n\n"),
    });

    return object.addressed;
  }

  async evaluateOperation(
    request: AgentEvaluationRequest,
  ): Promise<InterventionDecision> {
    const recentContext = contextSnippetFromMessages(
      await toModelMessages(
        request.history.slice(-20),
        this.actorNameResolver(request.trip),
        this.fileStorage,
        request.trip.id,
      ),
    );

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

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const travelModeSchema = z
  .enum(["driving", "walking", "cycling", "transit"])
  .optional();

/** Exported for focused wiring tests. */
export function buildWeatherReadTools(weatherService: WeatherService): ToolSet {
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
        const weather = await weatherService.getWeather(lat, lng, date, time);
        return weather ?? { unavailable: true };
      },
    }),
  };
}

/** Read-only geo tools. Place inserts still go through insertStop + approval. */
export function buildGeoReadTools(geoService: GeoService): ToolSet {
  return {
    placeSearch: tool({
      description:
        "Search places by free-text query. Optionally bias results near a lat/lng.",
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(20).optional(),
        lang: z.string().optional(),
        near: coordinateSchema.optional(),
      }),
      execute: async (input) => geoService.placeSearch(input),
    }),
    placeNearby: tool({
      description:
        "Find places near a coordinate within a radius in meters. Optional category filters (e.g. cafe, museum).",
      inputSchema: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusMeters: z.number().positive().max(50_000).optional(),
        categories: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(30).optional(),
        lang: z.string().optional(),
      }),
      execute: async (input) => geoService.placeNearby(input),
    }),
    placeDetail: tool({
      description:
        "Get details for a place id returned by placeSearch or placeNearby (OSM type/id or Google place id).",
      inputSchema: z.object({
        placeId: z.string().min(1),
        lang: z.string().optional(),
      }),
      execute: async (input) => {
        const place = await geoService.placeDetail(input);
        return place ?? { unavailable: true };
      },
    }),
    routeCompute: tool({
      description:
        "Compute a route between ordered waypoints. Coordinates are lat/lng. Modes: driving, walking, cycling, transit.",
      inputSchema: z.object({
        waypoints: z.array(coordinateSchema).min(2).max(25),
        mode: travelModeSchema,
        includeGeometry: z.boolean().optional(),
      }),
      execute: async (input) => {
        const route = await geoService.routeCompute(input);
        return route ?? { unavailable: true };
      },
    }),
    routeMatrix: tool({
      description:
        "Compute a travel-time/distance matrix between origins and destinations (lat/lng).",
      inputSchema: z.object({
        origins: z.array(coordinateSchema).min(1).max(10),
        destinations: z.array(coordinateSchema).min(1).max(10),
        mode: travelModeSchema,
      }),
      execute: async (input) => geoService.routeMatrix(input),
    }),
    reviewLookup: tool({
      description:
        "Look up reviews for a place id. Unsupported providers return supported=false with an empty list.",
      inputSchema: z.object({
        placeId: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional(),
        lang: z.string().optional(),
      }),
      execute: async (input) => geoService.reviewLookup(input),
    }),
  };
}

type TripMediaToolResult =
  | { error: string }
  | { mediaType: string; data: string; filename?: string };

/** Read trip-owned uploads into multimodal tool output (AI SDK toModelOutput). */
export function buildTripMediaReadTools(
  fileStorage: FileStorage,
  tripId: string,
): ToolSet {
  const tripNamespace = storageNamespaceOf(tripId);
  return {
    readTripMedia: tool({
      description:
        "Read a trip-owned uploaded image, PDF, or text file so you can see its contents. Pass a URL from a chat attachment or a stop note that points at this trip's /api/uploads/trips/... path. External URLs are rejected.",
      inputSchema: z.object({
        url: z.string().min(1).describe("Public upload URL for this trip"),
      }),
      execute: async ({ url }): Promise<TripMediaToolResult> => {
        const path = storagePathFromPublicUrl(url);
        if (
          !path ||
          !isTripMediaStoragePath(path) ||
          path.split("/")[1] !== tripNamespace
        ) {
          return {
            error:
              "URL is not a managed media file for this trip. Use a /api/uploads/trips/... URL from this trip.",
          };
        }
        const file = await fileStorage.read(path);
        if (!file) {
          return { error: "File not found" };
        }
        return {
          mediaType: file.contentType,
          data: bytesToBase64(file.content),
          filename: path.split("/").pop(),
        };
      },
      toModelOutput: ({ output }: { output: TripMediaToolResult }) => {
        if ("error" in output) {
          return { type: "text" as const, value: output.error };
        }
        return {
          type: "content" as const,
          value: [
            {
              type: "file" as const,
              mediaType: output.mediaType,
              data: { type: "data" as const, data: output.data },
              ...(output.filename ? { filename: output.filename } : {}),
            },
          ],
        };
      },
    }),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
