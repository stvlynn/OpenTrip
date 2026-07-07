import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { searchPlaces, type PlaceResult } from "@/shared/api";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function usePlaceSearch(
  query: string,
  biasLat?: number,
  biasLng?: number,
) {
  const { i18n } = useTranslation("planner");
  const lang = i18n.resolvedLanguage ?? "en";
  const debounced = useDebounced(query, 250);
  const enabled = debounced.trim().length >= 2;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["places", debounced, biasLat, biasLng, lang],
    queryFn: ({ signal }) =>
      searchPlaces(debounced, { lat: biasLat, lng: biasLng, lang, signal }),
    enabled,
    staleTime: 60_000,
  });

  return { results, isFetching, enabled };
}

export type { PlaceResult };
