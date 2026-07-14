import { describe, expect, it, vi } from "vitest";
import type { StreetViewService } from "../src/application/street-view";
import {
  buildStreetViewReadTools,
  StreetViewToolPolicy,
} from "../src/infrastructure/ai/agent-model.ai-sdk";

describe("street-view agent search radius policy", () => {
  it("forces the first search to 100 metres and caps a widened retry at 250", () => {
    const policy = new StreetViewToolPolicy();
    const first = policy.validateSearch({
      lat: 35.6584491,
      lng: 139.745536,
      radiusMeters: 1_000,
    });
    expect(first).toEqual({
      lat: 35.6584491,
      lng: 139.745536,
      radiusMeters: 100,
    });

    policy.recordSearchSuccess(first, {
      outcome: "empty",
      completeness: "complete",
      images: [],
    });
    expect(
      policy.validateSearch({
        lat: 35.6584491,
        lng: 139.745536,
        radiusMeters: 1_000,
      }),
    ).toEqual({
      lat: 35.6584491,
      lng: 139.745536,
      radiusMeters: 250,
    });
  });

  it("passes the enforced first radius to the provider-facing service", async () => {
    const searchNearby = vi.fn(async () => ({
      outcome: "empty" as const,
      completeness: "complete" as const,
      panoramaAvailable: false,
      panoramaCount: 0,
      candidateCount: 0,
      images: [],
    }));
    const service = { searchNearby } as unknown as StreetViewService;
    const tools = buildStreetViewReadTools(service, "trip-radius-policy");
    const search = tools.streetViewSearch as unknown as {
      execute: (input: {
        lat: number;
        lng: number;
        radiusMeters?: number;
      }) => Promise<unknown>;
    };

    await search.execute({
      lat: 35.6584491,
      lng: 139.745536,
      radiusMeters: 1_000,
    });

    expect(searchNearby).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: "trip-radius-policy",
        lat: 35.6584491,
        lng: 139.745536,
        radiusMeters: 100,
      }),
    );
  });
});
