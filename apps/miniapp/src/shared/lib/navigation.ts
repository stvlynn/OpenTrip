import Taro from "@tarojs/taro";

/**
 * Native page stack helpers.
 *
 * WeChat caps `navigateTo` at ten pages, so returning to a hub tab uses
 * `switchTab` rather than pushing another copy of it.
 */

export function openTrip(tripId: string, title?: string): void {
  const query = [`id=${encodeURIComponent(tripId)}`];
  if (title) query.push(`title=${encodeURIComponent(title)}`);
  void Taro.navigateTo({ url: `/pages/trip/index?${query.join("&")}` });
}

export function openJournalEntry(entryId: string): void {
  void Taro.navigateTo({
    url: `/pages/journal-entry/index?id=${encodeURIComponent(entryId)}`,
  });
}

export function openSettings(): void {
  void Taro.navigateTo({ url: "/pages/settings/index" });
}

export function openTripsTab(): void {
  void Taro.switchTab({ url: "/pages/trips/index" });
}

let journalComposeRequested = false;

/**
 * `switchTab` cannot carry a query, so the request to open the journal composer
 * is handed over in memory — the PWA passes `?compose=stop` on the same jump.
 */
export function openJournalComposer(): void {
  journalComposeRequested = true;
  void Taro.switchTab({ url: "/pages/journal/index" });
}

/** Reads and clears a pending compose request. */
export function takeJournalComposeRequest(): boolean {
  const requested = journalComposeRequested;
  journalComposeRequested = false;
  return requested;
}

/** Decode a page query value written by `navigateTo` or a share card. */
export function readQueryValue(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
