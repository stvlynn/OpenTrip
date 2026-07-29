import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { readJournalEntries, type LocalJournalEntry } from "@/entities/journal";
import { isLocated } from "@/entities/stop";
import {
  addDaysIso,
  findDay,
  formatIsoDate,
  stopsForDay,
  todayIso,
  type TripSummary,
} from "@/entities/trip";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchTrip, fetchTrips } from "@/shared/api/trips";
import { fetchWeather } from "@/shared/api/weather";
import { copy } from "@/shared/copy";
import {
  formatDateRange,
  formatDateTime,
  formatDayLabel,
} from "@/shared/lib/format";
import {
  openJournalComposer,
  openJournalEntry,
  openTrip,
  openTripsTab,
} from "@/shared/lib/navigation";
import { useSession } from "@/shared/session";
import { Button, EmptyState, Screen, SectionHeader, Tag } from "@/shared/ui";

import "./index.scss";

/** Window in which a finished trip is still worth writing up. */
const REFLECTION_WINDOW_DAYS = 30;

type Focus = "trip" | "prepare" | "reflection" | "home";

const FOCUS_COPY: Record<Focus, { title: string; hint: string; action: string }> = {
  trip: {
    title: copy.today.focusTripTitle,
    hint: copy.today.focusTripHint,
    action: copy.today.focusTripAction,
  },
  prepare: {
    title: copy.today.focusPrepareTitle,
    hint: copy.today.focusPrepareHint,
    action: copy.today.focusPrepareAction,
  },
  reflection: {
    title: copy.today.focusReflectionTitle,
    hint: copy.today.focusReflectionHint,
    action: copy.today.focusReflectionAction,
  },
  home: {
    title: copy.today.focusHomeTitle,
    hint: copy.today.focusHomeHint,
    action: copy.today.focusHomeAction,
  },
};

