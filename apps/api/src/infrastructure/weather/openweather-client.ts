import { WeatherError } from "../../application/weather/weather-error";
import type { TimelineStep, WeatherClient } from "../../domain/weather/ports";
import type { TimelineResponse } from "./onecall-types";

export class OpenWeatherMapClient implements WeatherClient {
  constructor(private apiKey: string | undefined) {}

  async timeline(
    step: TimelineStep,
    lat: number,
    lon: number,
    start: number,
    lang: string,
    cnt = 10,
  ): Promise<TimelineResponse> {
    if (!this.apiKey) {
      throw new WeatherError(
        "weather_not_configured",
        "OpenWeatherMap API key is not configured",
      );
    }

    const url = new URL(`https://api.openweathermap.org/data/4.0/onecall/timeline/${step}`);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("start", String(start));
    url.searchParams.set("cnt", String(cnt));
    url.searchParams.set("appid", this.apiKey);
    url.searchParams.set("units", "metric");
    url.searchParams.set("lang", lang);

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      const logUrl = new URL(url);
      logUrl.searchParams.delete("appid");
      console.error("[OpenWeatherMap] upstream error", {
        url: logUrl.toString(),
        status: res.status,
        body,
      });
      throw new WeatherError("weather_failed", "Failed to fetch weather");
    }

    return (await res.json()) as TimelineResponse;
  }
}
