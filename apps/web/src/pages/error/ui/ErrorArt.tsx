import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn, unsplashSrc, unsplashSrcSet } from "@/shared/lib";
import type { ErrorPhoto } from "../model/variants";

/** Travel photo for an error surface. Alt text comes from i18n; nothing is
 *  overlaid on the image. Fades in on load so it never pops from nothing. */
export function ErrorArt({ photo }: { photo: ErrorPhoto }) {
  const { t } = useTranslation("error");
  const [loaded, setLoaded] = useState(false);

  return (
    <figure className="overflow-hidden rounded-2xl bg-muted shadow-[var(--shadow-md)] ring-1 ring-border">
      {/* Fixed aspect box reserves space before the photo decodes (no CLS). */}
      <div className="aspect-[4/3] w-full">
        <img
          src={unsplashSrc(photo.id, 1200)}
          srcSet={unsplashSrcSet(photo.id, [800, 1200, 1600])}
          sizes="(min-width: 1024px) 40rem, 100vw"
          alt={t(`photos.${photo.descriptionKey}`)}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            "size-full object-cover transition-[opacity,scale] duration-slow ease-out",
            loaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0",
          )}
        />
      </div>
    </figure>
  );
}
