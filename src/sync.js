/* Account & live sync — the ledger's only backend is a Cloudflare Worker
   (worker/): two POSTs for auth, then one WebSocket per device for
   everything else. App.jsx loads this module lazily, and only when
   sync-config.js names a server, so the base app pays nothing.

   Local storage remains the source of truth the UI runs on; this module
   keeps it in step with the account: every local change rides up as a
   per-character put (last writer wins), every remote change is handed back
   to App to apply. Changes made offline wait in a persisted outbox; on
   every (re)connect the server dumps its full state, the outbox flushes,
   and the two sides converge. Applying a remote change never pushes, so
   echo loops are structurally impossible. */
import { SYNC_URL } from "./sync-config.js";
import { GATE_HASH } from "./gate-config.js";

const ACCT_KEY = "ledger-account-v1";
const OUTBOX_KEY = "ledger-outbox-v1";
const CAP = 200000; // bytes a character may occupy on the wire; the server allows 1MB

/* ---- key derivation: the password never leaves the device ----
   The gate's own recipe (PBKDF2-SHA256, 600k rounds), salted per email.
   The server only ever sees this derived key, and stores a salted hash
   of it — a database leak upstairs yields no passwords. */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function deriveKey(email, password) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("ledger:" + email), iterations: 600000 }, km, 256));
}

export const getAccount = () => { try { return JSON.parse(localStorage.getItem(ACCT_KEY)); } catch { return null; } };
const setAccount = (a) => { a ? localStorage.setItem(ACCT_KEY, JSON.stringify(a)) : localStorage.removeItem(ACCT_KEY); };

async function authPost(path, body) {
  let res;
  try {
    res = await fetch(SYNC_URL + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch { throw new Error("The aether is out of reach — check your connection."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The aether did not answer. Try again.");
  return data;
}
/* merged:false until the first dump after this sign-in has union-merged —
   persisted, so a reload in between still merges instead of adopting. */
export async function register(email, password) {
  email = email.trim().toLowerCase();
  const { token } = await authPost("/register", { email, key: await deriveKey(email, password), gate: GATE_HASH });
  setAccount({ email, token, merged: false });
}
export async function signIn(email, password) {
  email = email.trim().toLowerCase();
  const { token } = await authPost("/login", { email, key: await deriveKey(email, password) });
  setAccount({ email, token, merged: false });
}
export function signOut() {
  const a = getAccount();
  if (a) fetch(SYNC_URL + "/logout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) }).catch(() => {});
  localStorage.removeItem(ACCT_KEY);
  localStorage.removeItem(OUTBOX_KEY);
  stop();
}

/* ============ THE LIVE WIRE ============ */
let ws = null, tries = 0, timer = null, ping = null, alive = false;
let known = null;       // key → value the server is known to hold (null until the first dump)
let outbox = new Map(); // key → {v: string|null, n, ts} — unacked local changes with the device clock, persisted
let seq = 0;
let H = null;           // App's handlers

const loadOutbox = () => {
  try {
    const o = JSON.parse(localStorage.getItem(OUTBOX_KEY)) || [];
    outbox = new Map(o);
    seq = Math.max(0, ...o.map(([, e]) => e.n));
  } catch { outbox = new Map(); }
};
const saveOutbox = () => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox])); } catch { /* quota — sync limps, play continues */ } };

const wire = (k, e) => JSON.stringify(e.v === null ? { t: "del", k, n: e.n, ts: e.ts } : { t: "put", k, v: e.v, n: e.n, ts: e.ts });
function queue(k, v) {
  outbox.set(k, { v, n: ++seq, ts: Date.now() }); // ts = when the hand moved, for staleness contests later
  saveOutbox();
  if (alive) try { ws.send(wire(k, outbox.get(k))); } catch { /* mid-close — the outbox holds it */ }
}

export function start(handlers) {
  H = handlers;
  loadOutbox();
  connect();
  ping = setInterval(() => { if (alive) ws.send("ping"); }, 45000); // the edge answers without waking the account
  addEventListener("online", kick);
  return stop;
}
export function stop() {
  clearInterval(ping);
  clearTimeout(timer);
  removeEventListener("online", kick);
  alive = false; known = null;
  if (ws) { ws.onclose = null; try { ws.close(); } catch { /* already gone */ } ws = null; }
  H?.status("offline");
}
function kick() { if (!alive && getAccount()) { tries = 0; clearTimeout(timer); connect(); } }

