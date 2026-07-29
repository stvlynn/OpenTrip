import { apiFetch } from "./client";

export interface WeatherData {
  /** OpenWeather icon code, e.g. `01d` or `10n`. */
  icon: string;
  main: string;
  description: string;
  /** Temperature in °C. */
  temp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDeg: number;
  clouds: number;
}

/** Weather proxy. Returns null when the requested date is outside the forecast
 * window. */
export function fetchWeather(
  lat: number,
  lng: number,
  date?: string,
): Promise<WeatherData | null> {
  const query = [
    `lat=${encodeURIComponent(String(lat))}`,
    `lon=${encodeURIComponent(String(lng))}`,
    "lang=zh_cn",
    ...(date ? [`date=${encodeURIComponent(date)}`] : []),
  ].join("&");
  return apiFetch<WeatherData | null>(`/api/weather?${query}`);
}
