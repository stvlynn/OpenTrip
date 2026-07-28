---
title: "Lodging (Airbnb)"
---

# Lodging (Airbnb)

Internal vacation-rental search used by the trip agent. Logic is adapted from
[openbnb-org/mcp-server-airbnb](https://github.com/openbnb-org/mcp-server-airbnb)
(MIT) as an **in-process** provider — no MCP transport, no remote
`mcp.openbnb.ai` OAuth.

## Entry points

| Consumer | Tool | Notes |
| --- | --- | --- |
| Agent | `airbnbSearch` | Location + optional dates/guests/price/property type |
| Agent | `airbnbListingDetails` | Amenities, rules, description for a listing id |

Both tools are read-only and skip `toolApproval`. Adding a stay to the itinerary
still goes through `insertStop` (trip ops registry) and member approval.
See [agent.md](./agent.md).

There is no public HTTP route for lodging yet.

## Layering

```
Agent read tools
        → LodgingService (application) → stable DTOs
                → LodgingProvider (domain port)
                        → AirbnbLodgingProvider
```

- **Domain** (`domain/lodging`) — `LodgingSearchQuery`, `LodgingListingSummary`,
  `LodgingListingDetail`, and the `LodgingProvider` port (`search`,
  `listingDetails`).
- **Application** — validates dates, guests, and price ranges; maps port
  results to DTOs; raises `DomainError` for bad input and `LodgingError` for
  upstream/parse failures.
- **Infrastructure** — fetches Airbnb HTML with a browser User-Agent, extracts
  the `#data-deferred-state-0` JSON (regex, no cheerio), and picks a compact
  schema. Non-US locations are geocoded via Photon with Nominatim fallback so
  Airbnb receives a bounding box (same approach as openbnb).

## Robots and geocoding

- **robots.txt** — respected by default for the browser User-Agent used against
  Airbnb. Set `LODGING_IGNORE_ROBOTS_TXT=true` only for local testing.
- **Geocoding** — Photon → Nominatim when `placeId` is absent. Set
  `LODGING_DISABLE_GEOCODING=true` to skip third-party geocoders and pass the
  raw location string to Airbnb (worse for many non-US queries).

## Configuration

See `.env.example`:

| Variable | Default | Notes |
| --- | --- | --- |
| `LODGING_IGNORE_ROBOTS_TXT` | `false` | Testing only |
| `LODGING_DISABLE_GEOCODING` | `false` | Skip Photon/Nominatim |
| `LODGING_TIMEOUT_MS` | `30000` | Airbnb HTML fetch timeout |
| `LODGING_GEOCODE_USER_AGENT` | OpenTrip identifying UA | Photon/Nominatim only |

## Errors

| Code | Meaning |
| --- | --- |
| `lodging_robots_blocked` | Path disallowed by Airbnb robots.txt |
| `lodging_timeout` | Upstream timed out |
| `lodging_upstream` | Non-2xx or network failure |
| `lodging_parse_failed` | Embedded JSON missing or schema changed |

## Attribution

Airbnb scrape/parse helpers follow
[openbnb-org/mcp-server-airbnb](https://github.com/openbnb-org/mcp-server-airbnb)
under the MIT license. OpenTrip is not affiliated with Airbnb or OpenBnB.
