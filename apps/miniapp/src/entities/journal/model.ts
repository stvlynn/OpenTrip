export type JournalVisibility = "private" | "trip";
export type JournalStatus = "draft" | "published";

export interface LocalJournalEntry {
  id: string;
  title: string;
  body: string;
  occurredAt: string;
  updatedAt: string;
  publishedAt: string | null;
  tripId: string | null;
  visibility: JournalVisibility;
  status: JournalStatus;
}