function connect() {
  const a = getAccount();
  if (!a) return;
  if (ws) { ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch { /* noop */ } alive = false; } // one wire at a time
  H.status("reaching");
  let dump = new Map(); // the connect dump collects here until "synced"
  const sock = new WebSocket(SYNC_URL.replace(/^http/, "ws") + `/ws?email=${encodeURIComponent(a.email)}&token=${encodeURIComponent(a.token)}`);
  ws = sock;
  sock.onmessage = (ev) => {
    if (ws !== sock) return; // a newer wire has taken over
    if (ev.data === "pong") return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === "ch") {
      if (dump) { dump.set(m.k, { v: m.v, ts: m.ts || 0 }); return; }
      if (outbox.has(m.k)) return; // our newer change is already in flight for this key
      if (m.v === null) known.delete(m.k); else known.set(m.k, m.v);
      applyKey(m.k, m.v);
    } else if (m.t === "ack") {
      for (const [k, e] of outbox) if (e.n === m.n) {
        if (e.v === null) known?.delete(k); else known?.set(k, e.v);
        outbox.delete(k);
      }
      saveOutbox();
    } else if (m.t === "err") { // the server declined a change: quarantine it or it re-sends forever
      for (const [k, e] of outbox) if (e.n === m.n) { outbox.delete(k); H.error(`Sync declined a change: ${m.m}.`); }
      saveOutbox();
    } else if (m.t === "synced") {
      // an offline queue can be older than what other hands wrote meanwhile — newer dump wins
      for (const [k, e] of outbox) { const row = dump.get(k); if (row && row.ts > e.ts) outbox.delete(k); }
      saveOutbox();
      known = new Map([...dump].filter(([, r]) => r.v !== null).map(([k, r]) => [k, r.v]));
      const d = dump; dump = null;
      alive = true; tries = 0;
      H.status("live");
      adopt(d);
      for (const [k, e] of outbox) sock.send(wire(k, e)); // surviving queued changes ride up after the dump
    }
  };
  sock.onclose = (ev) => {
    if (ws !== sock) return; // superseded — its state is no longer ours to touch
    ws = null; alive = false;
    H.status("offline");
    if (ev.code === 4001) { // token revoked — and the outbox must not leak into the next account
      setAccount(null); outbox = new Map(); localStorage.removeItem(OUTBOX_KEY);
      H.signedOut(); return;
    }
    timer = setTimeout(connect, Math.min(60000, 1000 * 2 ** tries++));
  };
  sock.onerror = () => { try { sock.close(); } catch { /* noop */ } };
}

/* Fields the wire may omit (a trimmed chronicle, an unreadable portrait)
   survive locally: an absent key keeps the local copy; an explicit null is
   a real removal and is adopted. */
const graft = (inc, local) => {
  if (!local) return inc;
  const out = { ...inc };
  for (const f of ["log", "hpLog", "photo"]) if (!(f in inc) && f in local) out[f] = local[f];
  return out;
};

/* The connect dump becomes app state. Cloud versions win their ids — except
   keys with a surviving outbox entry, where the local change is newer. The
   first dump after a sign-in merges instead of adopting: local souls the
   account lacks ride up, so signing in never erases a device. */
function adopt(d) {
  const acct = getAccount();
  const first = !!acct && !acct.merged;
  const rows = [];
  for (const [k, r] of d) if (r.v !== null && k.startsWith("c/")) { try { rows.push(JSON.parse(r.v)); } catch { /* skip corrupt */ } }
  rows.sort((a, b) => (a.i - b.i) || (a.c.id < b.c.id ? -1 : 1));
  const local = H.getLocal();
  const byId = new Map((local.chars || []).map((c) => [c.id, c]));
  let arr = rows.map((r) => graft(r.c, byId.get(r.c.id)));
  if (first) {
    const have = new Set(arr.map((c) => c.id));
    const extras = (local.chars || []).filter((c) => c && !have.has(c.id) && !outbox.has("c/" + c.id));
    arr = [...arr, ...extras];
    extras.forEach((c) => prep(c, arr.indexOf(c)));
    if (!d.has("m/custom") && !outbox.has("m/custom")) queue("m/custom", JSON.stringify(local.custom));
    if (!d.has("m/prefs") && !outbox.has("m/prefs") && local.prefs.length) queue("m/prefs", JSON.stringify({ off: local.prefs }));
    setAccount({ ...acct, merged: true });
  }
  arr = arr.filter((c) => outbox.get("c/" + c.id)?.v !== null); // deleted here while offline
  for (const [k, e] of outbox) {
    if (!k.startsWith("c/") || e.v === null) continue;
    try {
      const { c } = JSON.parse(e.v);
      const at = arr.findIndex((x) => x.id === c.id);
      const whole = graft(c, byId.get(c.id) || (at >= 0 ? arr[at] : null)); // the wire copy may be trimmed; the local one is whole
      at >= 0 ? (arr[at] = whole) : arr.push(whole);
    } catch { /* skip corrupt */ }
  }
  if (JSON.stringify(arr) !== JSON.stringify(local.chars)) H.chars(arr);
  if (!outbox.has("m/custom") && d.get("m/custom")?.v) { try { H.custom(JSON.parse(d.get("m/custom").v), first); } catch { /* noop */ } }
  if (!outbox.has("m/prefs") && d.get("m/prefs")?.v) { try { H.prefs(JSON.parse(d.get("m/prefs").v).off || []); } catch { /* noop */ } }
}

