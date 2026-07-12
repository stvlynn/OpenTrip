import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useTranslation } from "react-i18next";
import {
  type GeoJSONSource,
  GeolocateControl,
  LngLatBounds,
  Map as MlMap,
  Marker,
  NavigationControl,
  Popup,
} from "maplibre-gl";
import { reversePlace } from "@/shared/api";
import type { MapStop, SearchResult, UserLocationAvatar } from "./types";
import { SearchPopup } from "./SearchPopup";
import { UserLocationMarker } from "./UserLocationMarker";
import "./map.css";

const STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/** ~45m — only reverse-geocode again after a meaningful move. */
const REVERSE_DELTA = 0.0004;

export interface TripMapProps {
  stops: MapStop[];
  /** 0 = all days, otherwise the day number. */
  day: number;
  activeStopId?: string | null;
  onSelectStop?: (id: string) => void;
  unavailableLabel?: string;
  /** When true, the map enters point-picking mode (pushpin cursor). */
  picking?: boolean;
  /** Called with the clicked coordinates while `picking`. */
  onPick?: (lng: number, lat: number) => void;
  /** Called with the coordinates of a right-click / long-press. */
  onContext?: (lng: number, lat: number) => void;
  /** Optional search result to highlight with a temporary marker + popup. */
  searchResult?: SearchResult | null;
  /** Called from the search-result popup's "Add stop here" button. */
  onAddSearchResult?: () => void;
  /** Used when there are no stops yet (e.g. geocoded create-wizard destination). */
  fallbackCenter?: { lat: number; lng: number } | null;
  /** Current user's avatar for the live location marker. */
  userAvatar?: UserLocationAvatar | null;
  /**
   * Increment to request centering on the user (e.g. from FloatingMembers).
   * Starts geolocation if needed; otherwise flies to the last known position.
   */
  locateSignal?: number;
}

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.6;
const FALLBACK_ZOOM = 10;

/** Pushpin cursor (data URI) with the hotspot at the pin tip. */
const PIN_CURSOR =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23e11d48" stroke="white" stroke-width="1.5"><path d="M12 2c-3.9 0-7 3.1-7 7 0 5 7 13 7 13s7-8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/></svg>',
  ) +
  "\") 16 30, crosshair";

/** MapLibre wrapper in the spirit of mapcn: CARTO positron basemap, per-day
 * colored routes, numbered markers, and active-stop focus. */
