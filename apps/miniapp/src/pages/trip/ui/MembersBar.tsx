import { View } from "@tarojs/components";
import { useMutation } from "@tanstack/react-query";

import type { Trip } from "@/entities/trip";
import { createTripInvite } from "@/shared/api/trips";
import { copy } from "@/shared/copy";
import { copyToClipboard, toast, toastError } from "@/shared/lib/feedback";
import { AvatarStack, Button } from "@/shared/ui";

import "./MembersBar.scss";

interface MembersBarProps {
  trip: Trip;
  /** Receives the token so the page can offer it as a WeChat share card. */
  onInviteCreated: (token: string) => void;
}

export function MembersBar({ trip, onInviteCreated }: MembersBarProps) {
  const invite = useMutation({
    mutationFn: () =>
      createTripInvite(trip.id, {
        accessScope: "anyone",
        allowedEmails: [],
        role: "editor",
        canInvite: false,
        expiresAt: null,
      }),
    onSuccess: (created) => {
      onInviteCreated(created.token);
      copyToClipboard(created.url);
      toast(copy.trip.inviteCopyHint);
    },
    onError: (error) => toastError(error, copy.app.loadFailed),
  });

  return (
    <View className="ot-members">
      <AvatarStack people={trip.members} max={5} />
      {trip.permissions.canInvite ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={invite.isPending}
          onClick={() => invite.mutate()}
        >
          {copy.trip.invite}
        </Button>
      ) : null}
    </View>
  );
}
