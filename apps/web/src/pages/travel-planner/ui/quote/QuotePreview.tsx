import { XIcon } from "lucide-react";
import { cn, interactive } from "@/shared/lib";
import type { QuoteTarget } from "./formatQuote";

/** Dismissible quote chip shown above a composer while a reply is pending. */
export function QuotePreview({
  quote,
  dismissLabel,
  onDismiss,
  className,
}: {
  quote: QuoteTarget;
  dismissLabel: string;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-muted-foreground">
          {quote.author}
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-foreground/80 text-pretty">
          {quote.text}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground",
          interactive,
        )}
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </div>
  );
}
