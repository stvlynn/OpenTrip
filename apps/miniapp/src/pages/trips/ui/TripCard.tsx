import { Image, Text, View } from "@tarojs/components";

import type { TripSummary } from "@/entities/trip";
import { copy } from "@/shared/copy";
import { formatDateRange } from "@/shared/lib/format";
import { AvatarStack, Tag, type TagTone } from "@/shared/ui";

import "./TripCard.scss";

const STATUS_LABEL: Record<TripSummary["status"], string> = {
  active: copy.trips.statusActive,
  planning: copy.trips.statusPlanning,
  settled: copy.trips.statusSettled,
};

const STATUS_TONE: Record<TripSummary["status"], TagTone> = {
  active: "brand",
  planning: "warning",
  settled: "success",
};

const STATUS_ACTION: Record<TripSummary["status"], string> = {
  active: copy.trips.openActive,
  planning: copy.trips.openPlanning,
  settled: copy.trips.openSettled,
};

/**
 * Route dots for an idle trip use the `--ink-400` token (#97a0b6). The dot
 * position and color are per-trip dynamic, so they go through an inline style,
 * which cannot read WXSS custom properties — keep the hex in sync with the
 * token in app.scss.
 */
const ROUTE_DOT_IDLE = "#97a0b6";

/** Stable pseudo-random float in [0, 1) derived from a string seed. */
function seededFloat(seed: string, index: number): number {
  let hash = 0;
  const source = seed + String(index);
  for (let position = 0; position < source.length; position += 1) {
    hash = (hash * 31 + source.charCodeAt(position)) | 0;
  }
  return Math.abs(Math.sin(hash)) % 1 || 0;
}

/**
 * Decorative route dots for a trip without a cover photo, using the same seeded
 * layout as the PWA card so a given trip looks the same on both clients. The
 * PWA joins them with a dashed path, which the Mini Program cannot draw without
 * a canvas per card.
 */
function routeDots(trip: TripSummary): { left: number; top: number }[] {
  const count = Math.max(2, Math.min(6, trip.stopCount || 2));
  const dots: { left: number; top: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const progress = index / Math.max(1, count - 1);
    const x = 40 + progress * 240 + (seededFloat(trip.id, index * 2) - 0.5) * 24;
    const y = 42 + seededFloat(trip.id, index * 2 + 1) * 62;
    dots.push({ left: (x / 320) * 100, top: (y / 148) * 100 });
  }
  return dots;
}

interface TripCardProps {
  trip: TripSummary;
  onOpen: (trip: TripSummary) => void;
}

export function TripCard({ trip, onOpen }: TripCardProps) {
  const dates = formatDateRange(trip.startLabel, trip.endLabel);
  // The PWA card carries dates and stop count on one meta line, so the footer
  // is left to the travellers and the open action.
  const meta = [dates, `${trip.stopCount}${copy.trips.stopCount}`]
    .filter(Boolean)
    .join(" · ");
  const routeColor = trip.status === "active" ? trip.coverColor : ROUTE_DOT_IDLE;
  return (
    <View
      className="ot-trip-card"
      hoverClass="ot-trip-card--pressed"
      hoverStayTime={80}
      onClick={() => onOpen(trip)}
    >
      <View className="ot-trip-card__cover">
        {trip.coverUrl ? (
          <Image
            className="ot-trip-card__image"
            src={trip.coverUrl}
            mode="aspectFill"
            lazyLoad
          />
        ) : (
          routeDots(trip).map((dot, index) => (
            <View
              className="ot-trip-card__dot"
              key={index}
              style={{
                left: `${dot.left}%`,
                top: `${dot.top}%`,
                background: routeColor,
              }}
            />
          ))
        )}
        <View className="ot-trip-card__status">
          <Tag label={STATUS_LABEL[trip.status]} tone={STATUS_TONE[trip.status]} />
        </View>
      </View>
      <View className="ot-trip-card__body">
        <Text className="ot-trip-card__title">{trip.title}</Text>
        {meta ? <Text className="ot-trip-card__meta">{meta}</Text> : null}
        <View className="ot-trip-card__footer">
          <AvatarStack people={trip.members} />
          <Text className="ot-trip-card__action">
            {STATUS_ACTION[trip.status]} →
          </Text>
        </View>
      </View>
    </View>
  );
}
