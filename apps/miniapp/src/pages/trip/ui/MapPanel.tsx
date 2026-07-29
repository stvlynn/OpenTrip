import { Map, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMemo, useState } from "react";

import { isLocated, type Stop } from "@/entities/stop";
import { dayColor, stopNumbers, stopsForDay, type Trip } from "@/entities/trip";
import { copy } from "@/shared/copy";
import { toast } from "@/shared/lib/feedback";
import { Button, EmptyState } from "@/shared/ui";

import "./MapPanel.scss";

interface MapPanelProps {
  trip: Trip;
  /** 0 shows every day. */
  day: number;
}

/**
 * WeChat's native map replaces the PWA's MapLibre canvas.
 *
 * Stops are drawn as day-colored circles with route polylines: WeChat markers
 * require a bundled icon asset, and circles keep the same information without
 * one. Selection is driven from the stop list, and WeChat's own map app handles
 * navigation.
 *
 * The map does not show the device location: like the PWA planner it only frames
 * the trip, so it must not provoke a location permission prompt on open.
 */
export function MapPanel({ trip, day }: MapPanelProps) {
  const [selectedId, setSelectedId] = useState<string>("");

  const visible = useMemo(
    () => stopsForDay(trip.stops, day).filter(isLocated),
    [trip.stops, day],
  );
  const numbers = useMemo(() => stopNumbers(trip.stops), [trip.stops]);

  const frame = useMemo(() => mapFrame(visible), [visible]);

  const circles = useMemo(
    () =>
      visible.map((stop) => ({
        latitude: stop.lat,
        longitude: stop.lng,
        color: dayColor(trip, stop.day),
        fillColor: `${toHex8(dayColor(trip, stop.day))}`,
        radius: stop.id === selectedId ? frame.radius * 1.6 : frame.radius,
        strokeWidth: 2,
      })),
    [visible, trip, selectedId, frame.radius],
  );

  const polyline = useMemo(() => {
    const days = day === 0 ? trip.days.map((entry) => entry.number) : [day];
    return days
      .map((dayNumber) => ({
        points: stopsForDay(trip.stops, dayNumber)
          .filter(isLocated)
          .map((stop) => ({ latitude: stop.lat, longitude: stop.lng })),
        color: `${toHex8(dayColor(trip, dayNumber))}`,
        width: 4,
        arrowLine: true,
      }))
      .filter((line) => line.points.length > 1);
  }, [day, trip]);

  const selected = visible.find((stop) => stop.id === selectedId);

  if (visible.length === 0) {
    return (
      <EmptyState
        title={copy.map.noLocatedStops}
        hint={copy.map.noLocatedStopsHint}
      />
    );
  }

  return (
    <View className="ot-map">
      <Map
        className="ot-map__canvas"
        latitude={selected?.lat ?? frame.lat}
        longitude={selected?.lng ?? frame.lng}
        scale={selected ? 16 : frame.scale}
        circles={circles}
        polyline={polyline}
        onError={(event) => console.warn("OpenTrip map error", event)}
      />

      <View className="ot-map__list">
        {visible.map((stop) => (
          <View
            className={
              stop.id === selectedId
                ? "ot-map__row is-selected"
                : "ot-map__row"
            }
            hoverClass="ot-row--pressed"
            hoverStartTime={0}
            hoverStayTime={80}
            key={stop.id}
            onClick={() => setSelectedId(stop.id)}
          >
            <View
              className="ot-map__row-number"
              style={{ background: dayColor(trip, stop.day) }}
            >
              <Text className="ot-map__row-number-text">
                {numbers.get(stop.id)}
              </Text>
            </View>
            <View className="ot-map__row-body">
              <Text className="ot-map__row-name">{stop.name}</Text>
              {stop.area ? (
                <Text className="ot-map__row-area">{stop.area}</Text>
              ) : null}
            </View>
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                // Keep the row's select handler from firing behind the button.
                event.stopPropagation();
                openInWechatMap(stop);
              }}
            >
              {copy.map.locate}
            </Button>
          </View>
        ))}
      </View>
    </View>
  );
}

function openInWechatMap(stop: Stop): void {
  void Taro.openLocation({
    latitude: stop.lat,
    longitude: stop.lng,
    name: stop.name,
    address: stop.area,
  }).catch(() => toast(copy.map.unavailable));
}

/** Map viewport width in CSS pixels, used to turn a bounding box into a zoom. */
const MAP_VIEWPORT_PX = 360;
/** Equator metres per pixel at zoom 0, the constant behind Web Mercator zooms. */
const METRES_PER_PIXEL_AT_ZOOM_0 = 156_543;

/**
 * Centre, zoom and stop radius that frame every located stop.
 *
 * WeChat only applies `include-points` reliably through the imperative map
 * context, so the viewport is derived here instead: a bounding box gives the
 * centre, and the span sets both the zoom and a stop radius that stays legible
 * at that zoom.
 */
function mapFrame(stops: readonly Stop[]): {
  lat: number;
  lng: number;
  scale: number;
  radius: number;
} {
  const lats = stops.map((stop) => stop.lat);
  const lngs = stops.map((stop) => stop.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;

  const latitudeSpanMetres = (maxLat - minLat) * 111_320;
  const longitudeSpanMetres =
    (maxLng - minLng) * 111_320 * Math.cos((lat * Math.PI) / 180);
  // A single stop still needs a neighbourhood-sized frame rather than zoom 20.
  const spanMetres = Math.max(latitudeSpanMetres, longitudeSpanMetres, 800) * 1.4;

  const metresPerPixel = spanMetres / MAP_VIEWPORT_PX;
  const zoom =
    Math.log2(
      (METRES_PER_PIXEL_AT_ZOOM_0 * Math.cos((lat * Math.PI) / 180)) /
        metresPerPixel,
    );

  return {
    lat,
    lng,
    scale: Math.min(18, Math.max(4, Math.round(zoom))),
    // A fraction of the frame keeps a stop about the size of a PWA marker at
    // any zoom, from one neighbourhood to a multi-city trip.
    radius: Math.min(20_000, Math.max(40, Math.round(spanMetres / 45))),
  };
}

/** WeChat expects `#RRGGBBAA`; the day palette is stored as `#RRGGBB`. */
function toHex8(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}cc` : "#3f6fc9cc";
}
