---
title: "Platform endpoints"
---

# Platform endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

### `GET /api/health`

- **Auth:** public  
- **Response:** `{ status: "ok" }`

### `GET /api/uploads/*`

- **Auth:** public  
- **Path:** managed storage key after `/api/uploads/` (e.g. `avatars/…`,
  `trips/…`). Invalid / non-managed path → `400` `invalid_path`.  
- **Response:** raw bytes (not JSON). Headers include `Content-Type`,
  `Cache-Control: public, max-age=31536000, immutable`,
  `X-Content-Type-Options: nosniff`. Missing file → `404`.

### `GET /api/weather`

- **Auth:** session  
- **Query:**

| Param | Required | Meaning |
| --- | --- | --- |
| `lat` | yes | Latitude number |
| `lon` | yes | Longitude number |
| `date` | for useful data | `YYYY-MM-DD`; invalid/missing date yields `null` payload |
| `time` | no | `HH:MM` for hourly preference within horizon |
| `lang` | no | Default `en` |

- **Response:** [`WeatherData`](./dtos.md#weatherdata) or `null`  
- **Errors:** `400` `invalid_coordinates`; `503` `weather_not_configured`;
  `502` provider failures. Details: [weather.md](../weather.md).

### `GET /api/fx/rates`

- **Auth:** session  
- **Query:**

| Param | Required | Meaning |
| --- | --- | --- |
| `base` | yes | ISO 4217 (3 letters) |
| `quotes` | no | Comma-separated quote currencies |
| `date` | no | `YYYY-MM-DD` historical; omit for latest |

- **Response:** [`FxRatesData`](./dtos.md#fxratesdata)  
- **Errors:** `400` `invalid_currency` / `invalid_date`; `502` provider.
  Details: [fx.md](../fx.md).

### `GET /api/agent/status`

- **Auth:** session  
- **Response:** `{ enabled: boolean }` — `true` when AI env is configured.

---

Related: [weather.md](../weather.md) · [fx.md](../fx.md)

---

[← API index](./README.md) · [Route index](./routes.md) · [DTOs](./dtos.md)
