import { useTranslation } from "react-i18next";
import { SparklesIcon, XIcon } from "lucide-react";
import type { AgentSuggestion } from "@/shared/api";
import { AgentChat } from "./AgentChat";

/** Expanded-state agent panel: an inset drawer on the right edge of the main
 * area. The itinerary/map stays visible beside it. */
export function AgentDrawer({
  tripId,
  canEdit,
  applyingId,
  onApplySuggestion,
  onClose,
}: {
  tripId: string;
  canEdit: boolean;
  applyingId: string | null;
  onApplySuggestion: (suggestion: AgentSuggestion) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("agent");
  return (
    <div className="wf-enter absolute right-0 top-0 z-30 flex h-full w-[min(360px,85vw)] flex-col border-l border-border bg-background shadow-[-12px_0_32px_-20px_rgba(15,23,42,0.35)]">
      <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2.5">
        <SparklesIcon className="size-4 text-corn-600" />
        <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold">
          {t("panel.title")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("toggle.close")}
          title={t("toggle.close")}
          className="wf-interactive wf-pressable flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <AgentChat
        tripId={tripId}
        canEdit={canEdit}
        applyingId={applyingId}
        onApplySuggestion={onApplySuggestion}
      />
    </div>
  );
}
