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

## Install on iPhone
Open the Pages URL in **Safari** → Share → **Add to Home Screen**. Runs fullscreen, works offline. Characters live in the phone's localStorage — use **Export ledger** for backups before clearing Safari data.

## Update from Claude Code
The entire app is `src/App.jsx`. Edit, then:
```
git add -A && git commit -m "update" && git push
```
Pages redeploys in ~1 minute. Force-quit and reopen the app on the phone to pull the new build (network-first service worker fetches fresh assets automatically when online).
