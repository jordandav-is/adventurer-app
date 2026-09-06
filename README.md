# The Adventurer's Ledger

5e SRD character sheet and ledger application supporting multiclassing, spellcasting, inventory, live play tracking (HP, spell slots, rests), homebrew forge with FightClub5 XML import, and JSON backup export/import. Browser storage uses IndexedDB with a localStorage fallback.

## Local development

### Web application
```sh
npm ci
npm run dev
```

### Woodland figure preview

```sh
npm run preview:model
npm run preview:stage
```

Open **http://127.0.0.1:5173/stage-preview.html**. This standalone development entry uses the same `Stage` component as the app without an account, Worker, or forge request. The first command downloads the user-supplied [horned ranger from Tripo](https://studio.tripo3d.ai/3d-model/horned-humanoid-ranger-in-leather-armor-with-staff-standing-in-a-fores-1fbd0791-444f-493b-90ff-5b1a7e486a92) using its public project endpoint. The sample stays in ignored `.preview-assets/`, outside `public/` and the production build. If the project is no longer public, download your GLB from Tripo and use **Open a GLB file** instead. Local files stay in the browser; they are not uploaded.

Drag or use left/right arrows to turn the figure; scroll, pinch, or use `+`/`−` to zoom. **Portrait** frames the upper body, **Reset view** restores the starting pose, and **Save portrait** exports the rendered scene without interface overlays. The four light presets preserve existing `dawn`, `noon`, `dusk`, and `night` character settings. **Living environment** pauses/resumes wind, clouds, and motes; reduced-motion preferences also pause ambient motion. Hidden views stop rendering.

The Verdant Watch's geometry, stone/bark/ground textures, and botanical sprites are original app assets, inspired by the woodland composition of BG3 character creation rather than extracted game assets. `src/woodland.js` builds the scene; `scripts/bake-woodland.py` deterministically regenerates the nine images in `public/environments/woodland/` using Python, NumPy, and Pillow. The checked-in images need no Python at runtime or build time. Regenerate them with `python scripts/bake-woodland.py` after installing those two Python dependencies. The Tripo character is a separate, user-provided preview asset, not part of the environment asset set.

### Sync Worker (optional)
```sh
cd worker
npm ci
npm run dev
```

## Access control

The deployed web application is protected by a client-side passphrase gate (`src/gate.jsx`). It computes a PBKDF2-SHA256 hash (600,000 iterations) from the entered passphrase and checks it against public parameters in `src/gate-config.js`.

The gate is a client-side filter for static hosting, not cryptographic backend authorization. Local character data remains in the browser (IndexedDB with localStorage fallback), so unauthenticated visitors see only their own empty local state.

## Account sync architecture

Account sync is optional. When unconfigured or signed out, the application operates strictly locally with zero background network requests.

When configured, sync runs on a Cloudflare Worker backed by SQLite Durable Objects:
- **Identity singleton DO**: Maps normalized email addresses to random opaque account UUIDs and coordinates idempotent registration lifecycles.
- **Account DO**: One Durable Object per random account UUID. Manages character data, live WebSocket connections, session token digests, password credentials, and single-use WebSocket connection tickets.
- **Offline support and conflict resolution**: Local changes queue in an offline outbox and sync over WebSocket upon reconnecting. Conflicts resolve using server-authoritative last-write-wins (LWW, where stored records win when `incoming.ts <= stored.ts`) with permanent tombstones for deletions.

## Authentication and credentials

- **Email/password registration**: Account registration (`/register`) requires an email, password, and a client-generated registration ID. The Worker validates input lengths, idempotently provisions the account via the Identity singleton, and returns a 256-bit single-use recovery key.
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

When an account is signed in, originals upload to R2 through the Worker (`PUT /asset/<sha256>?account=<id>` with a `Bearer` session token). Originals are content-addressed by SHA-256 and immutable: other devices and shared sheets fetch them lazily (`GET /asset/<sha256>`), allowing read-only snapshots to display portraits without embedding bulky image blobs in the share URL. Without R2 configured the Worker answers 503 and the app simply keeps originals device-local, with thumbs still syncing.

