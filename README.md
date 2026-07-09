# The Adventurer's Ledger

5e SRD character forge — full multiclass rules, Mystic Arcanum, pact magic, live play tracking (HP / slots / rests), homebrew forge with FightClub5 XML import, export/import backups.

## Run locally
```
npm install
npm run dev
```

## Deploy (GitHub Pages)
Every `git push` to `main` rebuilds and redeploys automatically via `.github/workflows/deploy.yml` (the workflow auto-enables Pages on first run — no Settings step needed). Site: https://jordandav-is.github.io/adventurer-app/

Note: building Pages from a **private** repo requires a paid GitHub plan (Pro). If the deploy workflow fails with a Pages/plan error, either upgrade or make the repo public — the passphrase gate keeps the app itself locked either way.

## Access control
The Pages URL is technically reachable by anyone (GitHub only offers truly private Pages on Enterprise Cloud), so the app is wrapped in a passphrase gate (`src/gate.jsx`): visitors see only a locked door until they enter the passphrase. Unlocking is remembered per device. Only a salted SHA-256 hash lives in the repo (`src/gate-config.js`) — instructions for changing the passphrase are in that file. Characters are stored in each device's own localStorage, so even someone past the gate sees only their own empty ledger, never your data.

## Share a sheet with your DM
Every character sheet has a share button (top right, next to the **?**). It seals a **read-only snapshot** of that character into a link — the character data itself rides in the URL fragment (compressed, base64url), so there's no server and nothing is uploaded anywhere. Any homebrew the character references (gear, spells, subclass, rules text) travels along inside the link.

Whoever opens the link sees just that one character, pixel-identical to your sheet, **without needing the passphrase** — the fragment never even reaches GitHub's servers, and the gate stays shut on everything else. Dice and trackers work on the shared page for use at the table, but changes live only on the viewer's screen: your ledger is untouchable from there, and the link is frozen at the moment you shared it (share again after leveling up for a fresh one).

## Install on iPhone
Open the Pages URL in **Safari** → Share → **Add to Home Screen**. Runs fullscreen, works offline. Characters live in the phone's localStorage — use **Export ledger** for backups before clearing Safari data.

## Update from Claude Code
The entire app is `src/App.jsx`. Edit, then:
```
git add -A && git commit -m "update" && git push
```
Pages redeploys in ~1 minute. Force-quit and reopen the app on the phone to pull the new build (network-first service worker fetches fresh assets automatically when online).
