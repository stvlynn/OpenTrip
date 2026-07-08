import type { Transition, Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { ReactNode } from "react";

type AnimationControls = ReturnType<typeof useAnimation>;
import { forwardRef, useImperativeHandle } from "react";
import { cn } from "@/shared/lib";
import type {
  AnimatedIconComponent,
  AnimatedIconHandle,
  AnimatedIconOwnProps,
} from "./types";

interface CreateAnimatedIconOptions {
  size?: number;
  /** Animate the root `<svg>` itself (e.g. rotating the whole glyph). When
   * omitted the root is a plain `<svg>` and only the returned children animate. */
  svg?: { variants: Variants; transition?: Transition };
}

/** Builds a lucide-animated icon component from its markup, sharing the
 * imperative-handle plumbing that every icon in the set would otherwise repeat.
 * Playback is driven exclusively through the handle (used by `AnimatedIcon`);
 * the render callback receives the `controls` to wire onto motion elements. */
export function createAnimatedIcon(
  displayName: string,
  children: (controls: AnimationControls) => ReactNode,
  { size: defaultSize = 24, svg }: CreateAnimatedIconOptions = {},
): AnimatedIconComponent {
  const Icon = forwardRef<AnimatedIconHandle, AnimatedIconOwnProps>(
    ({ className, size = defaultSize, ...props }, ref) => {
      const controls = useAnimation();

      useImperativeHandle(ref, () => ({
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      }));

      const svgProps = {
        fill: "none",
        height: size,
        width: size,
        viewBox: "0 0 24 24",
        stroke: "currentColor",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        strokeWidth: 2,
        style: { overflow: "visible" as const },
        xmlns: "http://www.w3.org/2000/svg",
      };

      return (
        <div className={cn(className)} {...props}>
          {svg ? (
            <motion.svg
              {...svgProps}
              animate={controls}
              initial="normal"
              variants={svg.variants}
              transition={svg.transition}
            >
              {children(controls)}
            </motion.svg>
          ) : (
            <svg {...svgProps}>{children(controls)}</svg>
          )}
        </div>
      );
    },
  );

  Icon.displayName = displayName;
  return Icon;
}
