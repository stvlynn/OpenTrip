import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { fingerprintMessageText } from "@opentrip/observability-contract";

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_SERVICE = "opentrip-api";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 2_000;

export interface LogQueryOptions {
  requestId?: string;
  invocationId?: string;
  turnId?: string;
  messageId?: string;
  toolCallId?: string;
  tripId?: string;
  event?: string;
  contains?: string;
  messageStdin: boolean;
  since: string;
  from?: string;
  to?: string;
  limit: number;
  format: "pretty" | "ndjson" | "json";
  service: string;
  live: boolean;
  expand: boolean;
}

interface TelemetryEvent {
  $metadata?: { id?: string; requestId?: string; level?: string };
  $workers?: { requestId?: string };
  source?: string | Record<string, unknown>;
  timestamp: number;
  dataset?: string;
  [key: string]: unknown;
}

interface TelemetryResponse {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: {
    events?: { count?: number; events?: TelemetryEvent[] };
    statistics?: unknown;
  };
}

interface Filter {
  key: string;
  operation: "eq";
  type: "string";
  value: string;
}

export function parseArgs(argv: string[]): LogQueryOptions {
  const options: LogQueryOptions = {
    messageStdin: false,
    since: "1h",
    limit: DEFAULT_LIMIT,
    format: "pretty",
    service: DEFAULT_SERVICE,
    live: false,
    expand: true,
  };
  const valueFlags: Record<string, keyof LogQueryOptions> = {
    "--request-id": "requestId",
    "--invocation-id": "invocationId",
    "--turn-id": "turnId",
    "--message-id": "messageId",
    "--tool-call-id": "toolCallId",
    "--trip-id": "tripId",
    "--event": "event",
    "--contains": "contains",
    "--since": "since",
    "--from": "from",
    "--to": "to",
    "--format": "format",
    "--service": "service",
    "--limit": "limit",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (arg === "--live") {
      options.live = true;
      continue;
    }
    if (arg === "--message-stdin") {
      options.messageStdin = true;
      continue;
    }
    if (arg === "--no-expand") {
      options.expand = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const key = valueFlags[arg];
    if (!key) throw new Error(`Unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${arg} requires a value`);
    index += 1;
    if (key === "limit") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}`);
      }
      options.limit = parsed;
    } else if (key === "format") {
      if (!(["pretty", "ndjson", "json"] as const).includes(value as never)) {
        throw new Error("--format must be pretty, ndjson, or json");
      }
      options.format = value as LogQueryOptions["format"];
    } else {
      (options as unknown as Record<string, string>)[key] = value;
    }
  }
  return options;
}

export function timeframeOf(
  options: Pick<LogQueryOptions, "since" | "from" | "to">,
  now = Date.now(),
): { from: number; to: number } {
  const to = options.to ? parseTimestamp(options.to, "--to") : now;
  const from = options.from
    ? parseTimestamp(options.from, "--from")
    : to - parseDuration(options.since);
  if (from >= to) throw new Error("Query start time must be before end time");
  return { from, to };
}

export function buildQueryBody(input: {
  timeframe: { from: number; to: number };
  filters: Filter[];
  contains?: string;
  limit: number;
  offset?: string;
}) {
  return {
    queryId: `opentrip-cli-${crypto.randomUUID()}`,
    timeframe: input.timeframe,
    dry: true,
    limit: input.limit,
    ...(input.offset
      ? { offset: input.offset, offsetDirection: "next" as const }
      : {}),
    parameters: {
      datasets: ["cloudflare-workers"],
      filterCombination: "and" as const,
      filters: input.filters,
      ...(input.contains
        ? { needle: { value: input.contains, isRegex: false, matchCase: false } }
        : {}),
    },
    view: "events" as const,
  };
}

export function filtersOf(
  options: LogQueryOptions,
  messageFingerprint?: string,
): Filter[] {
  const filters: Filter[] = [filter("$metadata.service", options.service)];
  const fields: Array<[string, string | undefined]> = [
    ["requestId", options.requestId],
    ["$metadata.requestId", options.invocationId],
    ["turnId", options.turnId],
    ["messageId", options.messageId],
    ["toolCallId", options.toolCallId],
    ["tripId", options.tripId],
    ["event", options.event],
    ["messageFingerprint", messageFingerprint],
  ];
  for (const [key, value] of fields) {
    if (value) filters.push(filter(key, value));
  }
  return filters;
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.live) {
    runLive(options);
    return;
  }
  const token = process.env.CLOUDFLARE_OBSERVABILITY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "CLOUDFLARE_OBSERVABILITY_TOKEN is required for historical queries",
    );
  }
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || discoverAccountId();
  const messageFingerprint = options.messageStdin
    ? await fingerprintMessageText(await readStdin())
    : undefined;
  const timeframe = timeframeOf(options);
  const initial = await queryAll({
    accountId,
    token,
    timeframe,
    filters: filtersOf(options, messageFingerprint),
    contains: options.contains,
    limit: options.limit,
  });
  let events = initial.events;
  if (options.expand && events.length > 0) {
    const invocationIds = new Set(
      events
        .map(invocationIdOf)
        .filter((value): value is string => Boolean(value)),
    );
    for (const invocationId of invocationIds) {
      const expanded = await queryAll({
        accountId,
        token,
        timeframe,
        filters: [
          filter("$metadata.service", options.service),
          filter("$metadata.requestId", invocationId),
        ],
        limit: Math.min(MAX_LIMIT, options.limit),
      });
      events.push(...expanded.events);
    }
  }
  events = deduplicateAndSort(events).slice(0, options.limit);
  writeEvents(events, options.format);
  process.stderr.write(
    `matched=${initial.count} returned=${events.length} expanded=${options.expand}\n`,
  );
  if (initial.count > initial.events.length) {
    process.stderr.write(
      `warning: query matched ${initial.count} events; use a narrower timeframe or --limit up to ${MAX_LIMIT}\n`,
    );
  }
}

async function queryAll(input: {
  accountId: string;
  token: string;
  timeframe: { from: number; to: number };
  filters: Filter[];
  contains?: string;
  limit: number;
}): Promise<{ events: TelemetryEvent[]; count: number }> {
  const events: TelemetryEvent[] = [];
  let count = 0;
  let offset: string | undefined;
  while (events.length < input.limit) {
    const pageLimit = Math.min(200, input.limit - events.length);
    const response = await fetch(
      `${API_BASE}/accounts/${encodeURIComponent(input.accountId)}/workers/observability/telemetry/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          buildQueryBody({
            timeframe: input.timeframe,
            filters: input.filters,
            contains: input.contains,
            limit: pageLimit,
            offset,
          }),
        ),
      },
    );
    const payload = (await response.json().catch(() => null)) as TelemetryResponse | null;
    if (!response.ok || !payload?.result) {
      const detail = payload?.errors?.map((error) => error.message).filter(Boolean).join("; ");
      throw new Error(
        `Cloudflare telemetry query failed (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }
    const page = payload.result.events?.events ?? [];
    count = Math.max(count, payload.result.events?.count ?? page.length);
    events.push(...page);
    if (page.length < pageLimit) break;
    offset = page.at(-1)?.$metadata?.id;
    if (!offset) break;
  }
  return { events, count };
}

function filter(key: string, value: string): Filter {
  return { key, operation: "eq", type: "string", value };
}

function invocationIdOf(event: TelemetryEvent): string | undefined {
  return event.$metadata?.requestId ?? event.$workers?.requestId;
}

function deduplicateAndSort(events: TelemetryEvent[]): TelemetryEvent[] {
  const unique = new Map<string, TelemetryEvent>();
  for (const event of events) {
    const key =
      event.$metadata?.id ??
      `${event.timestamp}:${invocationIdOf(event) ?? ""}:${JSON.stringify(event.source)}`;
    unique.set(key, event);
  }
  return [...unique.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function writeEvents(
  events: TelemetryEvent[],
  format: LogQueryOptions["format"],
): void {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(events, null, 2)}\n`);
    return;
  }
  for (const event of events) {
    if (format === "ndjson") {
      process.stdout.write(`${JSON.stringify(event)}\n`);
      continue;
    }
    const source = event.source ?? {};
    const parsedSource =
      typeof source === "string" ? parseJsonObject(source) ?? source : source;
    const level =
      event.$metadata?.level ??
      (typeof parsedSource === "object" && parsedSource
        ? String(parsedSource.level ?? "info")
        : "info");
    process.stdout.write(
      `${new Date(event.timestamp).toISOString()} ${level.padEnd(5)} ${invocationIdOf(event) ?? "-"} ${typeof parsedSource === "string" ? parsedSource : JSON.stringify(parsedSource)}\n`,
    );
  }
}

