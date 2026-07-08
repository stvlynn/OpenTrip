import { dayRepresentativeStop, dayIsoDate, type Trip } from "@/entities/trip";
import { useWeather } from "./useWeather";
import { WeatherIcon } from "@/shared/ui/weather-icon";

export interface DayWeatherIconProps {
  trip: Trip;
  dayNumber: number;
  size?: number;
}

export function DayWeatherIcon({ trip, dayNumber, size = 18 }: DayWeatherIconProps) {
  const stop = dayRepresentativeStop(trip, dayNumber);
  const date = dayIsoDate(trip, dayNumber);
  const { data: weather } = useWeather(stop?.lat, stop?.lng, date ?? undefined);
  return <WeatherIcon data={weather} size={size} />;
}
