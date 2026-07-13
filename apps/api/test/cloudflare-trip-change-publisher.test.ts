import { describe, expect, it, vi } from "vitest";
import type { TripChange } from "../src/domain/realtime";
import { CloudflareTripChangePublisher } from "../src/infrastructure/realtime";

const change: TripChange = {
  eventId: "event-1",
  tripId: "trip-1",
  revision: 2,
  actorId: "user-1",
  occurredAt: "2026-07-12T00:00:00.000Z",
  scopes: ["stops"],
};

describe("CloudflareTripChangePublisher", () => {
  it("defers publication and targets the trip Durable Object", async () => {
    const fetch = vi.fn(async (request: Request) => {
      void request;
      return new Response(null);
    });
    const getByName = vi.fn(() => ({ fetch }));
    const tasks: Promise<unknown>[] = [];
    const publisher = new CloudflareTripChangePublisher(
      { getByName },
      "test-realtime-secret-at-least-32-bytes-long",
      (task) => tasks.push(task),
    );

    await publisher.publish(change);
    expect(tasks).toHaveLength(1);
    await Promise.all(tasks);

    expect(getByName).toHaveBeenCalledWith("trip-1");
    const request = fetch.mock.calls[0]![0];
    expect(request.url).toContain("tripId=trip-1");
    expect(request.headers.get("X-OpenTrip-Realtime-Secret")).toBeTruthy();
    await expect(request.json()).resolves.toEqual(change);
  });

  it("retries transient Durable Object failures", async () => {
    const fetch = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null));
    const tasks: Promise<unknown>[] = [];
    const publisher = new CloudflareTripChangePublisher(
      { getByName: () => ({ fetch }) },
      "test-realtime-secret-at-least-32-bytes-long",
      (task) => tasks.push(task),
    );

    await publisher.publish(change);
    await Promise.all(tasks);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
