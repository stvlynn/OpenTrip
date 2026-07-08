import type { TimelineResponse } from "../../infrastructure/weather/onecall-types";

export type TimelineStep = "1h" | "1day";

export interface WeatherClient {
  timeline(
    step: TimelineStep,
    lat: number,
    lon: number,
    start: number,
    lang: string,
    cnt?: number,
  ): Promise<TimelineResponse>;
}
