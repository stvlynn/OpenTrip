import type { TimelineStep, WeatherClient } from "../../domain/weather/ports";
import type { TimelineResponse } from "./onecall-types";

interface CacheEntry {
  value: TimelineResponse;
  expiresAt: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const HOURLY_BUCKET_SECONDS = 60 * 60; // 1 h
const DAILY_BUCKET_SECONDS = 10 * 24 * 60 * 60; // 10 days

export class CachedWeatherClient implements WeatherClient {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<TimelineResponse>>();

  constructor(
    private client: WeatherClient,
    private ttlMs: number = ONE_HOUR_MS,
  ) {}

  async timeline(
    step: TimelineStep,
    lat: number,
    lon: number,
    start: number,
    lang: string,
    cnt = 10,
  ): Promise<TimelineResponse> {
    const cacheStart = bucketStart(step, start);
    const key = `${step}:${roundCoordinate(lat)}:${roundCoordinate(lon)}:${cacheStart}:${lang}:${cnt}`;

    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const stale = cached?.value;
    const refresh = this.startRefresh(key, step, lat, lon, cacheStart, lang, cnt);

    if (stale) {
      // Return the stale response immediately and refresh in the background.
      // If the refresh fails, we keep serving the stale entry until it succeeds.
      refresh.catch(() => {});
      return stale;
    }

    return refresh;
  }

  private startRefresh(
    key: string,
    step: TimelineStep,
    lat: number,
    lon: number,
    start: number,
    lang: string,
    cnt: number,
  ): Promise<TimelineResponse> {
    let refresh = this.inFlight.get(key);
    if (!refresh) {
      refresh = this.client
        .timeline(step, lat, lon, start, lang, cnt)
        .then((value) => {
          this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
          return value;
        })
        .finally(() => {
          this.inFlight.delete(key);
        });
      this.inFlight.set(key, refresh);
    }
    return refresh;
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function bucketStart(step: TimelineStep, start: number): number {
  if (step === "1h") {
    return Math.floor(start / HOURLY_BUCKET_SECONDS) * HOURLY_BUCKET_SECONDS;
  }
  return Math.floor(start / DAILY_BUCKET_SECONDS) * DAILY_BUCKET_SECONDS;
}
