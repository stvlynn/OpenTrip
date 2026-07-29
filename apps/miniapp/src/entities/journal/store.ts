import Taro from "@tarojs/taro";

import type { LocalJournalEntry } from "./model";

/**
 * Travelogues are device-local, matching the PWA preview: they never leave the
 * client, so the Mini Program keeps them in its own storage sandbox rather than
 * sending them to the API.
 */

const STORAGE_PREFIX = "opentrip.journal-preview.v1";

interface JournalDocument {
  version: 1;
  entries: LocalJournalEntry[];
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readJournalEntries(userId: string): LocalJournalEntry[] {
  const raw = Taro.getStorageSync<string>(storageKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<JournalDocument>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .filter(isJournalEntry)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  } catch {
    return [];
  }
}

export function writeJournalEntries(
  userId: string,
  entries: readonly LocalJournalEntry[],
): void {
  const document: JournalDocument = { version: 1, entries: [...entries] };
  Taro.setStorageSync(storageKey(userId), JSON.stringify(document));
}

export function saveJournalEntry(
  userId: string,
  input: { id?: string; title: string; body: string; tripId: string | null },
): LocalJournalEntry {
  const now = new Date().toISOString();
  const entries = readJournalEntries(userId);
  const existing = input.id
    ? entries.find((entry) => entry.id === input.id)
    : undefined;
  const entry: LocalJournalEntry = {
    id: existing?.id ?? createId(),
    title: input.title,
    body: input.body,
    occurredAt: existing?.occurredAt ?? now,
    updatedAt: now,
    publishedAt: existing?.publishedAt ?? null,
    tripId: input.tripId,
    visibility: existing?.visibility ?? "private",
    status: existing?.status ?? "draft",
  };
  const next = existing
    ? entries.map((candidate) => (candidate.id === entry.id ? entry : candidate))
    : [entry, ...entries];
  writeJournalEntries(userId, next);
  return entry;
}

export function deleteJournalEntry(userId: string, entryId: string): void {
  writeJournalEntries(
    userId,
    readJournalEntries(userId).filter((entry) => entry.id !== entryId),
  );
}

export function findJournalEntry(
  userId: string,
  entryId: string,
): LocalJournalEntry | null {
  return readJournalEntries(userId).find((entry) => entry.id === entryId) ?? null;
}

function isJournalEntry(value: unknown): value is LocalJournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LocalJournalEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.body === "string" &&
    typeof entry.occurredAt === "string"
  );
}

function createId(): string {
  return `jr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
