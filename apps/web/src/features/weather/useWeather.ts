import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { fetchWeather, type WeatherData } from "@/shared/api";

export function useWeather(lat?: number, lng?: number, enabled = true) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "en";
  const canFetch = lat != null && lng != null && enabled;

  const { data, isLoading, error } = useQuery<WeatherData, Error>({
    queryKey: ["weather", lat, lng, lang],
    queryFn: ({ signal }) =>
      fetchWeather(lat!, lng!, { signal, lang }),
    enabled: canFetch,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  return { data, isLoading, error };
}
