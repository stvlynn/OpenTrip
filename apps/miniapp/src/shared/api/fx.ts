import { apiFetch } from "./client";

export interface FxRatesData {
  date: string;
  base: string;
  provider: string;
  /** Quote currency → units of quote per 1 base. Includes `base: 1`. */
  rates: Record<string, number>;
  fetchedAt: string;
}

export function fetchFxRates(
  base: string,
  quotes: readonly string[],
): Promise<FxRatesData> {
  const query = [
    `base=${encodeURIComponent(base)}`,
    ...(quotes.length > 0 ? [`quotes=${encodeURIComponent(quotes.join(","))}`] : []),
  ].join("&");
  return apiFetch<FxRatesData>(`/api/fx/rates?${query}`);
}
