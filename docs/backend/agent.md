# Trip agent

The non-intrusive AI companion described in
[../decisions/0005-trip-agent.md](../decisions/0005-trip-agent.md). One shared
session per trip; every member talks in the same timeline, and the agent stays
quiet unless asked or a change carries a material planning risk.

## Session model

- `agent_messages` is the single timeline per trip: member chat, `@agent`
  mentions, operation events (`source = operation`), and agent replies.
- `agent_suggestions` stores AI-proposed patches with `status`
  (`pending | applied | stale | expired`), the model's `severity`/`confidence`/
  `reason`, and the `trip_version` the patch was computed against.
- `agent_suggestion_dismissals` hides a suggestion's toast per user; the shared
  record and other members' toasts are unaffected.
- `trips.version` is bumped by every persisted mutation
  (`PgTripRepository`), so an apply can detect that a patch went stale.

## Triggers

| Trigger | Path | Behavior |
| --- | --- | --- |
| Explicit chat with `@agent` | `POST …/agent/chat` | Streams a reply (AI SDK UI message stream); user and assistant messages persist to the shared session |
| Plain member message | `POST …/agent/messages` | Persists only. When member messages since the last agent reply reach `AI_REPLY_THRESHOLD`, an ambient reply is generated in the background and lands via polling |
| `@agent` in a stop comment | `POST …/stops/:stopId/comments` | Detected server-side; recorded as a mention with the stop as context, answered ambiently |
| Whitelisted write operation | stop insert/update/move, day update/delete/reorder, expense add/update | Recorded as an operation event, then evaluated asynchronously |

## Intervention policy

Operation evaluation uses `generateObject` with a structured
`InterventionDecision` schema (`shouldNotify`, `severity`, `confidence`,
`reason`, `suggestion`, `pendingPatch`, `expiresInMinutes`). The system prompt
restricts notifications to material risks: impossible timing, duplicate or
conflicting stops, weather/season conflicts, avoidable backtracking, and
inconsistent budget entries.

- `shouldNotify && confidence >= AI_PROACTIVE_THRESHOLD && pendingPatch` →
  an assistant message plus a `pending` suggestion; members see a toast via
  polling.
- `shouldNotify` below the threshold → a quiet observation line in the
  timeline, no toast.
- Otherwise → nothing.

`PendingPatch` is a discriminated union limited to operations the Trip
aggregate already supports: `update_stop`, `move_stop`, `update_day`,
`reorder_days`, `update_expense`. The model never gets write tools; chat only
exposes a read-only `checkWeather` tool.

## Applying a suggestion

`applySuggestion` runs entirely through the normal domain path:

1. `loadEditable` — membership + edit permission (viewers get `403`).
2. Reject non-pending (`409`), expired (`409`, marked `expired`), and
   version-mismatched suggestions (`409`, marked `stale`).
3. Claim with `UPDATE … WHERE status = 'pending'` so concurrent applies are
   first-come-first-served.
4. Execute the patch via the Trip aggregate and repository (which bumps
   `trips.version`), then record the apply in the session. The write is
   attributed to the clicking user.

## Architecture

- Domain: `apps/api/src/domain/agent/` — types plus the
  `AgentSessionRepository` and `AgentModel` ports.
- Application: `apps/api/src/application/agent/agent-service.ts` — use cases,
  permission checks mirroring `TripService`, and the apply/conflict rules.
- Infrastructure: `apps/api/src/infrastructure/ai/agent-model.ai-sdk.ts`
  (Vercel AI SDK adapter; OpenAI or any OpenAI-compatible endpoint via
  `AI_BASE_URL`) and
  `apps/api/src/infrastructure/persistence/agent-repository.pg.ts` (raw `pg`).
- Interfaces: agent sub-router in `apps/api/src/interfaces/http/app.ts`;
  routes return `404` when AI is not configured. Post-response work
  (evaluations, ambient replies) uses `executionCtx.waitUntil` on Workers and a
  floating promise on Node.

## Configuration

Set in the root `.env` (see [.env.example](../../.env.example)); the agent is
disabled unless both `AI_MODEL` and `AI_API_KEY` are present.

| Variable | Meaning | Default |
| --- | --- | --- |
| `AI_PROVIDER` | Provider label; also names the OpenAI-compatible provider | `openai` |
| `AI_MODEL` | Model id (required) | — |
| `AI_BASE_URL` | OpenAI-compatible base URL; empty uses the OpenAI API | — |
| `AI_API_KEY` | API key (required) | — |
| `AI_PROACTIVE_THRESHOLD` | Minimum confidence for a proactive suggestion | `0.7` |
| `AI_MAX_TOOL_STEPS` | Tool-step cap per chat generation | `5` |
| `AI_REPLY_THRESHOLD` | Member messages that trigger an ambient reply | `6` |

On Cloudflare, set the same variables as Worker vars/secrets (see
[../operations/cloudflare.md](../operations/cloudflare.md)).

## Frontend

The planner page hosts the panel (see
[../frontend/layers.md](../frontend/layers.md)): a sparkle toggle in the
top-right corner mirroring the left sidebar control, an inset right drawer with
`useChat` + `DefaultChatTransport` for streaming, a 12-second poll of
`GET …/agent/events` shared by all members, and bottom-right intervention
cards with apply / discuss / ignore actions. The collapsed state persists via
`PUT /api/users/preferences/agent-panel`.
