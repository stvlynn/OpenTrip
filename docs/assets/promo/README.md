# Promo chapter videos (marketing / README)

Sliced chapters of the OpenTrip marketing film for GitHub README embeds and
landing-page use. **Do not embed these files in fumadocs MDX** — user-guide
demos live under [`../demos/`](../demos/) and are freshly rendered via the
`Docs-*` Remotion compositions.

## Files

| File | Scene |
| --- | --- |
| `01-intro.mp4` | Product overview |
| `02-trips.mp4` | Trips home |
| `03-map.mp4` | Map day filter |
| `04-schedule.mp4` | Schedule board |
| `05-budget.mp4` | Budget / settle-up |
| `06-votes.mp4` | Stop votes |
| `07-agent.mp4` | AI companion |
| `08-travelogue.mp4` | Travelogues |
| `09-close.mp4` | Mobile / PWA |

`manifest.tsv` records chapter frame ranges used when slicing the full film.

## Regenerate (README chapters only)

```bash
cd ../OpenTrip-video/promo
npm i
npx remotion render OpenTripPromo
npm run export:readme-chapters
cp out/readme-chapters/*.mp4 ../../OpenTrip/docs/assets/promo/
```

For **documentation** demos, use `npm run export:docs-demos` instead — see
[`../demos/README.md`](../demos/README.md).
