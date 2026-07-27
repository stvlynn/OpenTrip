import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { unsplashSrc, unsplashSrcSet } from "@/shared/lib";
import { Button } from "@/shared/ui/button";
import { Reveal } from "./Reveal";
import { PhoneFrame } from "./DeviceFrames";
import { CTA_PHOTO_ID } from "../lib/content";
import scheduleShot from "../assets/pwa-schedule.jpg";

/** Travel photograph washed into the band at low opacity — texture behind the
 * band, not an image anyone is meant to read. Purely decorative, so it carries
 * no alt text and is hidden from assistive tech. The global 1px image outline
 * is suppressed: it would draw a hairline box around the wash.
 *
 * The photo comes from the Unsplash CDN, so it can fail (offline, blocked
 * network). The band is designed to stand on its own colour without it; drop
 * the element on error so no broken-image glyph is left on the marketing page. */
function PhotoWash() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      onError={() => setFailed(true)}
      src={unsplashSrc(CTA_PHOTO_ID, 1600)}
      srcSet={unsplashSrcSet(CTA_PHOTO_ID, [960, 1600, 2400])}
      sizes="100vw"
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      style={{ outline: "none" }}
      className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-[0.10] dark:opacity-[0.14]"
    />
  );
}

/** Closing band — the page's one full-bleed surface. Navy in light, the raised
 * card surface in dark, washed with a travel photo and butting straight into
 * the footer so the page ends on a single weighted block. The ask sits left;
 * the trip itself rises out of the bottom edge, so the last thing on the page
 * is the thing being sold. */
export function CallToAction({ onGetStarted }: { onGetStarted: () => void }) {
  const { t } = useTranslation("landing");

  return (
    <section className="relative isolate overflow-hidden bg-primary px-5 pt-20 text-primary-foreground sm:pt-24 dark:bg-card dark:text-foreground">
      <PhotoWash />

      <div className="mx-auto grid max-w-6xl items-end gap-10 md:grid-cols-[1fr_auto]">
        <div className="pb-10 text-center md:pb-28 md:text-left">
          <Reveal>
            <h2 className="max-w-xl text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
              {t("cta.title")}
            </h2>
          </Reveal>
          <Reveal className="mt-5" delay={60}>
            <p className="max-w-md text-base text-pretty opacity-70">{t("cta.subtitle")}</p>
          </Reveal>
          <Reveal className="mt-9 flex justify-center md:justify-start" delay={120}>
            <Button variant="brand" size="lg" onClick={onGetStarted} className="group">
              {t("cta.button")}
              <ArrowRight
                className="size-4 transition-transform duration-fast ease-out motion-safe:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Button>
          </Reveal>
        </div>

        <Reveal className="-mb-24 flex justify-center md:-mb-20" delay={180}>
          <PhoneFrame
            src={scheduleShot}
            alt={t("mobile.scheduleAlt")}
            className="w-48 rotate-3 sm:w-64 md:w-72"
          />
        </Reveal>
      </div>
    </section>
  );
}
