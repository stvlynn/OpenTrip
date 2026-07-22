import { useEffect, useRef } from "react";
import { Map as MlMap, Marker } from "maplibre-gl";
import { useResolvedTheme } from "@/shared/lib/theme";
import { mapStyleUrlForTheme } from "./map-theme";
import { cn } from "@/shared/lib";

export function TripMapThumbnail({
  lat,
  lng,
  markerColor,
  attributionClassName,
}: {
  lat: number;
  lng: number;
  markerColor: string;
  attributionClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MlMap({
      container: containerRef.current,
      style: mapStyleUrlForTheme(theme),
      center: [lng, lat],
      zoom: 10.5,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      preserveDrawingBuffer: false,
    });
    new Marker({ color: markerColor, scale: 0.65 })
      .setLngLat([lng, lat])
      .addTo(map);
    return () => map.remove();
  }, [lat, lng, markerColor, theme]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div ref={containerRef} className="size-full" />
      <span className={cn("absolute bottom-1 left-1.5 rounded bg-background/75 px-1 py-0.5 text-[8px] text-muted-foreground backdrop-blur-sm", attributionClassName)}>
        © OpenStreetMap · © CARTO
      </span>
    </div>
  );
}
