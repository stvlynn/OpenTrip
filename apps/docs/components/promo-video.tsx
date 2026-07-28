type DemoVideoProps = {
  src: string;
  /** Short description of what the demo shows (also used as accessible name). */
  caption: string;
  /** Optional still frame while the video loads. */
  poster?: string;
};

/**
 * Embeds a freshly rendered H.264 docs demo from `docs/assets/demos/` for
 * fumadocs MDX. Prefer muted + controls so static export stays Safari-friendly.
 */
export function DemoVideo({ src, caption, poster }: DemoVideoProps) {
  return (
    <figure className="ot-demo-video">
      <video
        src={src}
        poster={poster}
        controls
        muted
        playsInline
        loop
        preload="metadata"
        aria-label={caption}
      >
        Your browser does not support the video tag.
      </video>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** @deprecated Use DemoVideo — kept so older MDX drafts do not break mid-migration. */
export const PromoVideo = DemoVideo;