export default function TodayPage() {
  const session = useSession();
  const today = todayIso();
  const [entries, setEntries] = useState<LocalJournalEntry[]>([]);

  const trips = useQuery({
    queryKey: queryKeys.trips,
    queryFn: fetchTrips,
    enabled: session.status === "ready",
  });

  const rows = trips.data ?? [];
  const currentTrip = rows.find(
    (trip) =>
      trip.startLabel && trip.endLabel &&
      trip.startLabel <= today &&
      trip.endLabel >= today,
  );
  const nextTrip = rows
    .filter((trip) => trip.startLabel && trip.startLabel > today)
    .sort((left, right) => left.startLabel.localeCompare(right.startLabel))[0];
  const recentTrip = rows
    .filter(
      (trip) =>
        trip.endLabel &&
        trip.endLabel < today &&
        trip.endLabel >= addDaysIso(today, -REFLECTION_WINDOW_DAYS),
    )
    .sort((left, right) => right.endLabel.localeCompare(left.endLabel))[0];
  const highlighted = currentTrip ?? nextTrip;
  const focus: Focus = currentTrip
    ? "trip"
    : recentTrip
      ? "reflection"
      : nextTrip
        ? "prepare"
        : "home";

  const reload = useCallback(() => {
    if (!session.user) return;
    setEntries(readJournalEntries(session.user.id));
  }, [session.user]);

  // Travelogues live in device storage, so they are re-read on every show.
  useDidShow(reload);

  // On a cold start useDidShow fires before the session resolves and reload
  // bails out early; re-run when the user arrives, like the trips query's
  // `enabled: session.status === "ready"` gate does for remote data.
  useEffect(() => {
    reload();
  }, [reload]);

  const trip = useQuery({
    queryKey: queryKeys.trip(currentTrip?.id ?? ""),
    queryFn: () => fetchTrip(currentTrip!.id),
    enabled: Boolean(currentTrip),
  });

  const currentDay = trip.data?.days.find((day) => day.date === today);
  const stops = trip.data && currentDay
    ? stopsForDay(trip.data.stops, currentDay.number)
    : [];
  const anchor = stops.find(isLocated);

  const weather = useQuery({
    queryKey: queryKeys.weather(anchor?.lat ?? 0, anchor?.lng ?? 0, today),
    queryFn: () => fetchWeather(anchor!.lat, anchor!.lng, today),
    enabled: Boolean(anchor),
  });

  if (session.status !== "ready") {
    return (
      <Screen
        status={session.status === "error" ? "error" : "loading"}
        errorTitle={copy.app.signInFailed}
        onRetry={session.retry}
      />
    );
  }

  if (trips.isPending) return <Screen status="loading" />;

  function actOnFocus(): void {
    if (focus === "trip" && currentTrip) openTrip(currentTrip.id, currentTrip.title);
    else if (focus === "prepare" && nextTrip) openTrip(nextTrip.id, nextTrip.title);
    else openJournalComposer();
  }

  return (
    <Screen tab>
      <View className="ot-today__masthead">
        <View className="ot-today__heading">
          <Text className="ot-today__date">{formatIsoDate(today)}</Text>
          <Text className="ot-today__title">{copy.today.title}</Text>
          <Text className="ot-today__subtitle">{copy.today.subtitle}</Text>
        </View>
      </View>

      <View
        className="ot-today__card"
        hoverClass="ot-today__card--pressed"
        hoverStartTime={0}
        hoverStayTime={80}
        onClick={openJournalComposer}
      >
        <Text className="ot-today__card-title">
          {copy.today.quickCaptureTitle}
        </Text>
        <Text className="ot-today__card-hint">{copy.today.quickCaptureHint}</Text>
        <Text className="ot-today__card-action">
          {copy.today.quickCaptureAction} →
        </Text>
      </View>

      {highlighted ? (
        <View
          className="ot-today__trip"
          hoverClass="ot-today__card--pressed"
          hoverStartTime={0}
          hoverStayTime={80}
          onClick={() => openTrip(highlighted.id, highlighted.title)}
        >
          <Text className="ot-today__trip-label">{copy.today.currentTrip}</Text>
          <Text className="ot-today__trip-title">{highlighted.title}</Text>
          <Text className="ot-today__trip-meta">
            {tripWindow(highlighted)}
          </Text>
        </View>
      ) : (
        <EmptyState
          title={copy.today.empty}
          hint={copy.today.emptyHint}
          action={
            <Button variant="secondary" onClick={openTripsTab}>
              {copy.today.emptyAction}
            </Button>
          }
        />
      )}

      <View
        className="ot-today__card is-focus"
        hoverClass="ot-today__card--pressed"
        hoverStartTime={0}
        hoverStayTime={80}
        onClick={actOnFocus}
      >
        <Text className="ot-today__card-title">{FOCUS_COPY[focus].title}</Text>
        <Text className="ot-today__card-hint">{FOCUS_COPY[focus].hint}</Text>
        <Text className="ot-today__card-action">
          {FOCUS_COPY[focus].action} →
        </Text>
      </View>

      {anchor ? (
        weather.data ? (
          <View className="ot-today__weather">
            <Text className="ot-today__temp">{Math.round(weather.data.temp)}°</Text>
            <View className="ot-today__weather-detail">
              <Text className="ot-today__weather-main">
                {weather.data.description}
              </Text>
              <Text className="ot-today__weather-meta">
                {copy.today.feelsLike} {Math.round(weather.data.feelsLike)}° ·{" "}
                {copy.today.humidity} {weather.data.humidity}% ·{" "}
                {copy.today.wind} {weather.data.windSpeed} m/s
              </Text>
            </View>
          </View>
        ) : weather.isPending ? (
          // Reserve the loaded card's footprint so the page does not jump.
          <View className="ot-today__weather ot-today__weather--skeleton" />
        ) : (
          <Text className="ot-today__weather-notice">
            {copy.today.weatherUnavailable}
          </Text>
        )
      ) : null}

      {currentTrip && currentDay && stops.length > 0 ? (
        <>
          <SectionHeader
            title={trip.data?.title ?? currentTrip.title}
            meta={formatDayLabel(currentDay.number)}
          />
          <View className="ot-today__stops">
            {stops.map((stop) => (
              <View className="ot-today__stop" key={stop.id}>
                <Text className="ot-today__stop-time">{stop.time || "--:--"}</Text>
                <View className="ot-today__stop-body">
                  <Text className="ot-today__stop-name">{stop.name}</Text>
                  {stop.area ? (
                    <Text className="ot-today__stop-area">{stop.area}</Text>
                  ) : null}
                </View>
                <Tag
                  label={copy.categories[stop.category]}
                  color={
                    trip.data
                      ? findDay(trip.data, currentDay.number)?.color
                      : undefined
                  }
                />
              </View>
            ))}
          </View>
        </>
      ) : null}

      {entries.length > 0 ? (
        <>
          <SectionHeader title={copy.today.recentEntries} />
          <View className="ot-today__entries">
            {entries.slice(0, 2).map((entry) => (
              <View
                className="ot-today__entry"
                key={entry.id}
                hoverClass="ot-today__card--pressed"
                hoverStartTime={0}
                hoverStayTime={80}
                onClick={() => openJournalEntry(entry.id)}
              >
                <Text className="ot-today__entry-title">{entry.title}</Text>
                <Text className="ot-today__entry-date">
                  {formatDateTime(entry.occurredAt)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function tripWindow(trip: TripSummary): string {
  const dates = formatDateRange(trip.startLabel, trip.endLabel);
  return [dates, `${trip.stopCount}${copy.trips.stopCount}`]
    .filter(Boolean)
    .join(" · ");
}
