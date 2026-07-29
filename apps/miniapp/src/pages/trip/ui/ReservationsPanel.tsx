import { Text, View } from "@tarojs/components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  RESERVATION_TYPES,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
  type ReservationType,
} from "@/entities/reservation";
import type { Trip } from "@/entities/trip";
import { queryKeys } from "@/shared/api/query-keys";
import {
  cancelReservation,
  createReservation,
} from "@/shared/api/reservations";
import { copy } from "@/shared/copy";
import { confirm, toastError } from "@/shared/lib/feedback";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import {
  Button,
  DateField,
  EmptyState,
  SelectField,
  Sheet,
  Tag,
  TextAreaField,
  TextField,
  TimeField,
  type TagTone,
} from "@/shared/ui";

import "./ReservationsPanel.scss";

const TYPE_LABEL: Record<ReservationType, string> = {
  flight: copy.reservations.typeFlight,
  accommodation: copy.reservations.typeAccommodation,
  restaurant: copy.reservations.typeRestaurant,
  rail: copy.reservations.typeRail,
  ground_transport: copy.reservations.typeGroundTransport,
  activity: copy.reservations.typeActivity,
  other: copy.reservations.typeOther,
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  tentative: copy.reservations.statusTentative,
  confirmed: copy.reservations.statusConfirmed,
  cancelled: copy.reservations.statusCancelled,
  completed: copy.reservations.statusCompleted,
};

const STATUS_TONE: Record<ReservationStatus, TagTone> = {
  tentative: "warning",
  confirmed: "success",
  cancelled: "danger",
  completed: "neutral",
};

/**
 * Merge a mutation's reservation echo into the cached list, which the API
 * serves ordered by start time. Refetching after a write can read stale
 * through Hyperdrive, so the POST/PATCH response is the source of truth.
 */
function upsertReservation(
  list: Reservation[] | undefined,
  next: Reservation,
): Reservation[] {
  const others = (list ?? []).filter((entry) => entry.id !== next.id);
  return [...others, next].sort((left, right) =>
    left.startAt.localeCompare(right.startAt),
  );
}

/**
 * IANA name of the device zone, the same default the PWA editor uses. WeChat's
 * JSCore can lack `Intl` on older Android; the fallback records the device's
 * fixed UTC offset (e.g. `+08:00`), which still describes the zone `startAt`
 * was built in rather than silently claiming UTC.
 */
