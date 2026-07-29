import { Text, View } from "@tarojs/components";
import Taro, { usePullDownRefresh, useRouter, useShareAppMessage } from "@tarojs/taro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { fetchAgentStatus } from "@/shared/api/agent";
import { queryKeys } from "@/shared/api/query-keys";
import { copy } from "@/shared/copy";
import { formatDayLabel } from "@/shared/lib/format";
import { readQueryValue } from "@/shared/lib/navigation";
import { useSession } from "@/shared/session";
import {
  Screen,
  SegmentedTabs,
  Tag,
  type SegmentedTab,
} from "@/shared/ui";

import { useTripData, useTripEcho } from "./model/useTripData";
import { AgentSheet } from "./ui/AgentSheet";
import { BudgetPanel } from "./ui/BudgetPanel";
import { MapPanel } from "./ui/MapPanel";
import { MembersBar } from "./ui/MembersBar";
import { PlannerNavBar } from "./ui/PlannerNavBar";
import { ReservationsPanel } from "./ui/ReservationsPanel";
import { SchedulePanel } from "./ui/SchedulePanel";
import "./index.scss";

type PlannerTab = "map" | "schedule" | "reservations" | "budget";

const TABS: readonly SegmentedTab<PlannerTab>[] = [
  { value: "map", label: copy.trip.tabMap },
  { value: "schedule", label: copy.trip.tabSchedule },
  { value: "reservations", label: copy.trip.tabReservations },
  { value: "budget", label: copy.trip.tabBudget },
];

export default function TripPage() {
  const router = useRouter();
  const session = useSession();
  const echo = useTripEcho();
  const tripId = readQueryValue(router.params.id);
  const initialTitle = readQueryValue(router.params.title);

  // The PWA planner opens on the map, so the Mini Program does the same.
  const [tab, setTab] = useState<PlannerTab>("map");
  const [mapDay, setMapDay] = useState(0);
  const [agentOpen, setAgentOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  const { trip, reservations } = useTripData(tripId, session.status === "ready");

  const agentStatus = useQuery({
    queryKey: queryKeys.agentStatus,
    queryFn: fetchAgentStatus,
    enabled: session.status === "ready",
    staleTime: 5 * 60_000,
  });

  // A trip created with wizard intake opens the agent sheet once, like the PWA
  // planner opening its agent panel; AgentSheet acknowledges the one-shot seed
  // after the member's first message.
  useEffect(() => {
    if (!trip.data?.agentSeedPending) return;
    if (agentStatus.data?.enabled !== true) return;
    setAgentOpen(true);
  }, [trip.data?.agentSeedPending, agentStatus.data?.enabled]);

  usePullDownRefresh(async () => {
    await Promise.all([trip.refetch(), reservations.refetch()]);
    void Taro.stopPullDownRefresh();
  });

  useShareAppMessage(() =>
    inviteToken
      ? {
          title: trip.data?.title ?? copy.app.name,
          path: `/pages/invite/index?token=${encodeURIComponent(inviteToken)}`,
        }
      : {
          title: trip.data?.title ?? copy.app.name,
          path: `/pages/trip/index?id=${encodeURIComponent(tripId)}`,
        },
  );

  if (session.status !== "ready") {
    return (
      <Screen
        status={session.status === "error" ? "error" : "loading"}
        errorTitle={copy.app.signInFailed}
        onRetry={session.retry}
      />
    );
  }

  if (trip.isPending) return <Screen status="loading" />;
  if (trip.isError || !trip.data) {
    return (
      <Screen
        status="error"
        errorTitle={copy.trip.notFound}
        onRetry={() => void trip.refetch()}
      />
    );
  }

  const data = trip.data;
  const dayFilters = [0, ...data.days.map((day) => day.number)];

  return (
    <Screen>
      <PlannerNavBar
        title={data.title || initialTitle}
        onOpenAgent={
          agentStatus.data?.enabled === true
            ? () => setAgentOpen(true)
            : undefined
        }
      />

      <MembersBar trip={data} onInviteCreated={setInviteToken} />

      {data.permissions.canEdit ? null : (
        <View className="ot-trip__notice">
          <Tag label={copy.trip.readOnly} tone="warning" />
        </View>
      )}

      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "map" ? (
        <>
          <View className="ot-trip__days">
            {dayFilters.map((dayNumber) => (
              <View
                className={
                  dayNumber === mapDay
                    ? "ot-trip__day-chip is-active"
                    : "ot-trip__day-chip"
                }
                key={dayNumber}
                onClick={() => setMapDay(dayNumber)}
              >
                <Text className="ot-trip__day-chip-text">
                  {dayNumber === 0
                    ? copy.map.allDays
                    : formatDayLabel(dayNumber)}
                </Text>
              </View>
            ))}
          </View>
          <MapPanel trip={data} day={mapDay} />
        </>
      ) : null}

      {tab === "schedule" ? <SchedulePanel trip={data} onEcho={echo} /> : null}

      {tab === "reservations" ? (
        <ReservationsPanel trip={data} reservations={reservations.data ?? []} />
      ) : null}

      {tab === "budget" ? <BudgetPanel trip={data} onEcho={echo} /> : null}

      <AgentSheet
        open={agentOpen}
        trip={data}
        onClose={() => setAgentOpen(false)}
        onEcho={echo}
      />
    </Screen>
  );
}
