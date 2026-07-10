# Agent HTTP endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

Shared session model, tools, and intervention policy: [agent.md](../agent.md).

### `GET /api/trips/:tripId/agent/messages`

- **Auth:** session + member; agent enabled  
- **Response:** [`AgentHistoryDto`](./dtos.md#agenthistorydto) — up to ~200 messages plus
  active suggestions (dismissed-for-this-user hidden).

### `POST /api/trips/:tripId/agent/messages`

- **Auth:** session + member; agent enabled  
- **Body:**

```ts
{
  text?: string; // trim, max 4000; optional when files are present
  files?: Array<{
    type: "file";
    mediaType: string;
    url: string; // trip-owned /api/uploads/trips/… URL (not data:)
    filename?: string;
  }>; // max 8
}
```

At least one of `text` (non-empty) or `files` is required. File URLs must belong
to this trip’s managed upload namespace; unsupported MIME types are dropped.

- **Response:** `{ addressed: boolean; message: AgentMessageDto }`
  - `message` — the inserted row (echo the write so clients can `setQueryData`
    without an immediate list GET that may hit a stale Hyperdrive cache).
  - `addressed` — **immediate** flag only:
    - `true` when the text contains an explicit `@agent` mention (ambient reply
      is deferred and will arrive via polling).
    - `false` for every non-mention message, **even when** the server still
      schedules `maybeReplyIfAddressed` in the background. A later model
      judgment may still produce an ambient reply; that outcome is **not**
      reflected in this response. Clients should poll
      `GET …/agent/events` for any reply rather than treating `addressed: false`
      as “no reply will ever come.”

### `POST /api/trips/:tripId/agent/chat`

- **Auth:** session + member; agent enabled  
- **Response:** **streaming** AI SDK UI message stream — **not** the `{ data }`
  envelope. Clients (e.g. Vercel AI SDK `useChat` / `DefaultChatTransport`)
  should consume the stream protocol, not `apiFetch` JSON helpers.  
- **Body:**

```ts
{
  messages?: Array<{
    id?: string;
    role: string;
    parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
      | { type: string; /* AI SDK tool/reasoning passthrough */ }
    >;
  }>;
  message?: { id?: string; role: string; parts: … } | null; // legacy single turn
}
```

Server persists new user text **and file parts** (and finished assistant
messages) using client UIMessage ids for live/history dedupe. Attachment-only
turns are allowed. Tool-approval continuation uses the full `messages` list
with approval parts.

### `GET /api/trips/:tripId/agent/events`

- **Auth:** session + member; agent enabled  
- **Query:** `after` — integer ≥ 0 (default `0`); return messages with
  `seq > after`  
- **Response:** [`AgentEventsDto`](./dtos.md#agenteventsdto)

### `POST …/suggestions/:suggestionId/approve`

- **Auth:** session + member; **apply** requires edit permission  
- **Body** (AI SDK approval shape):

```ts
{ id?: string; approved: boolean; reason?: string } // reason max 500
```

`id` defaults to path `suggestionId`.

- **Response when `approved: true`:** full [`TripDto`](./dtos.md#tripdto-full-trip)
  after patch apply  
- **Response when `approved: false`:** `{ dismissed: true }` (toast hidden for
  this user only)  
- **Errors:** `409` when suggestion not pending / stale / expired; `403` if
  viewer tries to apply

### `POST …/suggestions/:suggestionId/apply`

- Alias: `approved` defaults to `true` if omitted.  
- **Response:** same as approve with `approved: true`.

### `POST …/suggestions/:suggestionId/dismiss`

- Forces `approved: false`.  
- **Response:** `{ dismissed: true }`.

---

Behavior, tools, intervention: [agent.md](../agent.md).

---

[← API index](./README.md) · [Route index](./routes.md) · [DTOs](./dtos.md)
