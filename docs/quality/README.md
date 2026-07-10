# Quality

Reference: [../reference/template-agentic-coding.md](../reference/template-agentic-coding.md).

## Gates

Before considering work done:

```bash
pnpm typecheck   # strict TS across all packages
pnpm lint        # eslint
pnpm test        # vitest (domain + settlement/balances)
pnpm build       # web + api build
pnpm docs:check  # docs structure + link integrity
```

`make check` chains the first four; `make docs` runs `docs:check`.

## Testing strategy

- **Domain first**: pure unit tests for the `Trip` aggregate — vote toggling,
  comment validation, stop insertion ordering, balances, and settlement
  minimality. No DB or HTTP needed.
- **Application**: use cases tested with in-memory repository fakes.
- Transport/persistence are kept thin so most logic is covered by fast unit
  tests.

## Coding standards

- TypeScript strict; no `any` in domain/application. No hardcoded user-facing
  strings (use i18n keys — see [../frontend/i18n.md](../frontend/i18n.md)).
- FSD import direction downward only; slices expose a public `index.ts`.
- DDD: domain has no framework/DB imports; dependencies point inward.
- Transitions name explicit properties; numeric UI uses `tabular-nums`.
- **Write-echo for mutations:** after create/update, `setQueryData` from the
  response; do not rely on an immediate list/detail refetch through Hyperdrive.
  See [../frontend/data-caching.md](../frontend/data-caching.md) and
  [../decisions/0006-mutation-echo-over-refetch.md](../decisions/0006-mutation-echo-over-refetch.md).
  Create → list flows must be checked on Cloudflare, not only `make dev`.

## Documentation rules

- Every directory under `docs/` has a `README.md`.
- `reference/` and `decisions/` READMEs must list their siblings.
- Internal links must resolve — enforced by `scripts/docs-check.mjs`.

## Definition of done

Code + tests + docs updated, all gates green, and any architectural choice
recorded as an ADR in [../decisions/README.md](../decisions/README.md).
