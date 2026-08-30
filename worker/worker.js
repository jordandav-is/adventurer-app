/* The ledger's sync server — one Cloudflare Worker, one Durable Object per
   account (its id is the email), holding credentials, sessions, and the
   ledger itself as opaque JSON strings in SQLite. The server never parses a
   character. Auth is two POSTs; everything after rides one WebSocket per
   device: puts are stored last-writer-wins and broadcast to the account's
   other devices, and every fresh connection gets a full dump first, so
   devices converge no matter how long they were away.

   Free plan throughout: SQLite-backed DOs hibernate between messages, and
   ping/pong keepalives are answered at the edge without waking anything.

   Deploy: cd worker && npx wrangler deploy
   Lost password (clears credentials, keeps every character; re-register
   with the same email to get back in):
     npx wrangler secret put ADMIN_KEY            # once
     curl -X POST <worker-url>/reset -d '{"email":"…","admin":"<key>"}' */
import { DurableObject } from "cloudflare:workers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const err = (status, error) => json(status, { error });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const raw = url.pathname === "/ws"
      ? url.searchParams.get("email")
      : req.method === "POST" ? (await req.clone().json().catch(() => ({}))).email : "";
    const email = String(raw || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(400, "That email doesn't look right.");
    return env.ACCOUNT.get(env.ACCOUNT.idFromName(email)).fetch(req);
  },
};

const DATA_KEY = /^(c\/[\w-]{1,64}|m\/(custom|prefs))$/; // data only — never auth or sessions
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

export class Account extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // ts is the writing device's clock, stored and relayed untouched — clients
    // use it to settle staleness contests; the server never parses a value
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, ts INTEGER DEFAULT 0)");
    try { ctx.storage.sql.exec("ALTER TABLE kv ADD COLUMN ts INTEGER DEFAULT 0"); } catch { /* born with it */ }
    // the edge answers keepalives itself; the account never wakes for them
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  get(k) { return [...this.ctx.storage.sql.exec("SELECT v FROM kv WHERE k = ?", k)][0]?.v ?? null; }
  put(k, v, ts = 0) { this.ctx.storage.sql.exec("INSERT INTO kv (k, v, ts) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ts = excluded.ts", k, v, ts); }
  del(k) { this.ctx.storage.sql.exec("DELETE FROM kv WHERE k = ?", k); }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") return this.connect(url.searchParams.get("token"));
    const b = await req.json().catch(() => null);
    if (!b) return err(400, "Bad request.");

    if (url.pathname === "/register") {
      // the same words of binding that open the app's door guard the ledger's rolls
      if (b.gate !== this.env.GATE_HASH) return err(403, "The gate does not yield.");
      if (!/^[0-9a-f]{64}$/.test(b.key || "")) return err(400, "Bad key.");
      if (this.get("auth")) return err(409, "That email already has an account — sign in instead.");
      const salt = crypto.randomUUID();
      this.put("auth", JSON.stringify({ salt, hash: await sha(b.key + salt) }));
      return this.session();
    }
    if (url.pathname === "/login") {
      // eight wrong guesses close the gate for a quarter hour
      const f = JSON.parse(this.get("fails") || '{"n":0,"t":0}');
      const recent = Date.now() - f.t < 900000;
      if (f.n >= 8 && recent) return err(429, "Too many tries — the gate rests. Return in a quarter hour.");
      const a = JSON.parse(this.get("auth") || "null");
      if (!a || (await sha(String(b.key) + a.salt)) !== a.hash) {
        this.put("fails", JSON.stringify({ n: (recent ? f.n : 0) + 1, t: Date.now() }));
        return err(401, "Email and password don't match.");
      }
      this.del("fails");
      return this.session();
    }
    if (url.pathname === "/logout") {
      if (typeof b.token === "string") this.del("s/" + b.token);
      return json(200, { ok: true });
    }
    if (url.pathname === "/reset") {
      // admin-only: clears credentials and sessions, keeps the ledger
      if (!this.env.ADMIN_KEY || b.admin !== this.env.ADMIN_KEY) return err(403, "No.");
      this.del("auth");
      this.ctx.storage.sql.exec("DELETE FROM kv WHERE k LIKE 's/%'");
      for (const sock of this.ctx.getWebSockets()) try { sock.close(4001, "reset"); } catch { /* gone */ }
      return json(200, { ok: true });
    }
    return err(404, "Not found.");
  }

  session() {
    const token = crypto.randomUUID() + crypto.randomUUID();
    this.put("s/" + token, JSON.stringify({ t: Date.now() }));
    // keep the ten newest sessions; forgotten devices simply sign in again
    const all = [...this.ctx.storage.sql.exec("SELECT k, v FROM kv WHERE k LIKE 's/%'")];
    if (all.length > 10) {
      all.sort((x, y) => JSON.parse(x.v).t - JSON.parse(y.v).t);
      for (const row of all.slice(0, all.length - 10)) this.del(row.k);
    }
    return json(200, { token });
  }

  connect(token) {
    const pair = new WebSocketPair();
    if (!token || !this.get("s/" + token)) {
      pair[1].accept();
      pair[1].close(4001, "unauthorized"); // a code the client can tell apart from a dropped line
    } else {
      this.ctx.acceptWebSocket(pair[1]);
      // the connect dump: everything the account holds, then the sentinel
      for (const row of this.ctx.storage.sql.exec("SELECT k, v, ts FROM kv WHERE k LIKE 'c/%' OR k LIKE 'm/%'")) {
        pair[1].send(JSON.stringify({ t: "ch", k: row.k, v: row.v, ts: row.ts }));
      }
      pair[1].send('{"t":"synced"}');
    }
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > 2000000) return;
    let m; try { m = JSON.parse(msg); } catch { return; }
    if ((m.t !== "put" && m.t !== "del") || !DATA_KEY.test(m.k || "")) return;
    if (m.t === "put" && (typeof m.v !== "string" || m.v.length > 1500000)) return void ws.send(JSON.stringify({ t: "err", n: m.n, m: "too large" }));
    try {
      m.t === "put" ? this.put(m.k, m.v, Number(m.ts) || 0) : this.del(m.k);
    } catch { // SQLITE_FULL — the free plan's 1GB per account, a distant shore
      return void ws.send(JSON.stringify({ t: "err", n: m.n, m: "storage full" }));
    }
    ws.send(JSON.stringify({ t: "ack", n: m.n }));
    const out = JSON.stringify({ t: "ch", k: m.k, v: m.t === "put" ? m.v : null, ts: Number(m.ts) || 0 });
    for (const sock of this.ctx.getWebSockets()) {
      if (sock !== ws && sock.readyState === WebSocket.OPEN) try { sock.send(out); } catch { /* mid-close */ }
    }
  }
  webSocketError(ws) { try { ws.close(1011, "error"); } catch { /* gone */ } }
}
