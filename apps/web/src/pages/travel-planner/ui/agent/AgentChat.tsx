import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpIcon } from "lucide-react";
import type { AgentSuggestion } from "@/shared/api";
import { Spinner } from "@/shared/ui/spinner";
import { useAgentChat } from "../../model/useAgentChat";
import { AgentMessageItem, type AgentDisplayMessage } from "./AgentMessage";

/** Message list + sticky input for the shared trip session. */
export function AgentChat({
  tripId,
  canEdit,
  applyingId,
  onApplySuggestion,
}: {
  tripId: string;
  canEdit: boolean;
  applyingId: string | null;
  onApplySuggestion: (suggestion: AgentSuggestion) => void;
}) {
  const { t } = useTranslation("agent");
  const { history, historyPending, liveMessages, streaming, send } =
    useAgentChat(tripId, true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persisted: AgentDisplayMessage[] = (history?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n"),
    actorName: m.actorName,
    source: m.source,
    createdAt: m.createdAt,
  }));

  // Live streaming buffer: only messages not yet persisted (fresh client ids).
  const persistedIds = new Set(persisted.map((m) => m.id));
  const live: AgentDisplayMessage[] = liveMessages
    .filter((m) => !persistedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      role: m.role,
      text: m.parts
        .filter(
          (p): p is { type: "text"; text: string } =>
            p.type === "text" && typeof (p as { text?: unknown }).text === "string",
        )
        .map((p) => p.text)
        .join("\n"),
      actorName: null,
      source: "chat",
      createdAt: null,
    }));

  const messages = [...persisted, ...live];
  const suggestionsByMessage = new Map(
    (history?.suggestions ?? [])
      .filter((s) => s.messageId)
      .map((s) => [s.messageId!, s] as const),
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, streaming]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    try {
      await send(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3"
      >
        {historyPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-4" />
          </div>
        ) : messages.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-pretty text-muted-foreground">
            {t("panel.empty")}
          </p>
        ) : (
          messages.map((m) => (
            <AgentMessageItem
              key={m.id}
              message={m}
              suggestion={suggestionsByMessage.get(m.id)}
              canEdit={canEdit}
              applying={applyingId === suggestionsByMessage.get(m.id)?.id}
              onApply={onApplySuggestion}
            />
          ))
        )}
        {streaming && live.every((m) => m.role !== "assistant") ? (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Spinner className="size-3" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-none items-end gap-1.5 border-t border-border px-3 py-2.5">
        <textarea
          value={draft}
          rows={1}
          placeholder={t("panel.inputPlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-28 min-h-9 w-full flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 hover:border-ring/50 focus:border-ring"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!draft.trim() || sending}
          aria-label={t("panel.send")}
          title={t("panel.send")}
          className="wf-interactive wf-pressable flex size-9 flex-none items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {sending ? <Spinner className="size-4" /> : <ArrowUpIcon className="size-4" />}
        </button>
      </div>
    </div>
  );
}
