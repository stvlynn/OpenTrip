import type { HTMLAttributes } from "react";
import type {
  AnimatedIconComponent,
  AnimatedIconPlay,
  AnimatedIconTrigger,
} from "./types";
import { useAnimatedIcon } from "./useAnimatedIcon";

export interface AnimatedIconProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onMouseEnter" | "onMouseLeave"> {
  /** A lucide-animated icon component (e.g. `SunIcon`). */
  icon: AnimatedIconComponent;
  size?: number;
  trigger?: AnimatedIconTrigger;
  play?: AnimatedIconPlay;
  replayIntervalMs?: number;
}

/** Renders a lucide-animated icon and wires it to the trigger/playback matrix
 * via {@link useAnimatedIcon}. */
export function AnimatedIcon({
  icon: Icon,
  size,
  trigger,
  play,
  replayIntervalMs,
  ...rest
}: AnimatedIconProps) {
  const { ref, hoverHandlers } = useAnimatedIcon({
    trigger,
    play,
    replayIntervalMs,
  });

  return <Icon ref={ref} size={size} {...rest} {...hoverHandlers} />;
}
