import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";

import { STOP_CATEGORIES, type Stop, type StopCategory } from "@/entities/stop";
import { copy } from "@/shared/copy";
import {
  Button,
  SelectField,
  Sheet,
  TextAreaField,
  TextField,
  TimeField,
} from "@/shared/ui";

export interface StopFormValue {
  name: string;
  time: string;
  duration: string;
  area: string;
  category: StopCategory;
  cost: number;
  note: string;
  lat?: number;
  lng?: number;
}

interface StopSheetProps {
  open: boolean;
  /** Present when editing; absent when composing a new stop. */
  stop?: Stop;
  pending: boolean;
  onClose: () => void;
  onSubmit: (value: StopFormValue) => void;
}

const EMPTY: StopFormValue = {
  name: "",
  time: "",
  duration: "",
  area: "",
  category: "Sight",
  cost: 0,
  note: "",
};

/**
 * Stop composer. Coordinates come from WeChat's own location picker, which
 * replaces the PWA's map point-picking plus reverse geocoding (the geo API is
 * agent-only, with no public REST search).
 */
export function StopSheet({
  open,
  stop,
  pending,
  onClose,
  onSubmit,
}: StopSheetProps) {
  const [value, setValue] = useState<StopFormValue>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setValue(
      stop
        ? {
            name: stop.name,
            time: stop.time,
            duration: stop.duration,
            area: stop.area,
            category: stop.category,
            cost: stop.cost,
            note: stop.note,
          }
        : EMPTY,
    );
  }, [open, stop]);

  async function pickLocation(): Promise<void> {
    try {
      const picked = await Taro.chooseLocation({});
      setValue((current) => ({
        ...current,
        name: current.name || picked.name || picked.address,
        area: current.area || picked.address,
        lat: picked.latitude,
        lng: picked.longitude,
      }));
    } catch {
      // The picker was dismissed; keep the form untouched.
    }
  }

  const located = value.lat !== undefined && value.lng !== undefined;

  return (
    <Sheet
      open={open}
      title={stop ? copy.app.edit : copy.schedule.addStop}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            {copy.app.cancel}
          </Button>
          <Button
            block
            disabled={pending || !value.name.trim()}
            onClick={() => onSubmit({ ...value, name: value.name.trim() })}
          >
            {copy.app.save}
          </Button>
        </>
      }
    >
      <TextField
        label={copy.schedule.stopName}
        value={value.name}
        onChange={(name) => setValue((current) => ({ ...current, name }))}
      />
      {stop ? null : (
        <View className="ot-stop-sheet__locate">
          <Button variant="secondary" size="sm" onClick={() => void pickLocation()}>
            {copy.map.pick}
          </Button>
          {located ? (
            <Text className="ot-stop-sheet__coords">
              {value.lat?.toFixed(4)}, {value.lng?.toFixed(4)}
            </Text>
          ) : null}
        </View>
      )}
      <TimeField
        label={copy.schedule.stopTime}
        value={value.time}
        onChange={(time) => setValue((current) => ({ ...current, time }))}
      />
      <TextField
        label={copy.schedule.stopDuration}
        value={value.duration}
        onChange={(duration) => setValue((current) => ({ ...current, duration }))}
      />
      <TextField
        label={copy.schedule.stopArea}
        value={value.area}
        onChange={(area) => setValue((current) => ({ ...current, area }))}
      />
      <SelectField
        label={copy.schedule.stopCategory}
        value={value.category}
        options={STOP_CATEGORIES}
        labelFor={(option) => copy.categories[option]}
        onChange={(category) => setValue((current) => ({ ...current, category }))}
      />
      <TextField
        label={copy.schedule.stopCost}
        value={value.cost ? String(value.cost) : ""}
        type="digit"
        onChange={(cost) =>
          setValue((current) => ({ ...current, cost: Number(cost) || 0 }))
        }
      />
      <TextAreaField
        label={copy.schedule.stopNote}
        value={value.note}
        onChange={(note) => setValue((current) => ({ ...current, note }))}
      />
    </Sheet>
  );
}