function deviceTimeZone(): string {
  try {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (name) return name;
  } catch {
    // `Intl` missing entirely: fall through to the offset form.
  }
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

interface ReservationsPanelProps {
  trip: Trip;
  reservations: Reservation[];
}

export function ReservationsPanel({ trip, reservations }: ReservationsPanelProps) {
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [type, setType] = useState<ReservationType>("flight");
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const canEdit = trip.permissions.canEdit;

  const create = useMutation({
    mutationFn: (draft: ReservationDraft) =>
      createReservation(trip.id, draft, `${trip.id}-${Date.now()}`),
    onSuccess: (created) => {
      queryClient.setQueryData<Reservation[]>(
        queryKeys.reservations(trip.id),
        (previous) => upsertReservation(previous, created),
      );
      setComposerOpen(false);
      resetForm();
    },
    onError: (error) => toastError(error, copy.schedule.saveFailed),
  });

  const cancel = useMutation({
    mutationFn: (reservation: Reservation) => cancelReservation(trip.id, reservation),
    onSuccess: (cancelled) => {
      queryClient.setQueryData<Reservation[]>(
        queryKeys.reservations(trip.id),
        (previous) => upsertReservation(previous, cancelled),
      );
    },
    onError: (error) => toastError(error, copy.schedule.saveFailed),
  });

  function resetForm(): void {
    setType("flight");
    setTitle("");
    setProvider("");
    setConfirmation("");
    setDate("");
    setTime("");
    setLocationName("");
    setAmount("");
    setNotes("");
  }

  function submit(): void {
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    const parsedAmount = Number(amount);
    create.mutate({
      type,
      title: trimmed,
      startAt: new Date(`${date}T${time || "00:00"}:00`).toISOString(),
      timezone: deviceTimeZone(),
      ...(provider.trim() ? { provider: provider.trim() } : {}),
      ...(confirmation.trim() ? { confirmationNumber: confirmation.trim() } : {}),
      ...(locationName.trim() ? { locationName: locationName.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      // Minor units verbatim, like the PWA editor: no major/minor conversion.
      ...(Number.isFinite(parsedAmount) && parsedAmount > 0
        ? {
            amountMinor: Math.round(parsedAmount),
            currency: trip.currency,
          }
        : {}),
    });
  }

  async function requestCancel(reservation: Reservation): Promise<void> {
    if (!(await confirm(copy.reservations.cancelConfirm))) return;
    cancel.mutate(reservation);
  }

  return (
    <View className="ot-reservations">
      {reservations.length === 0 ? (
        <EmptyState
          title={copy.reservations.empty}
          hint={copy.reservations.emptyHint}
          action={
            canEdit ? (
              <Button onClick={() => setComposerOpen(true)}>
                {copy.reservations.addTitle}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <View className="ot-reservations__list">
            {reservations.map((reservation) => (
              <View className="ot-reservations__row" key={reservation.id}>
                <View className="ot-reservations__row-head">
                  <Text className="ot-reservations__row-title">
                    {reservation.title}
                  </Text>
                  <Tag
                    label={STATUS_LABEL[reservation.status]}
                    tone={STATUS_TONE[reservation.status]}
                  />
                </View>
                <Text className="ot-reservations__row-meta">
                  {TYPE_LABEL[reservation.type]} ·{" "}
                  {formatDateTime(reservation.startAt)}
                </Text>
                {reservation.amountMinor != null && reservation.currency ? (
                  <Text className="ot-reservations__row-meta">
                    {formatMoney(reservation.amountMinor, reservation.currency)}
                  </Text>
                ) : null}
                {reservation.provider || reservation.confirmationNumber ? (
                  <Text className="ot-reservations__row-meta">
                    {[reservation.provider, reservation.confirmationNumber]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
                {reservation.locationName ? (
                  <Text className="ot-reservations__row-meta">
                    {reservation.locationName}
                  </Text>
                ) : null}
                {canEdit && reservation.status !== "cancelled" ? (
                  <View className="ot-reservations__row-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void requestCancel(reservation)}
                    >
                      {copy.reservations.cancelReservation}
                    </Button>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          {canEdit ? (
            <Button variant="secondary" block onClick={() => setComposerOpen(true)}>
              {copy.reservations.addTitle}
            </Button>
          ) : null}
        </>
      )}

      <Sheet
        open={composerOpen}
        title={copy.reservations.addTitle}
        onClose={() => setComposerOpen(false)}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setComposerOpen(false)}>
              {copy.app.cancel}
            </Button>
            <Button
              block
              disabled={create.isPending || !title.trim() || !date}
              onClick={submit}
            >
              {copy.app.save}
            </Button>
          </>
        }
      >
        <SelectField
          label={copy.reservations.fieldType}
          value={type}
          options={RESERVATION_TYPES}
          labelFor={(option) => TYPE_LABEL[option]}
          onChange={setType}
        />
        <TextField
          label={copy.reservations.fieldTitle}
          value={title}
          onChange={setTitle}
        />
        <DateField
          label={copy.reservations.fieldStartAt}
          value={date}
          onChange={setDate}
        />
        <TimeField label={copy.schedule.stopTime} value={time} onChange={setTime} />
        <TextField
          label={copy.reservations.fieldProvider}
          value={provider}
          onChange={setProvider}
        />
        <TextField
          label={copy.reservations.fieldConfirmation}
          value={confirmation}
          onChange={setConfirmation}
        />
        <TextField
          label={copy.reservations.fieldLocation}
          value={locationName}
          onChange={setLocationName}
        />
        <TextField
          label={copy.budget.fieldAmount}
          value={amount}
          type="digit"
          onChange={setAmount}
        />
        <TextAreaField
          label={copy.reservations.fieldNotes}
          value={notes}
          onChange={setNotes}
        />
      </Sheet>
    </View>
  );
}
