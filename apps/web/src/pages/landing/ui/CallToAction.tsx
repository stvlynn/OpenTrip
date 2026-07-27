import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Reveal } from "./Reveal";

/** The trip route drawn as a dashed polyline with its stop pins, running along
 * the foot of the band and off both edges — the product's own visual language
 * rather than an abstract wash, and the thing that makes the full-bleed width
 * read as deliberate. Sits clear of the copy so it never competes with it. */
function RouteMotif() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 120"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 w-full sm:h-32"
    >
      <path
        d="M-40 84 C 180 84 240 30 460 30 S 760 92 980 92 S 1260 34 1480 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="2 11"
        strokeLinecap="round"
        opacity="0.28"
      />
      <g fill="currentColor" opacity="0.45">
        <circle cx="460" cy="30" r="4.5" />
        <circle cx="980" cy="92" r="4.5" />
      </g>
    </svg>
  );
}

/** Closing band — the one full-bleed surface on the page. Navy in light, the
 * raised near-black card surface in dark; it butts straight into the footer so
 * the page ends on a single weighted block rather than a floating card.
 * Headline, subtitle and button reveal in sequence, 60ms apart. */
export function CallToAction({ onGetStarted }: { onGetStarted: () => void }) {
  const { t } = useTranslation("landing");
  return (
    <section className="relative isolate overflow-hidden bg-primary px-5 pt-24 pb-32 text-center text-primary-foreground sm:pt-28 sm:pb-40 dark:bg-card dark:text-foreground">
      <RouteMotif />

      <Reveal className="mx-auto max-w-2xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
          {t("cta.title")}
        </h2>
      </Reveal>
      <Reveal className="mx-auto mt-5 max-w-lg" delay={60}>
        <p className="text-base text-pretty opacity-70">{t("cta.subtitle")}</p>
      </Reveal>
      <Reveal className="mt-9 flex justify-center" delay={120}>
        <Button variant="brand" size="lg" onClick={onGetStarted} className="group">
          {t("cta.button")}
          <ArrowRight
            className="size-4 transition-transform duration-fast ease-out motion-safe:group-hover:translate-x-0.5"
            aria-hidden
          />
        </Button>
      </Reveal>
    </section>
  );
}
