# json-render agent UI implementation plan

**Design:** `2026-07-13-json-render-agent-ui-design.md`

1. Upgrade React, React DOM, and their types; add json-render dependencies and
   a Zod 4 catalog workspace package.
2. Define the bounded component/action catalog and unit-test its schemas.
3. Replace the AI SDK 6-style response helper with the AI SDK 7 stateless UI
   stream, then apply `pipeJsonRender` without losing ids, reasoning, tools,
   approvals, or `onFinish` persistence.
4. Recognize generated UI data parts during persistence and convert persisted
   specs into bounded model context for follow-up turns.
5. Add the planner-private cossUI registry, generated message renderer, error
   boundary, and safe action bridge.
6. Add localized fallback/action copy and focused frontend/backend integration
   tests.
7. Update agent, frontend, and architecture documentation, then run all project
   quality gates and a production Worker bundle check.