### Conjuring a portrait

From a signed-in sheet, the portrait menu offers **Conjure one from your sheet**. The player adds a short description; the app sends it with a compact brief (ancestry, classes, features, persona, notes) to the Worker's `/conjure` route. Gemini 3.8 Flash turns the brief into an art prompt under a fixed WotC-style prompt frame, Gemini 3.1 Flash Image paints four candidates, and the player frames the one they like, which then flows through the ordinary portrait asset path. Rounds are metered by `CONJURE_ROUNDS_PER_ACCOUNT` and `CONJURE_ROUNDS_GLOBAL` in `worker/wrangler.toml` (0 = unmetered; refunded when generation fails), and `CONJURE_UNMETERED` lists emails that are never metered. The Worker needs a Google AI Studio key as a secret:

```sh
cd worker && npx wrangler secret put GOOGLE_API_KEY
```

### Forging a 3D figure

From a signed-in sheet with a portrait, the portrait menu offers **Forge a 3D figure**. The Worker's `/forge/<imageHash>` route uploads the portrait to Tripo and walks a task chain — image to model (PBR textures), auto-rig, idle animation — storing the chain in the Account Durable Object keyed by image hash so a repeat costs nothing. The finished GLB lands in R2 as an ordinary content-addressed asset and the character records `model: { id, env, background }`. If rigging fails the unrigged mesh is delivered instead.

**View in 3D** opens the lazy-loaded Three.js viewer. The right-side **Background** selector chooses **Woodland overlook** or **The Cathedral of the Eight**, independently of the four lighting moods. Existing characters without a background retain the woodland. Background selection is preserved in character records and share links. The woodland has weathered paving, a ruined arch, animated foliage, distant ridges, and drifting clouds. The cathedral has a monumental eightfold rose window, separate stained-glass fanlights over three carved portals, tall side windows, clustered stone columns, a balustraded landing, candles, and drifting dust in window light shafts. Original assets are baked with NumPy/Pillow using `python scripts/bake-cathedral.py`; the woodland equivalent is `scripts/bake-woodland.py`.

`src/woodland.js` and `src/cathedral.js` own their geometry, textures, lighting moods, and cached PMREM reflections. Switching backgrounds retains the renderer and character, disposing the old environment before mounting the next. Character loading and inspection live in `src/stage.jsx`, including Meshopt-compressed GLB support. Dragging turns only the figure. Scroll, pinch, or `+`/`-` zoom from portrait through full figure; the cathedral extends far beyond full figure into an elevated nave view. **Grand view** selects this architectural framing directly, **Full figure** returns to character inspection, and **Reset view** also restores the original facing. **Save portrait** downloads an image in the standalone preview; in the character sheet it passes the image into the existing portrait framing editor. Static meshes work without rigging; embedded animation clips play unless motion is paused.

Run `npm run preview:stage` to open the local cathedral preview at **Full figure**. The preview uses `.preview-assets/ranger.glb` (fetch it with `npm run preview:model` if absent). Open `/stage-preview.html?background=woodland` to start in the woodland instead. The preview model is local-only and is not part of the production build.

The Worker needs a Tripo key as a secret:

```sh
cd worker && npx wrangler secret put TRIPO_API_KEY
```

## Share a sheet

The share button (top right of a character sheet) encodes a read-only snapshot of the character and referenced homebrew into the URL hash fragment as compressed base64url data. The fragment is processed entirely client-side without reaching GitHub or the sync Worker, bypassing the passphrase gate for that single sheet. Dice rolling and rule lookups remain active while trackers and edits are locked. Portrait framing metadata is preserved in the link while the large thumbnail is omitted, so shared sheets load the portrait from R2 using its content hash. The share tray also generates a character card image containing portrait, stats, and badges.

## Install on iOS

Open the Pages URL in Safari, tap **Share**, and select **Add to Home Screen**. The app runs fullscreen and functions offline via its service worker. Data is stored in browser storage (IndexedDB with localStorage fallback); use **Export ledger** to create JSON backups before clearing browser data.
