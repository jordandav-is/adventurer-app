/* Where the ledger's sync server lives — a Cloudflare Worker (see worker/).
   Leave empty ("") and the app runs fully local: no account UI, no network
   calls, exactly the ledger as it always was.

   One-time setup (free plan, ~5 minutes):
     cd worker && npx wrangler deploy
   then paste the printed URL below (no trailing slash) and push. The CSP
   in index.html already admits *.workers.dev (and localhost for dev);
   a custom domain would need adding to connect-src there too. */
export const SYNC_URL = "http://localhost:8787";
