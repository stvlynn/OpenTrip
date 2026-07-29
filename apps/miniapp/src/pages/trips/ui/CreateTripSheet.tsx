import { useState } from "react";

import { copy } from "@/shared/copy";
import { useSession } from "@/shared/session";
import { Button, DateField, SelectField, Sheet, TextField } from "@/shared/ui";
import type { CreateTripInput } from "@/shared/api/trips";

/**
 * Picker options for trip currency. Duplicated in pages/settings/index.tsx,
 * which is owned outside this area — extract a shared module if a third
 * consumer appears.
 */
export const CURRENCIES = ["CNY", "JPY", "USD", "EUR", "HKD", "TWD", "KRW"] as const;

/** Same fallback as the PWA create-trip wizard when no preference is stored. */
const FALLBACK_CURRENCY = "JPY";

interface CreateTripSheetProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTripInput) => void;
}

/**
 * Create form.
 *
 * The PWA asks the same questions as a step-by-step wizard; on a phone-sized
 * sheet they fit on one screen. Every answer except the destination is optional,
 * and the trip name is derived from the destination exactly as the wizard does.
 */
export function CreateTripSheet({
  open,
  pending,
  onClose,
  onSubmit,
}: CreateTripSheetProps) {
  const session = useSession();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dayCount, setDayCount] = useState("");
  const [partySize, setPartySize] = useState("");
  const [budget, setBudget] = useState("");
  // The sheet only mounts once the session is ready, so the user's stored
  // default currency is available for the initial state (web wizard parity).
  const preferred = session.user?.defaultCurrency?.trim() ?? "";
  const [currency, setCurrency] = useState<string>(
    (CURRENCIES as readonly string[]).includes(preferred)
      ? preferred
      : FALLBACK_CURRENCY,
  );

  function submit(): void {
    const place = destination.trim();
    const amount = Number(budget);
    onSubmit({
      title: place ? `${place}${copy.trips.titleFromDestination}` : defaultTitle(),
      currency,
      ...(place ? { destination: place } : {}),
      ...(startDate ? { startDate } : {}),
      ...(positiveInteger(dayCount) ? { dayCount: Number(dayCount) } : {}),
      ...(positiveInteger(partySize) ? { partySize: Number(partySize) } : {}),
      ...(Number.isFinite(amount) && amount > 0 ? { budgetAmount: amount } : {}),
    });
  }

  return (
    <Sheet
      open={open}
      title={copy.trips.createTitle}
      onClose={onClose}
      clearTabBar
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            {copy.app.cancel}
          </Button>
          <Button block disabled={pending} onClick={submit}>
            {copy.trips.createCta}
          </Button>
        </>
      }
    >
      <TextField
        label={copy.trips.fieldDestination}
        value={destination}
        onChange={setDestination}
        placeholder={copy.trips.fieldDestinationPlaceholder}
        hint={copy.trips.destinationHint}
      />
      <DateField
        label={copy.trips.fieldStartDate}
        value={startDate}
        onChange={setStartDate}
        placeholder={copy.trips.optional}
      />
      <TextField
        label={copy.trips.fieldDayCount}
        value={dayCount}
        onChange={setDayCount}
        type="number"
        placeholder={copy.trips.optional}
      />
      <TextField
        label={copy.trips.fieldPartySize}
        value={partySize}
        onChange={setPartySize}
        type="number"
        placeholder={copy.trips.optional}
      />
      <TextField
        label={copy.trips.fieldBudget}
        value={budget}
        onChange={setBudget}
        type="digit"
        placeholder={copy.trips.optional}
      />
      <SelectField
        label={copy.trips.fieldCurrency}
        value={currency}
        options={CURRENCIES}
        labelFor={(option) => option}
        onChange={setCurrency}
      />
    </Sheet>
  );
}

/** Same shape as the PWA's fallback name for a trip with no destination. */
function defaultTitle(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `new-${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function positiveInteger(value: string): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}
