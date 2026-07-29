/** Shared React Query keys so mutation echoes update every reader. */
export const queryKeys = {
  trips: ["trips"] as const,
  trip: (tripId: string) => ["trip", tripId] as const,
  reservations: (tripId: string) => ["reservations", tripId] as const,
  agentStatus: ["agent-status"] as const,
  agentMessages: (tripId: string) => ["agent-messages", tripId] as const,
  weather: (lat: number, lng: number, date: string) =>
    ["weather", lat, lng, date] as const,
  fxRates: (base: string, quotes: readonly string[]) =>
    ["fx-rates", base, [...quotes].sort().join(",")] as const,
  invitePreview: (token: string) => ["invite-preview", token] as const,
};
