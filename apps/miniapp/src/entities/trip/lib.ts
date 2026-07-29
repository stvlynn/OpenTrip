import type { Stop } from "@/entities/stop";

import type { Trip, TripDay, TripSummary, TripSummaryMember } from "./model";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_COVER_COLOR = "#3f6fc9";
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** Sequential per-day stop numbers, matching the planner's map/schedule badges. */
export function stopNumbers(stops: readonly Stop[]): Map<string, number> {
  const counts = new Map<number, number>();
  const numbers = new Map<string, number>();
  for (const stop of stops) {
    const next = (counts.get(stop.day) ?? 0) + 1;
    counts.set(stop.day, next);
    numbers.set(stop.id, next);
  }
  return numbers;
}

/** Stops for a given day (0 = all days), preserving order. */
export function stopsForDay(stops: readonly Stop[], day: number): Stop[] {
  if (day === 0) return [...stops];
  return stops.filter((stop) => stop.day === day);
}

export function findDay(trip: Trip, day: number): TripDay | undefined {
  return trip.days.find((candidate) => candidate.number === day);
}

export function dayColor(trip: Trip, day: number): string {
  return findDay(trip, day)?.color ?? DEFAULT_COVER_COLOR;
}

export function dayIsoDate(trip: Trip, dayNumber: number): string | null {
  const day = findDay(trip, dayNumber);
  if (day && ISO_DATE.test(day.date)) return day.date;
  if (ISO_DATE.test(trip.startDate)) return addDaysIso(trip.startDate, dayNumber - 1);
  return null;
}

/** Calendar label for an itinerary day. Structured ISO dates win over legacy
 * text labels, which only exist for imported trips. */
export function dayDateLabel(trip: Trip, day: TripDay): string {
  if (ISO_DATE.test(day.date)) return formatIsoDate(day.date);
  if (day.dateLabel.trim()) return day.dateLabel;
  const derived = dayIsoDate(trip, day.number);
  return derived ? formatIsoDate(derived) : "";
}

export function formatIsoDate(date: string): string {
  if (!ISO_DATE.test(date)) return date;
  const [year, month, dayOfMonth] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, dayOfMonth));
  return `${month}月${dayOfMonth}日 ${WEEKDAYS[parsed.getUTCDay()]}`;
}

export function addDaysIso(date: string, days: number): string {
  const [year, month, dayOfMonth] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, dayOfMonth + days));
  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    String(parsed.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Today in the device time zone as an ISO `YYYY-MM-DD` string. */
export function todayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Build a list-card summary from a full trip DTO (e.g. the POST /api/trips echo). */
export function toTripSummary(
  trip: Trip,
  createdAt: string = new Date().toISOString(),
): TripSummary {
  const firstDay = trip.days[0];
  const lastDay = trip.days[trip.days.length - 1];
  const members: TripSummaryMember[] = trip.members.map((member) => ({
    id: member.id,
    name: member.name,
    initials: member.initials,
    avatarBg: member.avatarBg,
    avatarFg: member.avatarFg,
    image: member.image,
    isCurrentUser: member.isCurrentUser,
  }));
  const located = trip.stops.find(
    (stop) => !stop.transit && (stop.lat !== 0 || stop.lng !== 0),
  );
  return {
    id: trip.id,
    title: trip.title,
    startLabel: firstDay?.date || trip.startDate || "",
    endLabel: lastDay?.date || trip.startDate || "",
    status: trip.status,
    currency: trip.currency,
    coverColor: firstDay?.color ?? DEFAULT_COVER_COLOR,
    coverUrl: trip.coverUrl,
    memberCount: trip.members.length,
    stopCount: trip.stops.length,
    createdAt,
    creatorName: members[0]?.name ?? "",
    members,
    location: located ? { lat: located.lat, lng: located.lng } : null,
  };
}

/** Immutably insert or replace a mutation echo in the trips read model. */
export function upsertTripSummary(
  previous: readonly TripSummary[] | undefined,
  trip: Trip,
): TripSummary[] | undefined {
  if (!previous) return previous;
  const existing = previous.find((row) => row.id === trip.id);
  const summary = toTripSummary(trip, existing?.createdAt);
  if (!existing) return [summary, ...previous];
  return previous.map((row) => (row.id === trip.id ? summary : row));
}

export function memberName(trip: Trip, memberId: string): string {
  return trip.members.find((member) => member.id === memberId)?.name ?? memberId;
}
