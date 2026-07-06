import { useTranslation } from "react-i18next";
import type { Trip } from "@/entities/trip";
import { CategoryIcon, type Stop } from "@/entities/stop";
import { cn, formatMoney } from "@/shared/lib";

export interface StopCardProps {
  trip: Trip;
  stop: Stop;
  /** Day color used for the left accent border. */
  color: string;
  /** Highlight the card as the active selection. */
  selected?: boolean;
  onSelect: (id: string) => void;
}

/** Single itinerary stop rendered as a card. Shared between the schedule board
 * columns and the sidebar list so both surfaces stay visually identical. */
export function StopCard({ trip, stop, color, selected, onSelect }: StopCardProps) {
  const { t } = useTranslation("planner");

  const meta = [
    t(`category.${stop.category}`),
    stop.cost
      ? t("detail.perPerson", {
          amount: formatMoney(stop.cost, stop.costCurrency || trip.currency),
        })
      : null,
    stop.votes.length
      ? t("schedule.voteCount", { count: stop.votes.length })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onSelect(stop.id)}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border border-l-[3px] bg-card p-2.5 text-left shadow-xs transition-[border-color,scale] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-corn-300 hover:shadow-sm active:scale-[var(--press-scale)]",
        selected && "border-corn-300 ring-1 ring-corn-300",
      )}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {stop.time}
        </span>
        <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
          {stop.duration}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <CategoryIcon category={stop.category} />
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-pretty">
          {stop.name}
        </span>
      </div>
      <span className="pl-7 text-xs text-muted-foreground text-pretty tabular-nums">
        {meta}
      </span>
    </button>
  );
}
