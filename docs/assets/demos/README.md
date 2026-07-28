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

`manifest.tsv` records byte sizes from the last export.

## Regenerate

From a checkout of OpenTrip-video next to this monorepo:

```bash
cd ../OpenTrip-video/promo
npm i
npm run export:docs-demos
```

Single demo:

```bash
bash scripts/export-docs-demos.sh Docs-Map
# or
bash scripts/export-docs-demos.sh map
```

See `promo/DOCS-DEMOS.md` in OpenTrip-video for scale/CRF overrides and the
composition map.

Then in OpenTrip:

```bash
pnpm --filter @opentrip/docs assets:sync
pnpm docs:check
pnpm --filter @opentrip/docs typecheck
```

Embed with `<DemoVideo src="/assets/demos/….mp4" … />` in MDX.

## Remaining media work

Stills that still need English/recapture (videos do not replace these yet):

- [ ] `screenshots/sign-in.png` — English UI; remove blank field between password and Login
- [ ] `screenshots/product-home.png` — orphan or recrop; index uses `trips.mp4`
- [ ] `screenshots/pwa-reservations.jpg` — amounts look truncated; must recapture
- [ ] `screenshots/pwa-map.jpg` — soft / low quality; re-export at higher quality
- [ ] `screenshots/pwa-budget.jpg` — truncated labels; consider scroll crop showing settle-up
- [ ] Stills or clips for Today, Settings, Account (no Remotion demo yet)
- [ ] Delete or document unused meta shots: `docs-user-guide.png`,
      `docs-perspective-switcher.png`, `docs-mobile-guide.png`
