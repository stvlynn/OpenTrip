/** Weather proxy client. The browser calls our own `/api/weather` endpoint,
 * which returns a normalized `WeatherData` shape (or `null` when the requested
 * date is outside the forecast window). */

import { apiFetch } from "./client";

export interface WeatherData {
  /** OpenWeather icon code, e.g. `01d` or `10n`. */
  icon: string;
  /** Short weather group, e.g. `Rain`. */
  main: string;
  /** Human-readable description, e.g. `light rain`. */
  description: string;
  /** Temperature in °C (when `units=metric` is used). */
  temp: number;
  /** Perceived temperature in °C. */
  feelsLike: number;
  /** Humidity percentage (0-100). */
  humidity: number;
  /** Atmospheric pressure at sea level, hPa. */
  pressure: number;
  /** Average visibility in metres. */
  visibility: number;
  /** Wind speed in metres per second. */
  windSpeed: number;
  /** Wind direction in degrees (meteorological). */
  windDeg: number;
  /** Cloudiness percentage (0-100). */
  clouds: number;
}

export async function fetchWeather(
  lat: number,
  lng: number,
  date?: string,
  time?: string,
  { signal, lang = "en" }: { signal?: AbortSignal; lang?: string } = {},
): Promise<WeatherData | null> {
  const url = new URL("/api/weather", window.location.origin);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lang", lang);
  if (date) url.searchParams.set("date", date);
  if (time) url.searchParams.set("time", time);

  return apiFetch<WeatherData | null>(url.pathname + url.search, {
    signal,
  });
}
