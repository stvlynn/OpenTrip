import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { fetchWeather, type WeatherData } from "@/shared/api";

export function useWeather(
  lat?: number,
  lng?: number,
  date?: string,
  time?: string,
  enabled = true,
) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "en";
  const canFetch = lat != null && lng != null && date != null && enabled;

  const { data, isLoading, error } = useQuery<WeatherData | null, Error>({
    queryKey: ["weather", lat, lng, date, time, lang],
    queryFn: ({ signal }) =>
      fetchWeather(lat!, lng!, date, time, { signal, lang }),
    enabled: canFetch,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  return { data, isLoading, error };
}
