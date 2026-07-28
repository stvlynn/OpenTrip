---
title: "Invite endpoints"
---

# Invite endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Invites

### `POST /api/trips/:id/invites`

- **Auth:** session + `canInvite`  
- **Status:** `201`  
- **Body:**

| Field | Type | Rules |
| --- | --- | --- |
| `accessScope` | `"anyone" \| "restricted_emails"` | |
| `allowedEmails` | string[]? | emails; required non-empty when restricted; max 50 |
| `role` | `"editor" \| "viewer"` | role granted on accept |
| `canInvite` | boolean? | default `false` — whether invitee may invite others |
| `expiresAt` | string \| null? | ISO datetime or null (no expiry); default null |
| `previousToken` | string? | if set, create then revoke that prior link (regenerate) |

- **Response:**

```ts
{ url: string; token: string; expiresAt: string | null }
```

`url` is `{Origin}/invite/{token}` (request `Origin` or first trusted origin).
**Token is returned once**; only a hash is stored.

### `GET /api/trip-invites/:token`

- **Auth:** public (optional session improves `alreadyMember` / email checks)  
- **Response:** [`InvitePreview`](./dtos.md#invitepreview)

### `POST /api/trip-invites/:token/accept`

- **Auth:** session  
- **Response:** `{ trip: TripDto; joined: boolean }` — the fresh Trip mutation
  echo lets the client populate detail/list caches before navigation;
  `joined: false` if already a member (idempotent).
- **Errors:** domain `invite_*` codes when expired/revoked/email restricted.

---

[← API index](./README.md) · [Route index](./routes.md) · [DTOs](./dtos.md)
