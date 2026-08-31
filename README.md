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

## Account sync (optional, free)
Characters normally live only in each device's own storage. Account sync adds the missing bridge: register once (email + password, behind the passphrase gate), sign in on any device, and every character, homebrew entry, and sourcebook preference stays **live** across all of them — an HP scratch on the desktop shows on the phone the same second. Signed out (or with sync unconfigured), the app is exactly what it always was: fully local, no network calls, and the sync code isn't even in the bundle.

The backend is a single Cloudflare Worker (`worker/`) with one Durable Object per account — everything on Cloudflare's **free plan** (SQLite-backed Durable Objects; idle connections hibernate and cost nothing). One-time setup:

```
cd worker && npx wrangler deploy
```

Wrangler opens a browser to authorize your Cloudflare account, then prints the Worker URL (`https://ledger-sync.<your-subdomain>.workers.dev`). Paste it into `src/sync-config.js` and push — the account UI appears in the tools drawer (⋯) on the next deploy. Pushes that touch `worker/` also auto-redeploy the Worker if a `CLOUDFLARE_API_TOKEN` repo secret exists (see `.github/workflows/deploy-worker.yml`); otherwise just rerun the command above after editing the worker.

Worth knowing:
- **Passwords never travel**: the device derives a key (PBKDF2, 600k rounds — the gate's own recipe) and the server stores only a salted hash of that. Registration also requires the app's gate passphrase, so strangers who find the URL can't create accounts.
- **Offline play**: edits made without signal wait in a local outbox and ride up when the connection returns; conflicts resolve last-writer-wins per character.
- **Signing in merges**: characters already on the device join the account rather than being replaced; signing out leaves the device's copy in place.
- **Lost password**: there's no reset email at $0 — the keeper clears the account's credentials (data survives) with the `/reset` call documented at the top of `worker/worker.js`, and the player registers again with the same email.
- Portraits over ~90KB are re-shrunk through the same 220px canvas as the upload path before they sync.

## Share a sheet with your DM
Every character sheet has a share button (top right, next to the **?**). It seals a **read-only snapshot** of that character into a link — the character data itself rides in the URL fragment (compressed, base64url), so there's no server and nothing is uploaded anywhere. Any homebrew the character references (gear, spells, subclass, rules text) travels along inside the link.

Whoever opens the link sees just that one character, pixel-identical to your sheet, **without needing the passphrase** — the fragment never even reaches GitHub's servers, and the gate stays shut on everything else. The shared page is truly read-only: every tracker is frozen (no HP, slots, rests, effects, or gear can change), though dice still roll and rules text still opens on a long-press, for use at the table. The link is frozen at the moment you shared it — share again after leveling up for a fresh one.

The share sheet also paints a **character card** (name, class sigil, level, HP, AC — and the portrait, which never rides in the link itself) and attaches it as an image when you share from the tray, so the recipient sees the character, not a favicon. The link's own unfurl preview is necessarily the same for every character — messengers build previews without running JavaScript and never see the `#fragment`, so a static host cannot vary it — which is why the app serves a branded banner there (`public/share-banner.jpg`, baked once; `og:` tags in `index.html` point at the deployed Pages URL) and puts the per-character pixels in the attached card instead.

## Install on iPhone
Open the Pages URL in **Safari** → Share → **Add to Home Screen**. Runs fullscreen, works offline. Characters live in the phone's localStorage — use **Export ledger** for backups before clearing Safari data.

## Update from Claude Code
The entire app is `src/App.jsx`. Edit, then:
```
git add -A && git commit -m "update" && git push
```
Pages redeploys in ~1 minute. Force-quit and reopen the app on the phone to pull the new build (network-first service worker fetches fresh assets automatically when online).
