import type { AgentMessagePart } from "../../domain/agent";
import {
  ALLOWED_TRIP_MEDIA_MIME_TYPES,
  isTripOwnedMediaUrl,
} from "../storage";

/** AI SDK FileUIPart shape persisted in agent_messages.parts. */
export interface AgentFilePart {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
  [key: string]: unknown;
}

export function isAgentFilePart(part: unknown): part is AgentFilePart {
  if (typeof part !== "object" || part === null) return false;
  const p = part as Record<string, unknown>;
  return (
    p.type === "file" &&
    typeof p.mediaType === "string" &&
    typeof p.url === "string" &&
    (p.filename === undefined || typeof p.filename === "string")
  );
}

/**
 * Keep only trip-owned, allowlisted file parts. Rejects data URLs and
 * anything outside this trip's managed upload namespace.
 */
export function sanitizeAgentFileParts(
  parts: unknown[],
  tripId: string,
): AgentFilePart[] {
  const out: AgentFilePart[] = [];
  for (const part of parts) {
    if (!isAgentFilePart(part)) continue;
    if (part.url.startsWith("data:")) continue;
    if (!ALLOWED_TRIP_MEDIA_MIME_TYPES.has(part.mediaType)) continue;
    if (!isTripOwnedMediaUrl(part.url, tripId)) continue;
    out.push({
      type: "file",
      mediaType: part.mediaType,
      url: part.url,
      ...(part.filename ? { filename: part.filename } : {}),
    });
  }
  return out;
}

/** Extract sanitized file parts from a client UIMessage parts array. */
export function filePartsFromMessageParts(
  parts: AgentMessagePart[] | undefined,
  tripId: string,
): AgentFilePart[] {
  if (!parts?.length) return [];
  return sanitizeAgentFileParts(parts, tripId);
}
