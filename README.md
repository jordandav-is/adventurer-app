# The Adventurer's Ledger

5e SRD character sheet and ledger application supporting multiclassing, spellcasting, inventory, live play tracking (HP, spell slots, rests), homebrew forge with FightClub5 XML import, and JSON backup export/import. Browser storage uses IndexedDB with a localStorage fallback.

## Local development

### Web application
```sh
npm ci
npm run dev
```

### Sync Worker (optional)
```sh
cd worker
npm ci
npm run dev
```

## Access control

The deployed web application is protected by a client-side passphrase gate (`src/gate.jsx`). It computes a PBKDF2-SHA256 hash (600,000 iterations) from the entered passphrase and checks it against public parameters in `src/gate-config.js`.

The gate is a client-side filter for static hosting, not cryptographic backend authorization. Local character data remains in the browser (IndexedDB with localStorage fallback), so unauthenticated visitors see only their own empty local state. During account registration, the raw passphrase is submitted over TLS and verified server-side using the committed gate parameters.

## Account sync architecture

Account sync is optional. When unconfigured or signed out, the application operates strictly locally with zero background network requests.

When configured, sync runs on a Cloudflare Worker backed by SQLite Durable Objects:
- **Identity singleton DO**: Maps normalized email addresses to random opaque account UUIDs and coordinates idempotent registration lifecycles.
- **Account DO**: One Durable Object per random account UUID. Manages character data, live WebSocket connections, session token digests, password credentials, and single-use WebSocket connection tickets.
- **Offline support and conflict resolution**: Local changes queue in an offline outbox and sync over WebSocket upon reconnecting. Conflicts resolve using server-authoritative last-write-wins (LWW, where stored records win when `incoming.ts <= stored.ts`) with permanent tombstones for deletions.

## Authentication and credentials

- **Email/password registration**: Account registration (`/register`) requires an email, password, the ledger gate passphrase, and a client-generated registration ID. The Worker validates input lengths, verifies the raw passphrase server-side against committed gate parameters (the public gate hash is never accepted as an authorization bearer), idempotently provisions the account via the Identity singleton, and returns a 256-bit single-use recovery key.
- **Unverified login identifier and user-held recovery keys**: Email serves solely as an unverified login identifier to namespace accounts. There is deliberately no email verification, transactional email provider, or administrative backdoor. Instead, users are issued a cryptographically random, 256-bit one-time recovery key upon account creation (`/register`). Stored on the server strictly as a SHA-256 digest, this key allows resetting forgotten passwords (`/recover`) without relying on an external email service.
- **Password reset and key rotation**: Account recovery (`/recover`) verifies the recovery key against its stored hash, updates the password, revokes all existing sessions, tickets, and active WebSockets, and automatically issues a fresh replacement recovery key. Signed-in users can also update their password (`/password`) or rotate their recovery key (`/recovery-key`) with their current password. Losing both password and recovery key makes the synchronized account unrecoverable.
- **Password storage and verification**: Passwords cross TLS to the Worker and are stored exclusively on the Account DO as versioned PBKDF2-SHA256 hashes with random 16-byte salts and 600,000 iterations. Derivation is computed via the exact-pinned, independently audited, zero-runtime-dependency `@noble/hashes` implementation inside Account Durable Objects (deployed workerd caps native WebCrypto PBKDF2 at 100,000 iterations, while Durable Objects provide the 30-second CPU budget). Passwords and plaintext recovery keys are never stored client-side. To prevent user enumeration and timing attacks, failed logins and invalid recovery attempts perform uniform KDF work and return a fixed delay and response. Correct credentials always succeed with no account lockout.
- **Sessions and tickets**: Authentication tokens and tickets are stored as SHA-256 digests only. Sessions expire after 7 days (absolute) or 24 hours of inactivity, capped at 10 concurrent sessions per account. WebSocket connections use short-lived (60-second), single-use tickets (`/ws-ticket`), keeping authorization tokens out of WebSocket URLs.

## Deployment and configuration

### 1. Cloudflare API Token
Create a Cloudflare API token with the permission:
- `Account` → `Workers Scripts` → `Edit`

### 2. GitHub Actions configuration
Configure repository variables and secrets for GitHub Actions workflows (`.github/workflows/deploy.yml` and `.github/workflows/deploy-worker.yml`). Both workflows fail immediately if required configuration is missing.

Set variables:
```sh
gh variable set SYNC_URL --body "https://ledger-sync.<your-subdomain>.workers.dev"
gh variable set CLOUDFLARE_ACCOUNT_ID --body "<cloudflare-account-id>"
```

Set secret (paste token at the prompt to avoid recording secrets in shell history):
```sh
gh secret set CLOUDFLARE_API_TOKEN
```

### 3. R2 bucket for portraits
Create the bucket the Worker binds as `ASSETS` (see `worker/wrangler.toml`), and grant the API token `Account` → `Workers R2 Storage` → `Edit`:
```sh
cd worker && npx wrangler r2 bucket create ledger-assets
```

### 4. Continuous deployment
- **GitHub Pages**: Pushes to `main` install dependencies via `npm ci`, validate `SYNC_URL`, build with Node 24, and deploy `dist/` via `deploy.yml`. Site: https://jordandav-is.github.io/adventurer-app/
- **Worker**: Pushes modifying `worker/**` install dependencies via `npm ci`, run tests, validate `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, and deploy via `deploy-worker.yml` using `npm run deploy`.

## Portraits

A portrait is imported once at up to 2048px, hashed (SHA-256), and kept as a content-addressed Blob in IndexedDB. The character record stores only `portrait: { id, w, h, x, y, z }` (asset hash, pixel size, and a framing: normalized centre plus zoom) alongside `photo`, a 220px thumb rendered from that framing. Tapping a portrait opens the framing editor (drag, pinch, or slide to zoom). Roster, share cards, and exports use the thumb, so they never need the original.

When an account is signed in, originals upload to R2 through the Worker (`PUT /asset/<sha256>?account=<id>` with a `Bearer` session token) and other devices fetch them lazily (`GET`) the first time a sheet needs full resolution. Objects live under `<account>/<sha256>`, are verified against their digest on upload, and are immutable. Without R2 configured the Worker answers 503 and the app simply keeps originals device-local, with thumbs still syncing.

### Conjuring a portrait

From a signed-in sheet, the portrait menu offers **Conjure one from your sheet**. The player adds a short description; the app sends it with a compact brief (ancestry, classes, features, persona, notes) to the Worker's `/conjure` route. Gemini 3.8 Flash turns the brief into an art prompt under a fixed WotC-style prompt frame, Gemini 3.1 Flash Image paints four candidates, and the player frames the one they like, which then flows through the ordinary portrait asset path. Rounds are metered: 4 per account for life and 60 in total, both refunded when generation fails. The Worker needs a Google AI Studio key as a secret:

```sh
cd worker && npx wrangler secret put GOOGLE_API_KEY
```

## Share a sheet

The share button (top right of a character sheet) encodes a read-only snapshot of the character and referenced homebrew into the URL hash fragment as compressed base64url data. The fragment is processed entirely client-side without reaching GitHub or the sync Worker, bypassing the passphrase gate for that single sheet. Dice rolling and rule lookups remain active while trackers and edits are locked. The share tray also generates a character card image containing portrait, stats, and badges.

## Install on iOS

Open the Pages URL in Safari, tap **Share**, and select **Add to Home Screen**. The app runs fullscreen and functions offline via its service worker. Data is stored in browser storage (IndexedDB with localStorage fallback); use **Export ledger** to create JSON backups before clearing browser data.
