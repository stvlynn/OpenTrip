# Street view

Street view is a provider-neutral application capability. Agent tools, HTTP
DTOs, generated UI, itinerary notes, and map interactions use opaque image ids
and never expose Mapillary-specific URLs or tokens. Mapillary is the first
driven adapter under `infrastructure/street-view/mapillary`.

## Architecture

- `domain/street-view` defines `StreetViewProvider` and normalized contracts.
- `application/street-view` validates inputs, clamps search policy, sorts by
  distance, and emits trip-scoped same-origin preview URLs.
- the Mapillary adapter owns Graph API requests, thumbnail URLs, response
  parsing, timeouts, and the 2 MiB JPEG/PNG/WebP preview boundary.
- HTTP routes assert trip membership before returning any data.
- the web keeps MapillaryJS behind the page-private viewer and calls
  `viewer.remove()` on image changes and unmount.

## HTTP

```text
GET /api/trips/:tripId/street-view/images?lat=&lng=&radiusMeters=&limit=
GET /api/trips/:tripId/street-view/images/:imageId
GET /api/trips/:tripId/street-view/images/:imageId/preview
GET /api/trips/:tripId/street-view/viewer-config
```

Search defaults to 100 m and five images. Radius is capped at 1 km and results
at ten. Preview responses are private-cacheable for 15 minutes.

## Agent tools and image input

`streetViewSearch` returns compact platform-neutral JSON. When
`AI_IMAGE_INPUT_ENABLED=true`, `streetViewInspect` is also registered. Its
`execute` result remains JSON for persistence and UI; async AI SDK
`toModelOutput` reads one trusted preview and supplies metadata text plus binary
image bytes to the current model turn. No provider URL, token, or base64 is
stored in tool output.

Image tool results are experimental in AI SDK 7 and should be enabled only for
a verified model/provider combination. Search, static cards, notes, and the
interactive viewer do not require model image input.

`appendStopNote` is a generic approval-gated write op. It appends inside the
Trip aggregate so the agent cannot overwrite note content omitted by the
2,000-character prompt-context limit.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `STREET_VIEW_PROVIDER` | `mapillary`; unset disables street view | unset |
| `MAPILLARY_ACCESS_TOKEN` | provider token, secret | — |
| `STREET_VIEW_TIMEOUT_MS` | Graph/preview timeout | `12000` |
| `AI_IMAGE_INPUT_ENABLED` | register visual inspection tool | `false` |

