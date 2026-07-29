import { Text, View } from "@tarojs/components";
import Taro, { useRouter, useShareAppMessage } from "@tarojs/taro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TripSummary } from "@/entities/trip";
import { upsertTripSummary } from "@/entities/trip";
import { queryKeys } from "@/shared/api/query-keys";
import {
  acceptTripInvite,
  previewTripInvite,
  type InvitePreview,
} from "@/shared/api/trips";
import { copy } from "@/shared/copy";
import { toastError } from "@/shared/lib/feedback";
import { formatDateTime } from "@/shared/lib/format";
import { openTrip, openTripsTab, readQueryValue } from "@/shared/lib/navigation";
import { useSession } from "@/shared/session";
import { Button, Screen } from "@/shared/ui";

import "./index.scss";

const BLOCKED_STATUS: Record<
  Exclude<InvitePreview["status"], "usable">,
  string
> = {
  expired: copy.invite.expired,
  revoked: copy.invite.revoked,
  email_restricted: copy.invite.emailRestricted,
};

export default function InvitePage() {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const token = readQueryValue(router.params.token);

  const preview = useQuery({
    queryKey: queryKeys.invitePreview(token),
    queryFn: () => previewTripInvite(token),
    enabled: session.status === "ready" && Boolean(token),
  });

  const accept = useMutation({
    mutationFn: () => acceptTripInvite(token),
    onSuccess: ({ trip }) => {
      // The accept response echoes the joined trip; seed both read models from
      // it instead of refetching, which can read stale through Hyperdrive.
      queryClient.setQueryData(queryKeys.trip(trip.id), trip);
      queryClient.setQueryData<TripSummary[]>(queryKeys.trips, (previous) =>
        upsertTripSummary(previous, trip),
      );
      void Taro.redirectTo({
        url: `/pages/trip/index?id=${encodeURIComponent(trip.id)}&title=${encodeURIComponent(trip.title)}`,
      });
    },
    onError: (error) => toastError(error, copy.app.loadFailed),
  });

  useShareAppMessage(() => ({
    title: preview.data?.tripTitle ?? copy.app.name,
    path: `/pages/invite/index?token=${encodeURIComponent(token)}`,
  }));

  if (!token) return <Screen status="error" errorTitle={copy.invite.missingToken} />;

  if (session.status !== "ready") {
    return (
      <Screen
        status={session.status === "error" ? "error" : "loading"}
        errorTitle={copy.app.signInFailed}
        onRetry={session.retry}
      />
    );
  }

  if (preview.isPending) return <Screen status="loading" />;
  if (preview.isError || !preview.data) {
    return (
      <Screen
        status="error"
        errorTitle={copy.app.loadFailed}
        onRetry={() => void preview.refetch()}
      />
    );
  }

  const invite = preview.data;
  const blocked = invite.status === "usable" ? null : BLOCKED_STATUS[invite.status];

  return (
    <Screen>
      <View className="ot-invite">
        <Text className="ot-invite__eyebrow">{copy.invite.title}</Text>
        <Text className="ot-invite__title">{invite.tripTitle}</Text>
        <Text className="ot-invite__meta">
          {copy.invite.invitedBy} {invite.inviterName} · {invite.memberCount}
          {copy.invite.memberCount}
        </Text>

        {blocked ? (
          <View className="ot-invite__action">
            <Text className="ot-invite__blocked">{blocked}</Text>
            <Button variant="secondary" block onClick={openTripsTab}>
              {copy.invite.blockedAction}
            </Button>
          </View>
        ) : invite.alreadyMember ? (
          <View className="ot-invite__action">
            <Text className="ot-invite__meta">{copy.invite.alreadyMember}</Text>
            <Button
              block
              onClick={() => openTrip(invite.tripId, invite.tripTitle)}
            >
              {copy.invite.openTrip}
            </Button>
          </View>
        ) : (
          <View className="ot-invite__action">
            <Text className="ot-invite__meta">
              {invite.role === "viewer"
                ? copy.invite.roleViewer
                : copy.invite.roleEditor}
              {invite.expiresAt
                ? `${copy.invite.expiresPrefix}${formatDateTime(invite.expiresAt)}`
                : ""}
            </Text>
            <Button block disabled={accept.isPending} onClick={() => accept.mutate()}>
              {accept.isPending ? copy.invite.joining : copy.invite.join}
            </Button>
          </View>
        )}
      </View>
    </Screen>
  );
}
