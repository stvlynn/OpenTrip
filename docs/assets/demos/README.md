# Docs demo videos

Fresh Remotion renders for the fumadocs user guide — scripted macOS-style
cursor over real captures and token-faithful UI recreations.

These files are **not** copies of `docs/assets/promo/` marketing chapters.
They are produced by the sibling project
[`OpenTrip-video`](https://github.com/stvlynn/OpenTrip-video) via the
`Docs-*` compositions and `npm run export:docs-demos`.

## Files

| File | Composition | Primary docs pages |
| --- | --- | --- |
| `trips.mp4` | `Docs-Trips` | `index`, `getting-started`, `first-trip` |
| `invite.mp4` | `Docs-Invite` | `collaborate`, `first-trip` |
| `map.mp4` | `Docs-Map` | `plan-a-trip`, `map-and-places` |
| `schedule.mp4` | `Docs-Schedule` | `plan-a-trip`, `first-trip` |
| `budget.mp4` | `Docs-Budget` | `expenses` |
| `votes.mp4` | `Docs-Votes` | `collaborate` |
| `agent.mp4` | `Docs-Agent` | `ai-companion` |
| `travelogue.mp4` | `Docs-Travelogue` | `travelogues` |
| `pwa.mp4` | `Docs-PWA` | `wechat-and-mobile` |
| `reservations.mp4` | `Docs-Reservations` | `manage-reservations`, `first-trip` |
| `today.mp4` | `Docs-Today` | `today-and-weather` |
| `settings.mp4` | `Docs-Settings` | `settings-and-preferences` |
| `account.mp4` | `Docs-Account` | `account-and-security` |
| `signin.mp4` | `Docs-SignIn` | `getting-started`, `first-trip` |
| `reservations-pwa.mp4` | `Docs-ReservationsPwa` | `manage-reservations` |
| `agent-pwa.mp4` | `Docs-AgentPwa` | `ai-companion` |

`manifest.tsv` records byte sizes from the last export.

## Regenerate

```bash
cd ../OpenTrip-video/promo
npm i
npm run export:docs-demos
```

Single demo: `bash scripts/export-docs-demos.sh Docs-ReservationsPwa`

See OpenTrip-video `promo/DOCS-DEMOS.md` for still-export commands
(`sign-in.png`, `pwa-reservations.jpg`, `pwa-agent.jpg`).

Then in OpenTrip:

```bash
pnpm --filter @opentrip/docs assets:sync
pnpm docs:check
pnpm --filter @opentrip/docs typecheck
```

## Screenshot notes

| Asset | Status |
| --- | --- |
| `sign-in.png` | English Remotion still from `Docs-SignIn` (recreation, not live capture) |
| `pwa-reservations.jpg` | Remotion still from `Docs-ReservationsPwa` — full prices visible |
| `pwa-agent.jpg` | Remotion still from `Docs-AgentPwa` |
| `pwa-map/budget/schedule/trips.jpg` | Re-exported from OpenTrip-video hi-res captures |
| Live device captures | Still preferred for README marketing grids when UI drifts |

`roles-and-permissions.mdx` is reference-only (no demo).
