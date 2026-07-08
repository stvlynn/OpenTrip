import type {
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from "react";

/** Imperative handle exposed by every lucide-animated icon. */
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface AnimatedIconOwnProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

/** Structural type shared by all lucide-animated icon components. */
export type AnimatedIconComponent = ForwardRefExoticComponent<
  AnimatedIconOwnProps & RefAttributes<AnimatedIconHandle>
>;

/** What kicks off the animation. */
export type AnimatedIconTrigger = "hover" | "mount";

/** How long the animation keeps running once triggered:
 * - `"once"`: play the icon's built-in one-shot sequence a single time.
 * - `"loop"`: keep animating (常亮) until the trigger ends.
 * - `number`: keep animating for that many milliseconds, then stop (持续 xx 时间). */
export type AnimatedIconPlay = "once" | "loop" | number;