function applyKey(k, v) {
  if (k === "m/custom") { if (v) try { H.custom(JSON.parse(v)); } catch { /* noop */ } return; }
  if (k === "m/prefs") { if (v) try { H.prefs(JSON.parse(v).off || []); } catch { /* noop */ } return; }
  if (!k.startsWith("c/")) return;
  const id = k.slice(2);
  const chars = H.getLocal().chars || [];
  const arr = chars.filter((c) => c.id !== id);
  if (v !== null) {
    try {
      const { i, c } = JSON.parse(v);
      arr.splice(Math.min(i ?? arr.length, arr.length), 0, graft(c, chars.find((x) => x.id === id)));
    } catch { return; }
  }
  H.chars(arr);
}

/* ---- push: what changed locally rides up ----
   prev (the roster before this change) narrows the push to the characters
   that actually moved — before the first dump `known` is empty, and without
   the narrowing one offline edit would ship the whole roster with fresh
   timestamps, trampling other devices' newer copies. */
export function pushChars(next, prev) {
  if (!getAccount()) return;
  const base = prev && new Map(prev.map((c, i) => [c.id, JSON.stringify({ i, c })]));
  next.forEach((ch, i) => prep(ch, i, base));
}
/* Deletion is deliberate, never inferred: only the sheet's own delete
   button removes a soul from the account, so a half-settled roster
   snapshot can never mass-delete what another device holds. */
export function deleteChar(id) {
  if (getAccount()) queue("c/" + id, null);
}
/* Legacy portraits predate the 220px shrink and can be megabytes — far past
   the wire budget. Re-encode through the same canvas as the upload path;
   the smaller portrait syncs now and is handed back for the local copy. */
async function prep(ch, i, base) {
  const k = "c/" + ch.id;
  if (base && base.get(ch.id) === JSON.stringify({ i, c: ch })) return; // unmoved since the last roster
  let body = ch;
  if (body.photo && body.photo.length > 90000) {
    const p = await shrinkPhoto(body.photo);
    if (p) { H.photo(ch.id, p); body = { ...body, photo: p }; }
    else { const { photo, ...rest } = body; body = rest; } // unreadable portrait stays local-only
  }
  let v = JSON.stringify({ i, c: body });
  if (v.length > CAP) { const { log, hpLog, ...rest } = body; v = JSON.stringify({ i, c: rest }); } // the chronicle stays home
  if (v.length > CAP) { H.error(`${ch.name} is too large to sync.`); return; }
  if (known?.get(k) !== v && outbox.get(k)?.v !== v) queue(k, v);
}
const shrinkPhoto = (dataUrl) => new Promise((res) => {
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 220;
      const min = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 220, 220);
      res(c.toDataURL("image/jpeg", 0.82));
    } catch { res(null); }
  };
  img.onerror = () => res(null);
  img.src = dataUrl;
});

export function pushCustom(stripped) {
  if (!getAccount()) return;
  const v = JSON.stringify(stripped);
  if (v.length > 900000) { H.error("The homebrew collection is too large to sync."); return; }
  if (known?.get("m/custom") !== v && outbox.get("m/custom")?.v !== v) queue("m/custom", v);
}
export function pushPrefs(off) {
  if (!getAccount()) return;
  const v = JSON.stringify({ off });
  if (known?.get("m/prefs") !== v && outbox.get("m/prefs")?.v !== v) queue("m/prefs", v);
}
