# Itinerary endpoints (days, stops, media)

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Days

### `POST /api/trips/:id/days`

- **Auth:** session + edit  
- **Status:** `201`  
- **Body:** none  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip) with new empty day appended.

### `PATCH /api/trips/:id/days/:day`

- **Auth:** session + edit  
- **Path:** `:day` — positive integer day number (coerced from string)  
- **Body:** at least one of:

| Field | Type | Rules |
| --- | --- | --- |
| `date` | string? | `YYYY-MM-DD` or `""` |
| `dateLabel` | string? | max 40 (legacy) |
| `city` | string? | max 80 |
| `color` | string? | `#` + 6 hex digits |

- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip)

### `PUT /api/trips/:id/days/order`

- **Auth:** session + edit  
- **Body:** `{ order: number[] }` — permutation of current day numbers
  (positive ints, min length 1). Days renumber to `1..N` by new position;
  city/label/stops travel with the day; date and color recompute from position.  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip)

### `DELETE /api/trips/:id/days/:day`

- **Auth:** session + edit  
- **Path:** `:day` — positive integer day number  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip) after deletion and renumbering.

**Date convention:** trip `startDate` and each day `date` are ISO
`YYYY-MM-DD` or `""`. New trips set day 1 from today; appended days use
`startDate + (day.number - 1)`. Because dates are positional, reordering
resequences dates. Clients localize ISO values for display. `dateLabel` is
legacy fallback only.

---

## Stops

### `POST /api/trips/:id/stops`

- **Auth:** session + edit  
- **Body:**

| Field | Type | Rules / default |
| --- | --- | --- |
| `day` | number | positive int |
| `index` | number | ≥ 0 within day |
| `name` | string | min 1 |
| `time` | string | display time |
| `duration` | string? | max 20; default `1h` |
| `lat` / `lng` | number? | if both provided, used verbatim; else interpolated |
| `area` | string? | max 120 |
| `category` | `StopCategory`? | default `Plan` |
| `cost` | number? | 0…1e8; per-person estimate |
| `costCurrency` | string? | 1–8; default trip currency when cost set |
| `note` | string? | max 20_000 Markdown; may embed hosted image URLs |

- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip)

### `PATCH /api/trips/:id/stops/:stopId`

- **Auth:** session + edit  
- **Body:** partial of `name`, `time`, `duration`, `area`, `category`, `cost`,
  `costCurrency`, `note` — **at least one** field. Same limits as insert.
  `cost` of `0` clears cost currency. **Position** changes use the position
  endpoint, not this one.  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip)

### `PUT /api/trips/:id/stops/:stopId/position`

- **Auth:** session + edit  
- **Body:** `{ day: number, index: number }` — target day and zero-based index
  within that day’s stops after removal.  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip)

### `POST /api/trips/:id/stops/:stopId/vote`

- **Auth:** session + **edit** (`TripService` uses `loadEditable`; viewers get
  `403` `insufficient_permissions`)  
- **Body:** none  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip) (votes toggled for acting member)

### `POST /api/trips/:id/stops/:stopId/comments`

- **Auth:** session + **edit** (`loadEditable`; viewers `403`)  
- **Body:** `{ text: string }` (min 1)  
- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip)  
- **Side effect:** when the agent is enabled, comments that `@mention` trip
  members and/or `@agent` are mirrored into the shared agent session (with the
  stop as context). Member mentions use the same toast path as agent chat;
  ambient agent reply runs only when `@agent` is present (see
  [agent.md](../agent.md)).

### `POST /api/trips/:id/media`

- **Auth:** session + edit  
- **Status:** `201`  
- **Body:** `multipart/form-data`, field name **`file`**  
- **Constraints:** PNG / JPEG / WebP / PDF / plain text (markdown, csv); max **2 MiB** decoded payload  
  (agent chat attachments use the same endpoint) 
- **Response:** `{ url: string }` — absolute or path URL under `/api/uploads/trips/…`  
- **Errors:** `400` `media_missing` / `media_unsupported_mime`; `413`
  `media_too_large`

---

Related: [trip-ops.md](../trip-ops.md) · [agent.md](../agent.md) (comment @mentions)

---

[← API index](./README.md) · [Route index](./routes.md) · [DTOs](./dtos.md)
