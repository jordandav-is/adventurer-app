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

- **Email/password registration**: Account registration (`/register`) requires an email, password, the ledger gate passphrase, and a client-generated registration ID. The Worker validates input lengths, verifies the raw passphrase server-side against committed gate parameters (the public gate hash is never accepted as an authorization bearer), and idempotently provisions the account via the Identity singleton.
- **Unverified login identifier and no recovery**: Email serves solely as an unverified login identifier to namespace accounts. There is deliberately no email verification, email delivery, or password reset mechanism. Forgotten passwords cannot be recovered.
- **Password storage and verification**: Passwords cross TLS to the Worker and are stored exclusively on the Account DO as versioned PBKDF2-SHA256 hashes with random 16-byte salts and 600,000 iterations using WebCrypto. Passwords are never stored client-side. To prevent user enumeration and timing attacks, failed logins (unknown accounts or incorrect passwords) perform uniform KDF work and return a fixed delay and response. Correct credentials always succeed with no account lockout.
- **Password change**: Signed-in users can update their password (`/password`) by providing their current password and a new password. The Worker atomically verifies the active session and current password, updates the hash record, revokes all existing sessions, tickets, and active WebSockets, and returns a fresh session token.
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

### 3. Continuous deployment
- **GitHub Pages**: Pushes to `main` install dependencies via `npm ci`, validate `SYNC_URL`, build with Node 24, and deploy `dist/` via `deploy.yml`. Site: https://jordandav-is.github.io/adventurer-app/
- **Worker**: Pushes modifying `worker/**` install dependencies via `npm ci`, run tests, validate `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, and deploy via `deploy-worker.yml` using `npm run deploy`.

## Share a sheet

The share button (top right of a character sheet) encodes a read-only snapshot of the character and referenced homebrew into the URL hash fragment as compressed base64url data. The fragment is processed entirely client-side without reaching GitHub or the sync Worker, bypassing the passphrase gate for that single sheet. Dice rolling and rule lookups remain active while trackers and edits are locked. The share tray also generates a character card image containing portrait, stats, and badges.

## Install on iOS

Open the Pages URL in Safari, tap **Share**, and select **Add to Home Screen**. The app runs fullscreen and functions offline via its service worker. Data is stored in browser storage (IndexedDB with localStorage fallback); use **Export ledger** to create JSON backups before clearing browser data.
