import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import type { Trip, TripSummary } from "@/entities/trip";
import { upsertTripSummary } from "@/entities/trip";
import { queryKeys } from "@/shared/api/query-keys";
import { TripRealtimeClient } from "@/shared/api/realtime";
import { fetchReservations } from "@/shared/api/reservations";
import { fetchTrip } from "@/shared/api/trips";

/** Trip aggregate plus its reservations, kept in sync over the trip socket. */
export function useTripData(tripId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const trip = useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: () => fetchTrip(tripId),
    enabled: enabled && Boolean(tripId),
  });

  const reservations = useQuery({
    queryKey: queryKeys.reservations(tripId),
    queryFn: () => fetchReservations(tripId),
    enabled: enabled && Boolean(tripId),
  });

  useEffect(() => {
    if (!enabled || !tripId) return;
    const client = new TripRealtimeClient({
      tripId,
      onPresence: () => undefined, // Deliberate: presence has no Mini Program UI (documented adaptation).
      onChange: (change) => {
        if (change.scopes.includes("reservations")) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.reservations(tripId),
          });
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
      },
      onResync: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.reservations(tripId),
        });
      },
    });
    client.start();
    return () => client.stop();
  }, [enabled, tripId, queryClient]);

  return { trip, reservations };
}

/**
 * Apply a mutation's trip echo to every reader. Trip mutations answer with the
 * whole aggregate, which avoids a follow-up read that Hyperdrive may serve
 * stale for up to a minute.
 */
export function useTripEcho() {
  const queryClient = useQueryClient();
  return useCallback(
    (trip: Trip) => {
      queryClient.setQueryData(queryKeys.trip(trip.id), trip);
      queryClient.setQueryData<TripSummary[]>(queryKeys.trips, (previous) =>
        upsertTripSummary(previous, trip),
      );
    },
    [queryClient],
  );
}
