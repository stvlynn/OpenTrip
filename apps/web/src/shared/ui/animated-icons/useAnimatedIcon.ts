import { useCallback, useEffect, useRef } from "react";
import type { HTMLAttributes, RefObject } from "react";
import type {
  AnimatedIconHandle,
  AnimatedIconPlay,
  AnimatedIconTrigger,
} from "./types";

/** The lucide-animated icons ship a one-shot sequence; to sustain a looping or
 * timed animation we re-fire it on this cadence. */
const DEFAULT_REPLAY_INTERVAL_MS = 1200;

export interface UseAnimatedIconOptions {
  trigger?: AnimatedIconTrigger;
  play?: AnimatedIconPlay;
  /** Re-fire cadence used for `play: "loop"` and timed playback. */
  replayIntervalMs?: number;
}

export interface UseAnimatedIconResult {
  ref: RefObject<AnimatedIconHandle>;
  start: () => void;
  stop: () => void;
  /** Spread onto the icon when the trigger is hover-based; empty otherwise. */
  hoverHandlers: Pick<
    HTMLAttributes<HTMLElement>,
    "onMouseEnter" | "onMouseLeave"
  >;
}

/** Drives a lucide-animated icon through its imperative handle, implementing the
 * trigger (hover | mount) × playback (once | loop | timed) matrix. */
export function useAnimatedIcon({
  trigger = "hover",
  play = "once",
  replayIntervalMs = DEFAULT_REPLAY_INTERVAL_MS,
}: UseAnimatedIconOptions = {}): UseAnimatedIconResult {
  const ref = useRef<AnimatedIconHandle>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    ref.current?.stopAnimation();
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    ref.current?.startAnimation();

    if (play === "loop" || typeof play === "number") {
      intervalRef.current = setInterval(() => {
        ref.current?.startAnimation();
      }, replayIntervalMs);
    }

    if (typeof play === "number") {
      timeoutRef.current = setTimeout(stop, play);
    }
  }, [clearTimers, play, replayIntervalMs, stop]);

  useEffect(() => {
    if (trigger === "mount") {
      start();
    }
    return clearTimers;
  }, [trigger, start, clearTimers]);

  const hoverHandlers =
    trigger === "hover" ? { onMouseEnter: start, onMouseLeave: stop } : {};

  return { ref, start, stop, hoverHandlers };
}
