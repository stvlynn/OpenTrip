import { useTranslation } from "react-i18next";
import { SparklesIcon } from "lucide-react";
import type { AgentMessageSource, AgentSuggestion } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib";

export interface AgentDisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  actorName: string | null;
  source: AgentMessageSource;
  createdAt: string | null;
}

function timeLabel(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** One entry in the shared session timeline: member/agent messages as bubbles,
 * operation events as quiet gray lines, plus an inline apply card when the
 * agent attached a pending suggestion. */
export function AgentMessageItem({
  message,
  suggestion,
  canEdit,
  applying,
  onApply,
}: {
  message: AgentDisplayMessage;
  suggestion?: AgentSuggestion;
  canEdit: boolean;
  applying: boolean;
  onApply: (suggestion: AgentSuggestion) => void;
}) {
  const { t, i18n } = useTranslation("agent");

  if (message.role === "system" || message.source === "operation") {
    return (
      <div className="px-1 py-0.5 text-center text-[11px] text-muted-foreground/80">
        {message.actorName ? `${message.actorName} ` : ""}
        {message.text}
      </div>
    );
  }

  const isAgent = message.role === "assistant";
  return (
    <div className={cn("flex flex-col gap-1", isAgent ? "items-start" : "items-end")}>
      <div className="flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground">
        {isAgent ? (
          <>
            <SparklesIcon className="size-3" />
            <span>{t("panel.agentName")}</span>
          </>
        ) : (
          <span>{message.actorName ?? t("panel.systemName")}</span>
        )}
        <span className="tabular-nums">{timeLabel(message.createdAt, i18n.language)}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
          isAgent
            ? "rounded-tl-sm bg-accent text-foreground"
            : "rounded-tr-sm bg-corn-100 text-foreground dark:bg-corn-950",
        )}
      >
        {message.text}
      </div>
      {suggestion && suggestion.status === "pending" && canEdit ? (
        <div className="mt-0.5 flex max-w-[85%] items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {suggestion.suggestionText}
          </span>
          <Button
            size="xs"
            disabled={applying}
            onClick={() => onApply(suggestion)}
          >
            {t("toast.apply")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
