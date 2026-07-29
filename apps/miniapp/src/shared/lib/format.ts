const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  TWD: "NT$",
  KRW: "₩",
  SGD: "S$",
  AUD: "A$",
};

/**
 * Money for display: symbol plus a grouped integer, matching the PWA's
 * `formatMoney` output (`¥12,345`). Fractions (per-person splits, FX
 * conversions) are rounded to the integer, as on the PWA. Grouping is manual:
 * `toLocaleString` does not group reliably across WeChat JSCore versions.
 */
export function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const rounded = Math.round(amount);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = rounded < 0 ? `-${digits}` : digits;
  return symbol ? `${symbol}${body}` : `${body} ${currency}`;
}

/** `2026-07-28T09:30:00Z` → `7月28日 17:30` in the device time zone. */
export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hour}:${minute}`;
}

export function formatDateRange(startIso: string, endIso: string): string {
  if (!startIso) return "";
  if (!endIso || endIso === startIso) return formatShortDate(startIso);
  return `${formatShortDate(startIso)} – ${formatShortDate(endIso)}`;
}

function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${Number(match[2])}月${Number(match[3])}日`;
}

/** Itinerary day label, spaced the same way as the PWA planner ("第 1 天"). */
export function formatDayLabel(dayNumber: number): string {
  return `第 ${dayNumber} 天`;
}

/** Minor units used by the reservation API (JPY and KRW have no subunit). */
export function minorUnitFactor(currency: string): number {
  return currency === "JPY" || currency === "KRW" ? 1 : 100;
}
