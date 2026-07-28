---
title: "Reference: agentic-coding template"
---

# Reference: agentic-coding template

## Source

- Repository: https://github.com/stvlynn/agentic-coding
- Files consulted: `Makefile`, `CLAUDE.md` (the AGENTS.md content), `docs/`
  directory layout.

## Relevant rule

The template is a language- and framework-agnostic scaffold for agent-driven
projects. It prescribes:

- A `Makefile` with `check`, `test`, `lint`, `format`, `docs`, `deploy`, `help`
  targets that delegate to the package manager.
- `CLAUDE.md`/`AGENTS.md` as the entry document, with a documentation map into
  `docs/{project,frontend,backend,operations,quality,decisions}`.
- Frontend guidance = Feature-Sliced Design; backend guidance = Domain-Driven
  Design; imports point downward / inward respectively.
- Forbidden patterns: hardcoded strings, redundant UI copy, duplicated
  implementations, fallback/bypass logic, and assumptions about hidden
  requirements.
- Conventional Commits, and a self-evolution rule (update docs in the same
  change set as the code).
- Planning docs avoid concrete dates and duration estimates; use P0/P1/P2.

## Project decision

- [`Makefile`](../../Makefile) keeps the template targets, delegating to pnpm.
- [`AGENTS.md`](../../AGENTS.md) is the entry doc; `CLAUDE.md` is a symlink to
  it, and `.claude` is a symlink to `.agents`, matching the requested
  `CLAUDE.md -> AGENTS.md` and `.claude -> .agents` convention.
- The `docs/` tree mirrors the template's subdomains and adds `docs/reference/`
  for auditable source tracking.
- `docs:check` (`scripts/docs-check.mjs`) enforces that required docs exist and
  internal links resolve, standing in for the template's `docs:check` target.
