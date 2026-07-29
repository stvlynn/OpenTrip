import Taro from "@tarojs/taro";

import { config } from "@/shared/config";
import { currentToken } from "@/shared/session/session";

export type TripChangeScope =
  | "trip"
  | "days"
  | "stops"
  | "expenses"
  | "members"
  | "reservations"
  | "comments";

export interface TripChangeMessage {
  eventId: string;
  tripId: string;
  revision: number;
  actorId: string;
  occurredAt: string;
  scopes: TripChangeScope[];
}

export interface RealtimePresenceMember {
  userId: string;
  name: string;
  image: string | null;
  role: "owner" | "editor" | "viewer";
  connectionCount: number;
}

type ServerMessage =
  | {
      type: "hello";
      connectionId: string;
      sequence: number;
      presence: RealtimePresenceMember[];
    }
  | { type: "change"; sequence: number; change: TripChangeMessage }
  | { type: "presence"; members: RealtimePresenceMember[] }
  | { type: "resync_required"; sequence: number };

export interface TripRealtimeOptions {
  tripId: string;
  onPresence: (members: RealtimePresenceMember[]) => void;
  onChange: (change: TripChangeMessage) => void;
  onResync: () => void;
}

const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * One resilient WeChat socket per open planner. Sequence handling mirrors the
 * PWA client: a gap or an explicit `resync_required` triggers a full refetch
 * instead of patching partial state.
 */
export class TripRealtimeClient {
  #socket: Taro.SocketTask | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #attempt = 0;
  #stopped = true;
  #connectedOnce = false;
  #lastSequence = 0;

  constructor(private readonly options: TripRealtimeOptions) {}

  start(): void {
    if (!this.#stopped) return;
    this.#stopped = false;
    void this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    const socket = this.#socket;
    this.#socket = null;
    if (socket) closeQuietly(socket, 1000, "Planner closed");
  }

  async #connect(): Promise<void> {
    if (this.#stopped || this.#socket) return;
    const token = currentToken();
    if (!token) return;
    try {
      const socket = await Taro.connectSocket({
        url: realtimeUrl(this.options.tripId),
        header: { Authorization: `Bearer ${token}` },
      });
      if (this.#stopped) {
        closeQuietly(socket, 1000, "Planner closed");
        return;
      }
      this.#socket = socket;
      socket.onMessage(({ data }) => this.#receive(socket, data));
      socket.onClose(() => {
        if (this.#socket === socket) this.#socket = null;
        if (!this.#stopped) this.#scheduleReconnect();
      });
      // A socket that errors before it opens cannot be closed, so the retry is
      // scheduled here rather than waiting for a close event.
      socket.onError(() => {
        if (this.#socket !== socket) return;
        this.#socket = null;
        closeQuietly(socket, 1011, "Connection error");
        this.#scheduleReconnect();
      });
    } catch (error) {
      console.warn("OpenTrip realtime connect failed", error);
      this.#scheduleReconnect();
    }
  }

  #receive(socket: Taro.SocketTask, data: unknown): void {
    const message = parseServerMessage(data);
    if (!message) return;
    switch (message.type) {
      case "hello":
        this.options.onPresence(message.presence);
        if (!this.#connectedOnce) {
          this.#connectedOnce = true;
          this.#lastSequence = message.sequence;
          this.options.onResync();
        } else {
          socket.send({
            data: JSON.stringify({
              type: "resume",
              afterSequence: this.#lastSequence,
            }),
          });
        }
        return;
      case "presence":
        this.options.onPresence(message.members);
        return;
      case "resync_required":
        this.#lastSequence = message.sequence;
        this.options.onResync();
        return;
      case "change":
        if (message.sequence <= this.#lastSequence) return;
        if (message.sequence !== this.#lastSequence + 1) {
          this.#lastSequence = message.sequence;
          this.options.onResync();
          return;
        }
        this.#lastSequence = message.sequence;
        this.options.onChange(message.change);
    }
  }

  #scheduleReconnect(): void {
    if (this.#stopped || this.#timer !== null) return;
    const delay = Math.min(1_000 * 2 ** this.#attempt, MAX_RECONNECT_DELAY_MS);
    this.#attempt += 1;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#connect();
    }, delay);
  }
}

/**
 * Closing a socket that never opened rejects with `closeSocket:fail task not
 * found`, which WeChat reports as an unhandled SystemError; the outcome is the
 * same either way, so the failure is swallowed.
 */
function closeQuietly(socket: Taro.SocketTask, code: number, reason: string): void {
  try {
    const result = socket.close({ code, reason }) as unknown;
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // The task is already gone.
  }
}

function realtimeUrl(tripId: string): string {
  const origin = config.apiBaseUrl.replace(/^http/, "ws");
  return `${origin}/api/trips/${encodeURIComponent(tripId)}/realtime`;
}

export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string" || data.length > 64 * 1024) return null;
  try {
    const value = JSON.parse(data) as ServerMessage;
    if (
      value.type === "hello" &&
      typeof value.connectionId === "string" &&
      validSequence(value.sequence) &&
      Array.isArray(value.presence)
    ) {
      return value;
    }
    if (value.type === "presence" && Array.isArray(value.members)) return value;
    if (value.type === "resync_required" && validSequence(value.sequence)) {
      return value;
    }
    if (
      value.type === "change" &&
      validSequence(value.sequence) &&
      validTripChange(value.change)
    ) {
      return value;
    }
  } catch {
    // Ignore malformed network data.
  }
  return null;
}

function validSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validTripChange(value: unknown): value is TripChangeMessage {
  if (!value || typeof value !== "object") return false;
  const change = value as Partial<TripChangeMessage>;
  return (
    typeof change.eventId === "string" &&
    typeof change.tripId === "string" &&
    validSequence(change.revision) &&
    typeof change.actorId === "string" &&
    typeof change.occurredAt === "string" &&
    Array.isArray(change.scopes)
  );
}
