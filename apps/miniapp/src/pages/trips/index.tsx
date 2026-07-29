import { Text, View } from "@tarojs/components";
import Taro, { usePullDownRefresh, useShareAppMessage } from "@tarojs/taro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { TripSummary } from "@/entities/trip";
import { upsertTripSummary } from "@/entities/trip";
import { queryKeys } from "@/shared/api/query-keys";
import { createTrip, fetchTrips, type CreateTripInput } from "@/shared/api/trips";
import { copy } from "@/shared/copy";
import { toastError } from "@/shared/lib/feedback";
import { openSettings, openTrip } from "@/shared/lib/navigation";
import { useSession } from "@/shared/session";
import {
  Button,
  EmptyState,
  Screen,
  SegmentedTabs,
  type SegmentedTab,
} from "@/shared/ui";

import { CreateTripSheet } from "./ui/CreateTripSheet";
import { TripCard } from "./ui/TripCard";
import "./index.scss";

type TripFilter = "all" | TripSummary["status"];

const FILTERS: readonly SegmentedTab<TripFilter>[] = [
  { value: "all", label: copy.trips.filterAll },
  { value: "active", label: copy.trips.filterActive },
  { value: "planning", label: copy.trips.filterPlanning },
  { value: "settled", label: copy.trips.filterSettled },
];

export default function TripsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState<TripFilter>("all");

  const trips = useQuery({
    queryKey: queryKeys.trips,
    queryFn: fetchTrips,
    enabled: session.status === "ready",
  });

  const create = useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (trip) => {
      // The create response is the full trip; seed both read models from it
      // instead of refetching, which can read stale through Hyperdrive.
      queryClient.setQueryData(queryKeys.trip(trip.id), trip);
      queryClient.setQueryData<TripSummary[]>(queryKeys.trips, (previous) =>
        upsertTripSummary(previous, trip),
      );
      setComposerOpen(false);
      openTrip(trip.id, trip.title);
    },
    onError: (error) => toastError(error, copy.trips.createFailed),
  });

  usePullDownRefresh(async () => {
    await trips.refetch();
    void Taro.stopPullDownRefresh();
  });

  useShareAppMessage(() => ({
    title: copy.app.name,
    path: "/pages/trips/index",
  }));

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
  if (trips.isError) {
    return (
      <Screen
        status="error"
        errorTitle={copy.app.loadFailed}
        onRetry={() => void trips.refetch()}
      />
    );
  }

  const rows = trips.data ?? [];
  const visible =
    filter === "all" ? rows : rows.filter((trip) => trip.status === filter);

  return (
    <Screen tab>
      <View className="ot-trips__masthead">
        <View className="ot-trips__heading">
          <Text className="ot-trips__title">{copy.trips.title}</Text>
          <Text className="ot-trips__subtitle">{copy.trips.subtitle}</Text>
        </View>
        <View className="ot-trips__masthead-actions">
          <Button variant="ghost" size="sm" onClick={openSettings}>
            {copy.settings.title}
          </Button>
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            {copy.trips.createCta}
          </Button>
        </View>
      </View>

      {rows.length === 0 ? (
        <EmptyState
          title={copy.trips.empty}
          hint={copy.trips.emptyHint}
          action={
            <Button onClick={() => setComposerOpen(true)}>
              {copy.trips.createCta}
            </Button>
          }
        />
      ) : (
        <>
          <SegmentedTabs tabs={FILTERS} value={filter} onChange={setFilter} />
          {visible.length === 0 ? (
            <EmptyState
              title={copy.trips.filterEmpty}
              hint={copy.trips.filterEmptyHint}
              action={
                <Button variant="secondary" onClick={() => setFilter("all")}>
                  {copy.trips.filterShowAll}
                </Button>
              }
            />
          ) : (
            <View className="ot-trips__list">
              {visible.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpen={(selected) => openTrip(selected.id, selected.title)}
                />
              ))}
            </View>
          )}
        </>
      )}

      <CreateTripSheet
        open={composerOpen}
        pending={create.isPending}
        onClose={() => setComposerOpen(false)}
        onSubmit={(input) => create.mutate(input)}
      />
    </Screen>
  );
}