function runLive(options: LogQueryOptions): void {
  const args = [
    "exec",
    "wrangler",
    "tail",
    options.service,
    "--config",
    "deploy/cloudflare/wrangler.api.jsonc",
    "--format",
    "json",
  ];
  if (options.contains) args.push("--search", options.contains);
  const child = spawn("pnpm", args, { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
}

function discoverAccountId(): string {
  const result = spawnSync("pnpm", ["exec", "wrangler", "whoami", "--json"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID or authenticate Wrangler");
  }
  const payload = JSON.parse(result.stdout) as unknown;
  const ids = collectAccountIds(payload);
  if (ids.size !== 1) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is required when Wrangler exposes zero or multiple accounts",
    );
  }
  return [...ids][0]!;
}

function collectAccountIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    for (const item of value) collectAccountIds(item, ids);
    return ids;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id === "string" &&
    (typeof record.name === "string" || "account" in record)
  ) {
    ids.add(record.id);
  }
  for (const child of Object.values(record)) collectAccountIds(child, ids);
  return ids;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const value = Buffer.concat(chunks).toString("utf8");
  if (!value.trim()) throw new Error("--message-stdin received empty input");
  return value;
}

function parseDuration(value: string): number {
  const match = value.match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error("--since must use <number>m, <number>h, or <number>d");
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * (unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000);
}

function parseTimestamp(value: string, flag: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${flag} must be an ISO-8601 timestamp`);
  return timestamp;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function printHelp(): void {
  process.stdout.write(`OpenTrip Cloudflare logs\n\nHistorical:\n  pnpm logs:cf -- --request-id <id> --since 1h\n  pbpaste | pnpm logs:cf -- --message-stdin --since 2h\n\nLive:\n  pnpm logs:cf -- --live --contains <id>\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
