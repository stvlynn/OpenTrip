import { describe, expect, it } from "vitest";
import {
  buildQueryBody,
  filtersOf,
  parseArgs,
  timeframeOf,
} from "./cloudflare-logs";

describe("Cloudflare logs CLI", () => {
  it("builds composable field filters", () => {
    const options = parseArgs([
      "--turn-id",
      "turn-1",
      "--trip-id",
      "trip-1",
      "--limit",
      "25",
    ]);
    expect(filtersOf(options, "sha256:abc")).toEqual([
      expect.objectContaining({ key: "$metadata.service", value: "opentrip-api" }),
      expect.objectContaining({ key: "turnId", value: "turn-1" }),
      expect.objectContaining({ key: "tripId", value: "trip-1" }),
      expect.objectContaining({ key: "messageFingerprint", value: "sha256:abc" }),
    ]);
  });

  it("uses cursor pagination and full-text needle in API requests", () => {
    const body = buildQueryBody({
      timeframe: { from: 1, to: 2 },
      filters: [],
      contains: "request-1",
      limit: 100,
      offset: "cursor",
    });
    expect(body).toMatchObject({
      dry: true,
      view: "events",
      offset: "cursor",
      offsetDirection: "next",
      parameters: {
        datasets: ["cloudflare-workers"],
        needle: { value: "request-1", isRegex: false, matchCase: false },
      },
    });
  });

  it("parses relative query windows", () => {
    expect(timeframeOf(parseArgs(["--since", "2h"]), 10_000_000)).toEqual({
      from: 2_800_000,
      to: 10_000_000,
    });
  });
});
