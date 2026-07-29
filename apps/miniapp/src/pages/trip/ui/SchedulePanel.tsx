import { Text, View } from "@tarojs/components";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import type { Stop } from "@/entities/stop";
import {
  dayDateLabel,
  memberName,
  stopNumbers,
  stopsForDay,
  type Trip,
} from "@/entities/trip";
import {
  addComment,
  addTripDay,
  deleteTripDay,
  insertStop,
  moveStop,
  toggleVote,
  updateStop,
} from "@/shared/api/trips";
import { copy } from "@/shared/copy";
import { chooseFromList, confirm, toastError } from "@/shared/lib/feedback";
import { formatDayLabel, formatMoney } from "@/shared/lib/format";
import { Button, EmptyState, Sheet, Tag, TextField } from "@/shared/ui";

import { StopSheet, type StopFormValue } from "./StopSheet";
import "./SchedulePanel.scss";

/** Comment authors are trip members, except assistant replies in the thread. */
function commentAuthor(trip: Trip, author: string): string {
  return author === "agent" ? copy.agent.title : memberName(trip, author);
}

interface SchedulePanelProps {
  trip: Trip;
  onEcho: (trip: Trip) => void;
}

export function SchedulePanel({ trip, onEcho }: SchedulePanelProps) {
  const [composerDay, setComposerDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [commenting, setCommenting] = useState<Stop | null>(null);
  const [comment, setComment] = useState("");
  const [moving, setMoving] = useState<Stop | null>(null);

  const canEdit = trip.permissions.canEdit;
  const numbers = stopNumbers(trip.stops);

  const mutate = useMutation({
    mutationFn: (run: () => Promise<Trip>) => run(),
    onSuccess: onEcho,
    onError: (error) => toastError(error, copy.schedule.saveFailed),
  });

  function submitStop(value: StopFormValue): void {
    if (editing) {
      const stop = editing;
      setEditing(null);
      mutate.mutate(() =>
        updateStop(trip.id, stop.id, {
          name: value.name,
          time: value.time,
          duration: value.duration,
          area: value.area,
          category: value.category,
          cost: value.cost,
          note: value.note,
        }),
      );
      return;
    }
    const day = composerDay;
    if (day === null) return;
    setComposerDay(null);
    mutate.mutate(() =>
      insertStop(trip.id, {
        day,
        index: stopsForDay(trip.stops, day).length,
        name: value.name,
        time: value.time,
        duration: value.duration,
        area: value.area,
        category: value.category,
        cost: value.cost,
        note: value.note,
        ...(value.lat !== undefined ? { lat: value.lat } : {}),
        ...(value.lng !== undefined ? { lng: value.lng } : {}),
      }),
    );
  }

  function move(stop: Stop, offset: number): void {
    const siblings = stopsForDay(trip.stops, stop.day);
    const current = siblings.findIndex((candidate) => candidate.id === stop.id);
    const target = current + offset;
    if (current < 0 || target < 0 || target >= siblings.length) return;
    mutate.mutate(() => moveStop(trip.id, stop.id, { day: stop.day, index: target }));
  }

  /** Moves a stop to the end of another day, picked from the day sheet. */
  function moveToDay(stop: Stop, dayNumber: number): void {
    setMoving(null);
    mutate.mutate(() =>
      moveStop(trip.id, stop.id, {
        day: dayNumber,
        index: stopsForDay(trip.stops, dayNumber).length,
      }),
    );
  }

  /**
   * Editing actions live behind one overflow sheet: five inline buttons wrap on
   * a phone, where the PWA has room for a row plus a menu.
   */
  async function openStopActions(stop: Stop): Promise<void> {
    const siblings = stopsForDay(trip.stops, stop.day);
    const position = siblings.findIndex((candidate) => candidate.id === stop.id);
    const actions: { label: string; run: () => void }[] = [
      { label: copy.app.edit, run: () => setEditing(stop) },
    ];
    if (position > 0) {
      actions.push({ label: copy.schedule.moveUp, run: () => move(stop, -1) });
    }
    if (position >= 0 && position < siblings.length - 1) {
      actions.push({ label: copy.schedule.moveDown, run: () => move(stop, 1) });
    }
    if (trip.days.length > 1) {
      actions.push({
        label: copy.schedule.moveToDay,
        run: () => setMoving(stop),
      });
    }
    const picked = await chooseFromList(actions.map((action) => action.label));
    if (picked === null) return;
    actions[picked]?.run();
  }

  async function removeDay(dayNumber: number): Promise<void> {
    if (!(await confirm(copy.schedule.deleteDayConfirm))) return;
    mutate.mutate(() => deleteTripDay(trip.id, dayNumber));
  }

  function submitComment(): void {
    const stop = commenting;
    const text = comment.trim();
    if (!stop || !text) return;
    setCommenting(null);
    setComment("");
    mutate.mutate(() => addComment(trip.id, stop.id, text));
  }

  return (
    <View className="ot-schedule">
      {trip.days.map((day) => {
        const stops = stopsForDay(trip.stops, day.number);
        return (
          <View className="ot-schedule__day" key={day.number}>
            <View className="ot-schedule__day-header">
              <View className="ot-schedule__day-heading">
                <View
                  className="ot-schedule__day-dot"
                  style={{ background: day.color }}
                />
                <Text className="ot-schedule__day-title">
                  {formatDayLabel(day.number)}
                </Text>
                <Text className="ot-schedule__day-date">
                  {dayDateLabel(trip, day)}
                </Text>
              </View>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeDay(day.number)}
                >
                  {copy.app.delete}
                </Button>
              ) : null}
            </View>

            {stops.length === 0 ? (
              <Text className="ot-schedule__empty">{copy.schedule.emptyDay}</Text>
            ) : (
              stops.map((stop) => (
                <View className="ot-schedule__stop" key={stop.id}>
                  <View className="ot-schedule__stop-index">
                    <Text className="ot-schedule__stop-number">
                      {numbers.get(stop.id)}
                    </Text>
                    <Text className="ot-schedule__stop-time">
                      {stop.time || "--:--"}
                    </Text>
                  </View>
                  <View className="ot-schedule__stop-body">
                    <Text className="ot-schedule__stop-name">{stop.name}</Text>
                    <View className="ot-schedule__stop-meta">
                      <Tag
                        label={copy.categories[stop.category]}
                        color={day.color}
                      />
                      {stop.area ? (
                        <Text className="ot-schedule__stop-area">{stop.area}</Text>
                      ) : null}
                      <Text className="ot-schedule__stop-area">
                        {stop.cost > 0
                          ? `${formatMoney(stop.cost, stop.costCurrency || trip.currency)} ${copy.schedule.perPerson}`
                          : copy.schedule.free}
                      </Text>
                    </View>
                    {stop.note ? (
                      <Text className="ot-schedule__stop-note">{stop.note}</Text>
                    ) : null}
                    {canEdit ? (
                      <View className="ot-schedule__stop-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => mutate.mutate(() => toggleVote(trip.id, stop.id))}
                        >
                          {`${copy.schedule.vote} ${stop.votes.length}`}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCommenting(stop);
                            setComment("");
                          }}
                        >
                          {`${copy.schedule.comments} ${stop.comments.length}`}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void openStopActions(stop)}
                        >
                          {copy.schedule.more}
                        </Button>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {canEdit ? (
              <View className="ot-schedule__day-footer">
                <Button
                  variant="secondary"
                  size="sm"
                  block
                  onClick={() => setComposerDay(day.number)}
                >
                  {copy.schedule.addStop}
                </Button>
              </View>
            ) : null}
          </View>
        );
      })}

      {trip.days.length === 0 ? (
        <EmptyState title={copy.schedule.emptyDay} />
      ) : null}

      {canEdit ? (
        <View className="ot-schedule__add-day">
          <Button
            variant="secondary"
            block
            onClick={() => mutate.mutate(() => addTripDay(trip.id))}
          >
            {copy.schedule.addDay}
          </Button>
        </View>
      ) : null}

      <StopSheet
        open={composerDay !== null || editing !== null}
        stop={editing ?? undefined}
        pending={mutate.isPending}
        onClose={() => {
          setComposerDay(null);
          setEditing(null);
        }}
        onSubmit={submitStop}
      />

      <Sheet
        open={commenting !== null}
        title={commenting?.name ?? copy.schedule.comments}
        onClose={() => setCommenting(null)}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setCommenting(null)}>
              {copy.app.cancel}
            </Button>
            <Button block disabled={!comment.trim()} onClick={submitComment}>
              {copy.app.add}
            </Button>
          </>
        }
      >
        {commenting && commenting.comments.length === 0 ? (
          <Text className="ot-schedule__comment-empty">
            {copy.schedule.commentsEmpty}
          </Text>
        ) : null}
        {(commenting?.comments ?? []).map((entry, index) => (
          <View className="ot-schedule__comment" key={`${entry.author}-${index}`}>
            <Text className="ot-schedule__comment-meta">
              {commentAuthor(trip, entry.author)} · {entry.timeLabel}
            </Text>
            <Text className="ot-schedule__comment-text">{entry.text}</Text>
          </View>
        ))}
        <TextField
          value={comment}
          onChange={setComment}
          placeholder={copy.schedule.commentPlaceholder}
        />
      </Sheet>

      {/* Day picker replaces the native action sheet, which caps at 6 items
          and silently drops days on longer trips. */}
      <Sheet
        open={moving !== null}
        title={copy.schedule.moveToDayTitle}
        onClose={() => setMoving(null)}
      >
        {trip.days.map((day) => (
          <View
            className={
              day.number === moving?.day
                ? "ot-schedule__move-day is-current"
                : "ot-schedule__move-day"
            }
            key={day.number}
            onClick={() => {
              const stop = moving;
              if (!stop || day.number === stop.day) return;
              moveToDay(stop, day.number);
            }}
          >
            <Text className="ot-schedule__move-day-title">
              {formatDayLabel(day.number)}
            </Text>
            <Text className="ot-schedule__move-day-date">
              {dayDateLabel(trip, day)}
            </Text>
          </View>
        ))}
      </Sheet>
    </View>
  );
}
