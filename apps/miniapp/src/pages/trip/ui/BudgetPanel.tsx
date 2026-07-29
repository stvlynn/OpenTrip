import { Text, View } from "@tarojs/components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { Expense } from "@/entities/expense";
import { memberName, type Trip } from "@/entities/trip";
import { fetchFxRates } from "@/shared/api/fx";
import { queryKeys } from "@/shared/api/query-keys";
import { addExpense, updateExpense, type AddExpenseInput } from "@/shared/api/trips";
import { copy } from "@/shared/copy";
import { toastError } from "@/shared/lib/feedback";
import { formatMoney } from "@/shared/lib/format";
import {
  Button,
  EmptyState,
  SectionHeader,
  SelectField,
  Sheet,
  TextField,
} from "@/shared/ui";

import "./BudgetPanel.scss";

interface BudgetPanelProps {
  trip: Trip;
  onEcho: (trip: Trip) => void;
}

export function BudgetPanel({ trip, onEcho }: BudgetPanelProps) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(trip.members[0]?.id ?? "");
  const [participants, setParticipants] = useState<string[]>(
    trip.members.map((member) => member.id),
  );

  const canEdit = trip.permissions.canEdit;

  const foreignCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          trip.expenses
            .map((expense) => expense.currency)
            .filter((currency) => currency && currency !== trip.currency),
        ),
      ),
    [trip.expenses, trip.currency],
  );

  // Settle-up needs a single currency; the FX proxy supplies the conversion
  // used for display when a trip mixes currencies.
  const fx = useQuery({
    queryKey: queryKeys.fxRates(trip.currency, foreignCurrencies),
    queryFn: () => fetchFxRates(trip.currency, foreignCurrencies),
    enabled: foreignCurrencies.length > 0,
  });

  const save = useMutation({
    mutationFn: (input: AddExpenseInput) =>
      editing
        ? updateExpense(trip.id, editing.id, input)
        : addExpense(trip.id, input),
    onSuccess: (updated) => {
      onEcho(updated);
      closeComposer();
    },
    onError: (error) => toastError(error, copy.schedule.saveFailed),
  });

  function openComposer(expense?: Expense): void {
    setEditing(expense ?? null);
    setDescription(expense?.description ?? "");
    setAmount(expense ? String(expense.amount) : "");
    setPayer(expense?.payer ?? trip.members[0]?.id ?? "");
    setParticipants(
      expense?.participants.length
        ? [...expense.participants]
        : trip.members.map((member) => member.id),
    );
    setComposerOpen(true);
  }

  function closeComposer(): void {
    setComposerOpen(false);
    setEditing(null);
  }

  function submit(): void {
    const parsed = Number(amount);
    if (!description.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    if (!payer || participants.length === 0) return;
    save.mutate({
      description: description.trim(),
      // Whole units, matching the PWA budget board.
      amount: Math.round(parsed),
      currency: trip.currency,
      payer,
      participants,
    });
  }

  function toggleParticipant(memberId: string): void {
    setParticipants((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  function inTripCurrency(expense: Expense): string {
    const currency = expense.currency || trip.currency;
    if (currency === trip.currency) return formatMoney(expense.amount, currency);
    const rate = fx.data?.rates[currency];
    if (!rate) return formatMoney(expense.amount, currency);
    return `${formatMoney(expense.amount, currency)} ≈ ${formatMoney(
      expense.amount / rate,
      trip.currency,
    )}`;
  }

  return (
    <View className="ot-budget">
      <View className="ot-budget__totals">
        <View className="ot-budget__total">
          <Text className="ot-budget__total-label">{copy.budget.total}</Text>
          <Text className="ot-budget__total-value">
            {formatMoney(trip.budget.total, trip.currency)}
          </Text>
        </View>
        <View className="ot-budget__total">
          <Text className="ot-budget__total-label">{copy.budget.perPerson}</Text>
          <Text className="ot-budget__total-value">
            {formatMoney(trip.budget.perPerson, trip.currency)}
          </Text>
        </View>
      </View>

      {trip.budget.balances.length > 0 ? (
        <>
          <SectionHeader title={copy.budget.balances} />
          <View className="ot-budget__balances">
            {trip.budget.balances.map((balance) => (
              <View className="ot-budget__balance" key={balance.memberId}>
                <View className="ot-budget__balance-body">
                  <Text className="ot-budget__balance-name">
                    {memberName(trip, balance.memberId)}
                  </Text>
                  <Text className="ot-budget__balance-meta">
                    {copy.budget.paid} {formatMoney(balance.paid, trip.currency)} ·{" "}
                    {copy.budget.share} {formatMoney(balance.share, trip.currency)}
                  </Text>
                </View>
                <Text
                  className={
                    balance.net >= 0
                      ? "ot-budget__balance-net is-positive"
                      : "ot-budget__balance-net is-negative"
                  }
                >
                  {`${balance.net >= 0 ? "+" : "−"}${formatMoney(
                    Math.abs(balance.net),
                    trip.currency,
                  )}`}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {trip.expenses.length > 0 && trip.budget.settlements.length === 0 ? (
        <>
          <SectionHeader title={copy.budget.settlements} />
          <Text className="ot-budget__settled">{copy.budget.everyonePaid}</Text>
        </>
      ) : null}

      {trip.budget.settlements.length > 0 ? (
        <>
          <SectionHeader title={copy.budget.settlements} />
          <View className="ot-budget__settlements">
            {trip.budget.settlements.map((settlement, index) => (
              <View
                className="ot-budget__settlement"
                key={`${settlement.from}-${settlement.to}-${index}`}
              >
                <Text className="ot-budget__settlement-text">
                  {memberName(trip, settlement.from)} {copy.budget.settleHint}{" "}
                  {memberName(trip, settlement.to)}
                </Text>
                <Text className="ot-budget__settlement-amount">
                  {formatMoney(settlement.amount, trip.currency)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader
        title={copy.budget.expenses}
        meta={`${trip.expenses.length}`}
        action={
          canEdit ? (
            <Button variant="secondary" size="sm" onClick={() => openComposer()}>
              {copy.app.add}
            </Button>
          ) : undefined
        }
      />

      {trip.expenses.length === 0 ? (
        <EmptyState title={copy.budget.empty} hint={copy.budget.emptyHint} />
      ) : (
        <View className="ot-budget__expenses">
          {trip.expenses.map((expense) => (
            <View
              className="ot-budget__expense"
              hoverClass={canEdit ? "ot-row--pressed" : "none"}
              hoverStartTime={0}
              hoverStayTime={80}
              key={expense.id}
              onClick={() => (canEdit ? openComposer(expense) : undefined)}
            >
              <View className="ot-budget__expense-body">
                <Text className="ot-budget__expense-name">
                  {expense.description}
                </Text>
                <Text className="ot-budget__expense-meta">
                  {[
                    `${copy.budget.paidByPrefix} ${memberName(trip, expense.payer)} ${copy.budget.paidBySuffix}`,
                    expense.whenLabel,
                    `${expense.participants.length} ${copy.budget.splitCount}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <View className="ot-budget__expense-amounts">
                <Text className="ot-budget__expense-amount">
                  {inTripCurrency(expense)}
                </Text>
                <Text className="ot-budget__expense-each">
                  {copy.budget.each}{" "}
                  {formatMoney(
                    expense.amount / Math.max(1, expense.participants.length),
                    expense.currency || trip.currency,
                  )}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Sheet
        open={composerOpen}
        title={editing ? copy.app.edit : copy.budget.addTitle}
        onClose={closeComposer}
        footer={
          <>
            <Button variant="secondary" block onClick={closeComposer}>
              {copy.app.cancel}
            </Button>
            <Button block disabled={save.isPending} onClick={submit}>
              {copy.app.save}
            </Button>
          </>
        }
      >
        <TextField
          label={copy.budget.fieldDescription}
          value={description}
          onChange={setDescription}
        />
        <TextField
          label={copy.budget.fieldAmount}
          value={amount}
          type="digit"
          onChange={setAmount}
        />
        <SelectField
          label={copy.budget.fieldPayer}
          value={payer}
          options={trip.members.map((member) => member.id)}
          labelFor={(id) => memberName(trip, id)}
          onChange={setPayer}
        />
        <Text className="ot-budget__participants-label">
          {copy.budget.fieldParticipants}
        </Text>
        <View className="ot-budget__participants">
          {trip.members.map((member) => (
            <View
              className={
                participants.includes(member.id)
                  ? "ot-budget__participant is-selected"
                  : "ot-budget__participant"
              }
              key={member.id}
              onClick={() => toggleParticipant(member.id)}
            >
              <Text className="ot-budget__participant-name">{member.shortName}</Text>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}
