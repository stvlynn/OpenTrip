import { describe, expect, it, vi } from "vitest";
import { StreetViewService } from "../src/application/street-view";
import type { StreetViewProvider } from "../src/domain/street-view";
import { MapillaryStreetViewProvider } from "../src/infrastructure/street-view/mapillary/mapillary-provider";
import { buildStreetViewReadTools } from "../src/infrastructure/ai/agent-model.ai-sdk";

function provider(overrides: Partial<StreetViewProvider> = {}): StreetViewProvider {
  return {
    searchNearby: async () => [],
    getImage: async () => null,
    readPreview: async () => ({ bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" }),
    getViewerConfig: () => ({ provider: "test", accessToken: "token" }),
    ...overrides,
  };
}

describe("StreetViewService", () => {
  it("sorts by distance and creates trip-scoped preview URLs", async () => {
    const service = new StreetViewService(
      provider({
        searchNearby: async () => [
          {
            id: "far",
            coordinate: { lat: 10.001, lng: 20 },
            supports360: false,
            previewSource: "secret-far",
            attribution: { label: "Provider" },
          },
          {
            id: "near",
            coordinate: { lat: 10.0001, lng: 20 },
            supports360: true,
            previewSource: "secret-near",
            attribution: { label: "Provider" },
          },
        ],
      }),
    );
    const result = await service.searchNearby({ tripId: "trip/a", lat: 10, lng: 20 });
    expect(result.map((image) => image.id)).toEqual(["near", "far"]);
    expect(result[0]!.previewUrl).toBe(
      "/api/trips/trip%2Fa/street-view/images/near/preview",
    );
    expect(JSON.stringify(result)).not.toContain("secret-near");
  });
});

describe("MapillaryStreetViewProvider", () => {
  it("normalizes Graph API search data without leaking the token", async () => {
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      void input;
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "42",
              captured_at: 1_700_000_000_000,
              computed_compass_angle: 90,
              computed_geometry: { coordinates: [20, 10] },
              is_pano: true,
              thumb_1024_url: "https://images.example/42.jpg",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const adapter = new MapillaryStreetViewProvider(
      "secret-token",
      5_000,
      fetchMock as unknown as typeof fetch,
    );
    const images = await adapter.searchNearby({ lat: 10, lng: 20, radiusMeters: 100, limit: 1 });
    expect(images[0]).toMatchObject({ id: "42", supports360: true, headingDegrees: 90 });
    const requested = String(fetchMock.mock.calls[0]![0]);
    expect(requested).toContain("bbox=");
    expect(requested).toContain("access_token=secret-token");
    expect(JSON.stringify(images)).not.toContain("secret-token");
  });
});

describe("street-view AI tools", () => {
  it("registers inspect only behind the explicit image-input gate", async () => {
    const service = new StreetViewService(
      provider({
        getImage: async () => ({
          id: "42",
          coordinate: { lat: 10, lng: 20 },
          supports360: true,
          previewSource: "secret-preview-url",
          attribution: { label: "Provider" },
        }),
      }),
    );
    expect(Object.keys(buildStreetViewReadTools(service, "trip", false))).toEqual([
      "streetViewSearch",
    ]);
    const tools = buildStreetViewReadTools(service, "trip", true);
    expect(Object.keys(tools)).toEqual(["streetViewSearch", "streetViewInspect"]);

    const inspect = tools.streetViewInspect as unknown as {
      execute: (input: { imageId: string }) => Promise<{ id: string }>;
      toModelOutput: (input: { output: { id: string } }) => Promise<unknown>;
    };
    const output = await inspect.execute({ imageId: "42" });
    expect(JSON.stringify(output)).not.toContain("secret-preview-url");
    expect(await inspect.toModelOutput({ output })).toMatchObject({
      type: "content",
      value: [
        { type: "text" },
        { type: "file", mediaType: "image/jpeg", data: { type: "data" } },
      ],
    });
  });
});
