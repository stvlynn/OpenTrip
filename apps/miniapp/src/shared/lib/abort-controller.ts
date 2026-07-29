/**
 * `AbortController` / `AbortSignal` for the WeChat Mini Program runtime, which
 * ships neither (nor `EventTarget`, so the DOM classes cannot be reused).
 *
 * React Query constructs an `AbortController` for every fetch, so without this
 * the constructor throws inside an already-async code path, the rejection is
 * swallowed, and queries stay pending forever without ever calling `queryFn`.
 *
 * The surface is limited to what a signal consumer needs: `aborted`, `reason`,
 * `onabort`, `addEventListener`/`removeEventListener` for the `abort` event, and
 * `throwIfAborted`.
 */

type AbortListener = (event: { type: "abort"; target: MiniAbortSignal }) => void;

class MiniAbortSignal {
  aborted = false;
  reason: unknown = undefined;
  onabort: AbortListener | null = null;

  private readonly listeners = new Set<AbortListener>();

  addEventListener(type: string, listener: AbortListener): void {
    if (type !== "abort") return;
    this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: AbortListener): void {
    if (type !== "abort") return;
    this.listeners.delete(listener);
  }

  throwIfAborted(): void {
    if (this.aborted) throw this.reason;
  }

  /** Internal: invoked by the owning controller. */
  dispatchAbort(reason: unknown): void {
    if (this.aborted) return;
    this.aborted = true;
    this.reason = reason;
    const event = { type: "abort" as const, target: this };
    this.onabort?.(event);
    for (const listener of [...this.listeners]) listener(event);
    this.listeners.clear();
  }
}

class MiniAbortController {
  readonly signal = new MiniAbortSignal();

  abort(reason?: unknown): void {
    this.signal.dispatchAbort(reason ?? abortError());
  }
}

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

/** Installs the shims once, leaving a runtime that already has them untouched. */
export function installAbortController(): void {
  const scope = globalThis as Record<string, unknown>;
  scope.AbortSignal ??= MiniAbortSignal;
  scope.AbortController ??= MiniAbortController;
}