export function TripMap({
  stops,
  day,
  activeStopId,
  onSelectStop,
  unavailableLabel = "Map unavailable offline",
  picking = false,
  onPick,
  onContext,
  searchResult = null,
  onAddSearchResult,
  fallbackCenter = null,
  userAvatar = null,
  locateSignal = 0,
}: TripMapProps) {
  const { t, i18n } = useTranslation("planner");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const readyRef = useRef(false);
  const lastFitRef = useRef<string | null>(null);
  const selectRef = useRef(onSelectStop);
  const pickRef = useRef(onPick);
  const contextRef = useRef(onContext);
  const onAddSearchResultRef = useRef(onAddSearchResult);
  const fallbackCenterRef = useRef(fallbackCenter);
  const searchMarkerRef = useRef<Marker | null>(null);
  const searchPopupRef = useRef<Popup | null>(null);
  const searchRootRef = useRef<Root | null>(null);
  const geolocateRef = useRef<GeolocateControl | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const userRootRef = useRef<Root | null>(null);
  const lastUserPosRef = useRef<{ lng: number; lat: number } | null>(null);
  const lastUpdatedAtRef = useRef(0);
  const placeLabelRef = useRef("");
  const lastReverseRef = useRef<{ lng: number; lat: number } | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const trackingRef = useRef(false);
  /** True while a user-initiated locate is waiting on the Geolocation API. */
  const locatePendingRef = useRef(false);
  const userAvatarRef = useRef(userAvatar);
  const locateLabelRef = useRef(t("map.locate"));
  const locateUserRef = useRef<() => void>(() => {});
  const renderUserMarkerRef = useRef<() => void>(() => {});
  const ensureUserMarkerRef = useRef<(lng: number, lat: number) => void>(
    () => {},
  );
  const clearUserMarkerRef = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  selectRef.current = onSelectStop;
  pickRef.current = onPick;
  contextRef.current = onContext;
  onAddSearchResultRef.current = onAddSearchResult;
  fallbackCenterRef.current = fallbackCenter;
  userAvatarRef.current = userAvatar;
  locateLabelRef.current = t("map.locate");

  clearUserMarkerRef.current = () => {
    reverseAbortRef.current?.abort();
    reverseAbortRef.current = null;
    userRootRef.current?.unmount();
    userRootRef.current = null;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    lastUserPosRef.current = null;
    lastUpdatedAtRef.current = 0;
    placeLabelRef.current = "";
    lastReverseRef.current = null;
  };

  renderUserMarkerRef.current = () => {
    const avatar = userAvatarRef.current;
    const root = userRootRef.current;
    if (!avatar || !root) return;
    root.render(
      <UserLocationMarker
        avatar={avatar}
        placeLabel={
          placeLabelRef.current || t("map.location.resolving")
        }
        updatedAt={lastUpdatedAtRef.current || Date.now()}
        locateLabel={locateLabelRef.current}
        updatedNowLabel={t("map.location.now")}
        updatedMinutesLabel={(count) =>
          t("map.location.minutesAgo", { count })
        }
        updatedHoursLabel={(count) => t("map.location.hoursAgo", { count })}
        onActivate={() => locateUserRef.current()}
      />,
    );
  };

  // Stable callbacks for the one-shot map boot + Marker click handlers.
  locateUserRef.current = () => {
    const geolocate = geolocateRef.current;
    const map = mapRef.current;
    const known = lastUserPosRef.current;

    // Already tracking with a known fix — go there immediately.
    if (known && trackingRef.current && map) {
      locatePendingRef.current = false;
      map.flyTo({
        center: [known.lng, known.lat],
        zoom: Math.max(map.getZoom(), 14),
        duration: 900,
      });
      return;
    }

    // Wait for the Geolocation API; suppress destination/stop camera until then.
    locatePendingRef.current = true;
    if (!geolocate) return;
    if (!trackingRef.current) {
      geolocate.trigger();
    }
  };

  ensureUserMarkerRef.current = (lng, lat) => {
    lastUserPosRef.current = { lng, lat };
    lastUpdatedAtRef.current = Date.now();
    const map = mapRef.current;
    const avatar = userAvatarRef.current;
    if (!map || !avatar || !readyRef.current) return;

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "trip-map-user-location-host";
      userRootRef.current = createRoot(el);
      userMarkerRef.current = new Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }

    renderUserMarkerRef.current();

    const prev = lastReverseRef.current;
    const moved =
      !prev ||
      Math.abs(prev.lng - lng) > REVERSE_DELTA ||
      Math.abs(prev.lat - lat) > REVERSE_DELTA;
    if (!moved) return;

    lastReverseRef.current = { lng, lat };
    reverseAbortRef.current?.abort();
    const ac = new AbortController();
    reverseAbortRef.current = ac;
    const lang = i18n.language.startsWith("zh") ? "zh" : "en";
    void reversePlace(lat, lng, lang)
      .then((place) => {
        if (ac.signal.aborted) return;
        placeLabelRef.current = place
          ? place.label
          : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        renderUserMarkerRef.current();
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        if (!placeLabelRef.current) {
          placeLabelRef.current = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          renderUserMarkerRef.current();
        }
      });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Avatar/locate opened the map — don't boot on trip destination or the
    // first paint steals the camera before Geolocation returns.
    const openForLocate = locateSignal > 0;
    if (openForLocate) locatePendingRef.current = true;
    const boot = openForLocate ? null : fallbackCenterRef.current;
    let map: MlMap;
    try {
      map = new MlMap({
        container: containerRef.current,
        style: STYLE_URL,
        center: boot ? [boot.lng, boot.lat] : DEFAULT_CENTER,
        zoom: boot ? FALLBACK_ZOOM : DEFAULT_ZOOM,
        attributionControl: false,
        locale: {
          "GeolocateControl.FindMyLocation": locateLabelRef.current,
          "GeolocateControl.LocationNotAvailable": locateLabelRef.current,
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const geolocate = new GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 10_000,
      },
      fitBoundsOptions: { maxZoom: 15 },
      trackUserLocation: true,
      showAccuracyCircle: false,
      showUserLocation: false,
    });
    map.addControl(geolocate, "top-right");
    geolocateRef.current = geolocate;

    // Fold locate into the zoom control group so the stack is one level surface.
    const topRight = map.getContainer().querySelector(".maplibregl-ctrl-top-right");
    const groups = topRight?.querySelectorAll(":scope > .maplibregl-ctrl-group");
    if (groups && groups.length >= 2) {
      const zoomGroup = groups[0]!;
      const locateGroup = groups[1]!;
      const locateBtn = locateGroup.querySelector("button");
      if (locateBtn) {
        zoomGroup.appendChild(locateBtn);
        locateGroup.remove();
      }
    }

    geolocate.on("geolocate", (e: { coords: GeolocationCoordinates }) => {
      const { longitude, latitude } = e.coords;
      ensureUserMarkerRef.current(longitude, latitude);
      if (!locatePendingRef.current) return;
      locatePendingRef.current = false;
      map.flyTo({
        center: [longitude, latitude],
        zoom: Math.max(map.getZoom(), 14),
        duration: 900,
      });
    });
    geolocate.on("error", () => {
      locatePendingRef.current = false;
    });
    geolocate.on("trackuserlocationstart", () => {
      trackingRef.current = true;
    });
    geolocate.on("trackuserlocationend", () => {
      // Zoom/pan moves ACTIVE_LOCK → BACKGROUND and fires this event, but
      // watchPosition keeps running. Only clear the avatar when fully OFF.
      const btn = map
        .getContainer()
        .querySelector(".maplibregl-ctrl-geolocate");
      const stillTracking =
        btn?.classList.contains("maplibregl-ctrl-geolocate-background") ||
        btn?.classList.contains("maplibregl-ctrl-geolocate-background-error") ||
        btn?.classList.contains("maplibregl-ctrl-geolocate-active") ||
        btn?.classList.contains("maplibregl-ctrl-geolocate-active-error") ||
        btn?.classList.contains("maplibregl-ctrl-geolocate-waiting");
      if (stillTracking) {
        trackingRef.current = true;
        return;
      }
      trackingRef.current = false;
      locatePendingRef.current = false;
      clearUserMarkerRef.current();
    });

    map.on("error", () => setFailed(true));
    map.on("contextmenu", (e) => {
      contextRef.current?.(e.lngLat.lng, e.lngLat.lat);
    });
    map.on("load", () => {
      map.addSource("trip-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "trip-route-casing",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      });
      readyRef.current = true;
      map.resize();
      // trigger the first sync
      setFailed((f) => f);
      syncRef.current();
      const pos = lastUserPosRef.current;
      if (pos) ensureUserMarkerRef.current(pos.lng, pos.lat);
      // Locate was requested before the control existed — start it now.
      if (locatePendingRef.current) locateUserRef.current();
    });
    mapRef.current = map;
    return () => {
      clearUserMarkerRef.current();
      geolocateRef.current = null;
      trackingRef.current = false;
      locatePendingRef.current = false;
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Keep a stable ref to the latest sync so map load can call it.
  const syncRef = useRef<() => void>(() => {});
  syncRef.current = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const visible = day === 0 ? stops : stops.filter((s) => s.day === day);
    const active = activeStopId ?? "";

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    for (const s of visible) {
      const el = document.createElement("div");
      el.className = "trip-map-marker";
      el.style.background = s.color;
      el.textContent = String(s.num);
      el.dataset.active = s.id === active ? "true" : "false";
      if (s.transit) el.dataset.transit = "true";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectRef.current?.(s.id);
      });
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }

    const byDay = new Map<number, MapStop[]>();
    for (const s of visible) {
      const list = byDay.get(s.day) ?? [];
      list.push(s);
      byDay.set(s.day, list);
    }
    const features = [...byDay.values()]
      .filter((pts) => pts.length > 1)
      .map((pts) => ({
        type: "Feature" as const,
        properties: { color: pts[0]!.color },
        geometry: {
          type: "LineString" as const,
          coordinates: pts.map((p) => [p.lng, p.lat]),
        },
      }));
    const src = map.getSource("trip-route") as GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features });

    // User asked to locate — don't steal the camera with destination/stops.
    if (locatePendingRef.current) return;

    const activeStop = visible.find((s) => s.id === active);
    if (activeStop && !searchResult) {
      map.flyTo({
        center: [activeStop.lng, activeStop.lat],
        zoom: Math.max(map.getZoom(), 13.5),
        duration: 900,
      });
      popupRef.current = new Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: false,
      })
        .setLngLat([activeStop.lng, activeStop.lat])
        .setText(activeStop.name)
        .addTo(map);
    } else if (visible.length && !searchResult) {
      const fitKey = `${day}:${visible.length}`;
      if (fitKey !== lastFitRef.current) {
        lastFitRef.current = fitKey;
        const b = new LngLatBounds();
        visible.forEach((s) => b.extend([s.lng, s.lat]));
        map.fitBounds(b, { padding: 70, maxZoom: 13, duration: 900 });
      }
    } else if (!visible.length && !searchResult && fallbackCenter) {
      const fitKey = `fallback:${fallbackCenter.lng},${fallbackCenter.lat}`;
      if (fitKey !== lastFitRef.current) {
        lastFitRef.current = fitKey;
        map.flyTo({
          center: [fallbackCenter.lng, fallbackCenter.lat],
          zoom: FALLBACK_ZOOM,
          duration: 900,
        });
      }
    }
  };

  useEffect(() => {
    syncRef.current();
  }, [stops, day, activeStopId, searchResult, fallbackCenter]);

  // Refresh avatar marker when the current user identity or language changes.
  useEffect(() => {
    if (!userMarkerRef.current) return;
    renderUserMarkerRef.current();
  }, [userAvatar, i18n.language, t]);

  // External locate request (FloatingMembers avatar click, etc.).
  useEffect(() => {
    if (!locateSignal) return;
    locateUserRef.current();
  }, [locateSignal]);

  // Keep control labels in sync with the active language.
  useEffect(() => {
    const label = t("map.locate");
    const unavailable = t("map.locateUnavailable");
    const btn = containerRef.current?.querySelector(
      ".maplibregl-ctrl-geolocate",
    ) as HTMLButtonElement | null;
    if (!btn) return;
    btn.title = label;
    btn.setAttribute("aria-label", label);
    if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
      btn.title = unavailable;
      btn.setAttribute("aria-label", unavailable);
    }
  }, [i18n.language, t]);

  // Point-picking mode: pushpin cursor + one click resolves a coordinate.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (!picking) {
      canvas.style.cursor = "";
      return;
    }
    canvas.style.cursor = PIN_CURSOR;
    const handler = (e: { lngLat: { lng: number; lat: number } }) => {
      pickRef.current?.(e.lngLat.lng, e.lngLat.lat);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
      canvas.style.cursor = "";
    };
  }, [picking]);

  // Render a temporary marker + popup for the current search result.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !searchResult) return;

    searchRootRef.current?.unmount();
    searchMarkerRef.current?.remove();
    searchPopupRef.current?.remove();

    const el = document.createElement("div");
    el.className = "trip-map-search-marker";
    el.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>' +
      '<circle cx="12" cy="10" r="3" fill="white" stroke="none"/>' +
      "</svg>";

    const marker = new Marker({ element: el, anchor: "bottom" })
      .setLngLat([searchResult.lng, searchResult.lat])
      .addTo(map);
    searchMarkerRef.current = marker;

    const container = document.createElement("div");
    const root = createRoot(container);
    searchRootRef.current = root;
    root.render(
      <SearchPopup
        name={searchResult.name}
        addLabel={t("map.popup.addStop")}
        onAdd={() => onAddSearchResultRef.current?.()}
      />,
    );

    const popup = new Popup({
      offset: 12,
      closeButton: false,
      closeOnClick: false,
      className: "trip-map-search-popup",
    })
      .setLngLat([searchResult.lng, searchResult.lat])
      .setDOMContent(container)
      .addTo(map);
    searchPopupRef.current = popup;

    map.flyTo({
      center: [searchResult.lng, searchResult.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 900,
    });

    return () => {
      searchRootRef.current?.unmount();
      searchMarkerRef.current?.remove();
      searchPopupRef.current?.remove();
      searchRootRef.current = null;
      searchMarkerRef.current = null;
      searchPopupRef.current = null;
    };
  }, [searchResult, i18n.language, t]);

  return (
    <div ref={containerRef} className="relative size-full overflow-hidden bg-[#e9ecf4]">
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-muted-foreground">
          {unavailableLabel}
        </div>
      ) : null}
    </div>
  );
}
