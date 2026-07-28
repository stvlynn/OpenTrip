---
title: "Expense endpoints"
---

# Expense endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Expenses

### `POST /api/trips/:id/expenses` / `PATCH /api/trips/:id/expenses/:expenseId`

- **Auth:** session + edit  
- **Body (both):**

| Field | Type | Rules / default |
| --- | --- | --- |
| `description` | string | min 1 |
| `amount` | number | positive (minor units) |
| `currency` | string? | 1–8; default trip currency |
| `category` | `StopCategory`? | default `Plan` |
| `payer` | string | trip-local **member id** |
| `participants` | string[] | min 1 trip-local member ids |

- **Response:** [`TripDto`](./dtos.md#tripdto-full-trip) including recomputed `budget`

Settlement is computed server-side on the full trip; clients should display
`budget.settlements` rather than re-deriving.

---

Budget shape: [Budget DTO](./dtos.md#budget). Display FX: [fx.md](../fx.md).

---

[← API index](./README.md) · [Route index](./routes.md) · [DTOs](./dtos.md)
