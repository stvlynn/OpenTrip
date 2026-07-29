import type { TripIntake } from "@/entities/trip";
import { copy } from "@/shared/copy";

function fill(template: string, values: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(String(value));
  }
  return out;
}

/** Build the one-shot suggested @agent draft from create-trip intake. Returns
 * null when there is nothing useful to ask (all fields TBD / empty intake).
 * Mirrors the PWA's buildAgentSeedMessage with copy from shared/copy. */
export function buildAgentSeedMessage(
  intake: TripIntake | null | undefined,
): string | null {
  if (!intake) return null;

  const parts: string[] = [];
  if (intake.destination) {
    parts.push(
      fill(copy.agent.seedPartDestination, { destination: intake.destination }),
    );
  }
  if (intake.dayCount != null) {
    parts.push(fill(copy.agent.seedPartDays, { count: intake.dayCount }));
  }
  if (intake.startDate && intake.endDate) {
    parts.push(
      fill(copy.agent.seedPartDates, {
        start: intake.startDate,
        end: intake.endDate,
      }),
    );
  } else if (intake.startDate) {
    parts.push(fill(copy.agent.seedPartStart, { start: intake.startDate }));
  }
  if (intake.budgetAmount != null) {
    const currency = intake.budgetCurrency?.trim();
    parts.push(
      currency
        ? fill(copy.agent.seedPartBudgetWithCurrency, {
            amount: intake.budgetAmount,
            currency,
          })
        : fill(copy.agent.seedPartBudget, { amount: intake.budgetAmount }),
    );
  }
  if (intake.partySize != null) {
    parts.push(fill(copy.agent.seedPartParty, { count: intake.partySize }));
  }

  if (parts.length === 0) return null;
  return fill(copy.agent.seedMessage, {
    details: parts.join(copy.agent.seedJoiner),
  });
}
