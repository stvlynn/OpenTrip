# Observability and agent tracing

OpenTrip uses two complementary observability surfaces:

- Cloudflare Workers Logs or Docker stdout contain newline-delimited JSON logs.
- Sentry contains request traces, errors, and AI SDK 7 OpenTelemetry spans.

Sentry is disabled when `SENTRY_DSN` is absent. Observability failures never
disable the API or trip agent.

## Configuration

| Key | Kind | Purpose |
| --- | --- | --- |
| `SENTRY_DSN` | secret | Enables Sentry in the API runtime |
| `SENTRY_AUTH_TOKEN` | CI-only secret | Uploads Worker source maps; never sync to the Worker |
| `SENTRY_ORG` | Actions variable | Sentry organization slug for source-map upload |
| `SENTRY_PROJECT` | Actions variable | Sentry project slug for source-map upload |
| `SENTRY_ENVIRONMENT` | variable | `production`, `staging`, or `development` |
| `SENTRY_RELEASE` | CI-generated variable | Git commit SHA shared by runtime events and source maps |
| `AI_TELEMETRY_RECORD_CONTENT` | variable | Records full textual AI inputs and outputs when `true` |

Production uses 100% Sentry sampling for trip-agent routes, 10% for other API
routes, and 0% for health checks. Cloudflare persists all logs and samples
platform request traces at 10%.

`AI_TELEMETRY_RECORD_CONTENT=true` sends trip conversation text, prompts,
model replies, and tool arguments/results to Sentry. Authorization headers,
cookies, credentials, database URLs, signed URL queries, data URLs, base64,
and attachment bytes are always removed. Limit Sentry project access and set a
retention policy appropriate for travel, reservation, and expense data. Set
the flag to `false` and redeploy to stop content capture immediately.

## Trace model

Every response carries `x-request-id`. A supplied value is retained only when
it matches the safe request-id format; otherwise the API generates a UUID.
Agent executions additionally carry `tripId`, `agentSessionId`, `turnId`,
`messageId`, `suggestionId`, and `toolCallId` when available.

The initiating user UI message id is the stable `turnId`. A later tool-approval
request creates a new HTTP trace but keeps the same `turnId` and AI SDK
`toolCallId`, so it can be found without keeping a span open across user input.

Typical explicit-chat trace:

```text
HTTP request
└── opentrip.agent.chat
    ├── opentrip.agent.persist_message
    ├── ai.generateText / ai.streamText
    │   ├── model inference
    │   └── tool execution
    │       ├── opentrip.provider.*
    │       └── opentrip.trip.operation.apply
    └── opentrip.agent.persist_message
```

Ambient replies, addressed checks, operation evaluations, and suggestion
responses use their own `opentrip.agent.*` parent spans. Deferred work is kept
alive by the Worker execution context and logs the originating request and
turn identifiers. Weather, geo, lodging, street-view, and attachment reads have
explicit child spans beneath their AI tool spans. If the browser disconnects
while the independent SSE drain finishes successfully, the chat span records
`opentrip.agent.client_disconnected=true` without reporting a false failure.

## Debugging workflow

1. Copy `x-request-id` from the failing browser Network response. For agent UI
   failures also copy a message, suggestion, or tool-call id from the payload.
2. Search Sentry Discover using the most specific available attribute:

   ```text
   request.id:<request-id>
   opentrip.agent.turn_id:<turn-id>
   opentrip.agent.message_id:<message-id>
   opentrip.agent.suggestion_id:<suggestion-id>
   opentrip.trip.id:<trip-id>
   gen_ai.tool.call.id:<tool-call-id>
   ```

3. Open the trace waterfall. Inspect authorization/context loading, AI steps,
   inference finish reason and token usage, tool execution, approval, domain
   apply, message persistence, and stream completion in that order.
4. If Sentry has no sampled trace, search Workers Logs for the same identifier.
   For a live reproduction:

   ```bash
   pnpm exec wrangler tail opentrip-api --format json \
     | jq 'select(tostring | contains("<request-or-turn-id>"))'
   ```

5. In Docker, use the same fields:

   ```bash
   docker compose -f deploy/docker/compose.yaml logs -f api \
     | jq -R 'fromjson? | select(tostring | contains("<request-or-turn-id>"))'
   ```

6. Cross-check persisted state without selecting message contents unnecessarily:

   ```sql
   SELECT id, trip_id, role, source, trip_version, created_at
   FROM agent_messages
   WHERE id = '<message-id>';

   SELECT id, trip_id, message_id, status, trip_version, created_at, updated_at
   FROM agent_suggestions
   WHERE id = '<suggestion-id>';
   ```

   Compare the persisted `trip_version` with the mutation span's before/after
   versions to distinguish stale reads, concurrent claims, and failed writes.

## Symptom guide

| Symptom | First evidence to inspect |
| --- | --- |
| Stream appeared but assistant row vanished | `agent.stream.complete`, then `agent.persist_message` |
| Tool succeeded but planner rolled back | `opentrip.trip.operation.apply`, version attributes, mutation echo |
| Approval did not execute | Search both HTTP traces by `turnId` and `gen_ai.tool.call.id` |
| Proactive suggestion is missing | Evaluation decision, confidence threshold, allowed operation, `agent.suggestion.created` |
| Browser reports CORS after a Worker failure | `worker.fetch_failed`, deferred completion, pool disposal; check for Cloudflare 1101 |
| Provider returned 429/5xx | Inference span, provider metadata, finish reason, retry events |

## Log event reference

All application logs are one-line JSON with `timestamp`, `level`, `event`, and
available correlation ids. Important events include:

- `http.request.completed`
- `agent.persist_message`
- `agent.stream.complete`
- `agent.suggestion.created`
- `agent.addressed_check_failed`
- `agent.ambient_reply_failed`
- `agent.operation_evaluation_failed`
- `agent.deferred_task_failed`
- `worker.fetch_failed`
- `worker.pool_dispose_failed`

Do not paste full Sentry events into public issues. Share the trace or event id
with an authorized project member instead.
