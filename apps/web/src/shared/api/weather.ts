/** Weather proxy client. The browser calls our own `/api/weather` endpoint,
 * which forwards the request to OpenWeather with the server-side API key. */

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

interface OpenWeatherResponse {
  weather?: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main?: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  visibility?: number;
  wind?: {
    speed: number;
    deg: number;
  };
  clouds?: {
    all: number;
  };
}

export async function fetchWeather(
  lat: number,
  lng: number,
  { signal, lang = "en" }: { signal?: AbortSignal; lang?: string } = {},
): Promise<WeatherData> {
  const url = new URL("/api/weather", window.location.origin);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lang", lang);

  const data = await apiFetch<OpenWeatherResponse>(url.pathname + url.search, {
    signal,
  });

  const weather = data.weather?.[0];
  const main = data.main;

  if (!weather || !main) {
    throw new Error("weather_invalid_response");
  }

  return {
    icon: weather.icon,
    main: weather.main,
    description: weather.description,
    temp: main.temp,
    feelsLike: main.feels_like,
    humidity: main.humidity,
    pressure: main.pressure,
    visibility: data.visibility ?? 10_000,
    windSpeed: data.wind?.speed ?? 0,
    windDeg: data.wind?.deg ?? 0,
    clouds: data.clouds?.all ?? 0,
  };
}
