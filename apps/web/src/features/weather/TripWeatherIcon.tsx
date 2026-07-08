import type { TripSummary } from "@/entities/trip";
import { useWeather } from "./useWeather";
import { WeatherIcon } from "@/shared/ui/weather-icon";

export interface TripWeatherIconProps {
  trip: TripSummary;
  size?: number;
}

export function TripWeatherIcon({ trip, size = 20 }: TripWeatherIconProps) {
  const { data: weather } = useWeather(trip.location?.lat, trip.location?.lng);
  return <WeatherIcon data={weather} size={size} />;
}
