import { SYNC_URL } from "./sync-config.js";

const ACCT_KEY = "ledger-account-v2";
const OUTBOX_KEY = "ledger-outbox-v1";
const CAP = 200000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function isValidAccount(a) {
  if (!a || typeof a !== "object") return false;
  if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return false;
  if (typeof a.email !== "string" || a.email.length > 254 || !EMAIL_RE.test(a.email)) return false;
  if (typeof a.token !== "string" || !TOKEN_RE.test(a.token)) return false;
  return true;
}

export const getAccount = () => {
  try { localStorage.removeItem("ledger-account-v1"); } catch {}
  try {
    const raw = localStorage.getItem(ACCT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw);
    if (isValidAccount(a)) {
      return {
        id: a.id,
        email: a.email.trim().toLowerCase(),
        hasPassword: !!a.hasPassword,
        token: a.token,
        merged: !!a.merged,
      };
    }
    localStorage.removeItem(ACCT_KEY);
    return null;
  } catch {
    try { localStorage.removeItem(ACCT_KEY); } catch {}
    return null;
  }
};

const setAccount = (a) => {
  if (isValidAccount(a)) {
    localStorage.setItem(
      ACCT_KEY,
      JSON.stringify({
        id: a.id,
        email: a.email.trim().toLowerCase(),
        hasPassword: !!a.hasPassword,
        token: a.token,
        merged: !!a.merged,
      })
    );
  } else {
    localStorage.removeItem(ACCT_KEY);
  }
};

async function authPost(path, body) {
  let res;
  try {
    res = await fetch(SYNC_URL + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("The aether is out of reach — check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "The aether did not answer. Try again.");
  }
  return data;
}

export async function registerPassword(email, password, passphrase, registrationId) {
  email = (email || "").trim().toLowerCase();
  const data = await authPost("/register", { email, password, passphrase, registrationId });
  setAccount({
    id: data.account.id,
    email: data.account.email,
    hasPassword: data.account.hasPassword,
    token: data.token,
    merged: false,
  });
  return data;
}

export async function signInPassword(email, password) {
  email = (email || "").trim().toLowerCase();
  const data = await authPost("/login", { email, password });
  setAccount({
    id: data.account.id,
    email: data.account.email,
    hasPassword: data.account.hasPassword,
    token: data.token,
    merged: false,
  });
  return data;
}

export async function recoverPassword(email, recoveryKey, newPassword) {
  email = (email || "").trim().toLowerCase();
  recoveryKey = (recoveryKey || "").trim();
  const data = await authPost("/recover", { email, recoveryKey, newPassword });
  setAccount({
    id: data.account.id,
    email: data.account.email,
    hasPassword: data.account.hasPassword,
    token: data.token,
    merged: false,
  });
  return data;
}

export async function changePassword(currentPassword, newPassword) {
  const a = getAccount();
  if (!a) throw new Error("No active session.");

  connGen++;
  if (ws) {
    ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch {}
    ws = null;
    alive = false;
  }
  clearTimeout(timer);

  let data;
  try {
    data = await authPost("/password", {
      accountId: a.id,
      token: a.token,
      currentPassword,
      newPassword,
    });
  } catch (err) {
    if (H) connect();
    throw err;
  }

  setAccount({
    id: data.account.id,
    email: data.account.email,
    hasPassword: data.account.hasPassword,
    token: data.token,
    merged: a.merged,
  });

  if (H) connect();
  return data;
}

export async function rotateRecoveryKey(currentPassword) {
  const a = getAccount();
  if (!a) throw new Error("No active session.");
  const data = await authPost("/recovery-key", {
    accountId: a.id,
    token: a.token,
    currentPassword,
  });
  return data;
}
export function signOut() {
  const a = getAccount();
  if (a) {
    fetch(SYNC_URL + "/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: a.id, token: a.token }),
    }).catch(() => {});
  }
  setAccount(null);
  outbox.clear();
  localStorage.removeItem(OUTBOX_KEY);
  gens.clear();
  stop();
}

let ws = null, tries = 0, timer = null, ping = null, alive = false;
let known = null;
let outbox = new Map();
let seq = 0;
let clock = 0;
let H = null;
let connGen = 0;
const gens = new Map();

const tick = () => (clock = Math.max(Date.now(), clock + 1));
const observe = (ts) => {
  if (Number.isSafeInteger(ts) && ts > 0 && ts > clock) clock = ts;
};

const loadOutbox = () => {
  try {
    const o = JSON.parse(localStorage.getItem(OUTBOX_KEY)) || [];
    outbox = new Map(o);
    seq = Math.max(0, ...o.map(([, e]) => e.n));
    const maxTs = Math.max(0, ...o.map(([, e]) => e.ts || 0));
    if (maxTs > clock) clock = maxTs;
  } catch {
    outbox = new Map();
  }
};

const saveOutbox = () => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox]));
  } catch {}
};

const wire = (k, e) =>
  JSON.stringify(e.v === null ? { t: "del", k, n: e.n, ts: e.ts } : { t: "put", k, v: e.v, n: e.n, ts: e.ts });

function queue(k, v) {
  outbox.set(k, { v, n: ++seq, ts: tick() });
  saveOutbox();
  if (alive && ws) try { ws.send(wire(k, outbox.get(k))); } catch {}
}

export function start(handlers) {
  H = handlers;
  loadOutbox();
  connect();
  ping = setInterval(() => { if (alive && ws) ws.send("ping"); }, 45000);
  addEventListener("online", kick);
  return stop;
}

export function stop() {
  connGen++;
  clearInterval(ping);
  clearTimeout(timer);
  removeEventListener("online", kick);
  alive = false;
  known = null;
  if (ws) {
    ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch {}
    ws = null;
  }
  H?.status("offline");
}

function kick() {
  if (!alive && getAccount()) {
    tries = 0;
    clearTimeout(timer);
    connect();
  }
}

async function connect() {
  const gen = ++connGen;
  const a = getAccount();
  if (!a || !SYNC_URL) return;

  if (ws) {
    ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch {}
    ws = null;
    alive = false;
  }

  H?.status("reaching");

  let ticket;
  try {
    const res = await fetch(SYNC_URL + "/ws-ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: a.id, token: a.token }),
    });
    if (gen !== connGen) return;

    if (res.status === 401 || res.status === 403) {
      setAccount(null);
      outbox.clear();
      saveOutbox();
      H?.status("offline");
      H?.signedOut?.();
      return;
    }
    if (!res.ok) throw new Error("Ticket request failed");
    const data = await res.json();
    ticket = data.ticket;
    if (!ticket) throw new Error("No ticket returned");
  } catch {
    if (gen !== connGen) return;
    H?.status("offline");
    timer = setTimeout(connect, Math.min(60000, 1000 * 2 ** tries++));
    return;
  }

  if (gen !== connGen) return;

  let dump = new Map();
  const sock = new WebSocket(
    SYNC_URL.replace(/^http/, "ws") + `/ws?account=${encodeURIComponent(a.id)}&ticket=${encodeURIComponent(ticket)}`
  );
  ws = sock;

  sock.onmessage = (ev) => {
    if (ws !== sock || gen !== connGen) return;
    if (ev.data === "pong") return;
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }

    if (m.t === "ch") {
      observe(m.ts);
      if (dump) { dump.set(m.k, { v: m.v, ts: m.ts || 0 }); return; }
      if (outbox.has(m.k)) return;
      if (m.v === null) known?.delete(m.k); else known?.set(m.k, m.v);
      applyKey(m.k, m.v);
    } else if (m.t === "ack") {
      observe(m.ts);
      for (const [k, e] of outbox) if (e.n === m.n) {
        outbox.delete(k);
        if (m.ok === false) {
          if (m.v === null) known?.delete(k); else known?.set(k, m.v);
          applyKey(k, m.v);
        } else {
          if (e.v === null) known?.delete(k); else known?.set(k, e.v);
        }
      }
      saveOutbox();
    } else if (m.t === "err") {
      for (const [k, e] of outbox) if (e.n === m.n) {
        outbox.delete(k);
        H?.error(`Sync declined a change: ${m.m}.`);
      }
      saveOutbox();
    } else if (m.t === "synced") {
      for (const [k, e] of outbox) {
        const row = dump.get(k);
        if (row && row.ts >= e.ts) outbox.delete(k);
      }
      saveOutbox();
      known = new Map([...dump].filter(([, r]) => r.v !== null).map(([k, r]) => [k, r.v]));
      const d = dump;
      dump = null;
      alive = true;
      tries = 0;
      H?.status("live");
      adopt(d);
      for (const [k, e] of outbox) sock.send(wire(k, e));
    }
  };

  sock.onclose = (ev) => {
    if (ws !== sock || gen !== connGen) return;
    ws = null;
    alive = false;
    H?.status("offline");
    if (ev.code === 4001 || ev.code === 4003) {
      setAccount(null);
      outbox.clear();
      saveOutbox();
      H?.signedOut?.();
      return;
    }
    timer = setTimeout(connect, Math.min(60000, 1000 * 2 ** tries++));
  };

  sock.onerror = () => {
    try { sock.close(); } catch {}
  };
}

// Retain local-only fields (log, hpLog, photo) if omitted from incoming wire data.
const graft = (inc, local) => {
  if (!local) return inc;
  const out = { ...inc };
  for (const f of ["log", "hpLog", "photo"]) if (!(f in inc) && f in local) out[f] = local[f];
  return out;
};

// Adopts server state dump. First dump after login merges unrecorded local entries.
function adopt(d) {
  const acct = getAccount();
  const first = !!acct && !acct.merged;
  const rows = [];
  for (const [k, r] of d) if (r.v !== null && k.startsWith("c/")) { try { rows.push(JSON.parse(r.v)); } catch {} }
  rows.sort((a, b) => (a.i - b.i) || (a.c.id < b.c.id ? -1 : 1));
  const local = H.getLocal();
  const byId = new Map((local.chars || []).map((c) => [c.id, c]));
  let arr = rows.map((r) => graft(r.c, byId.get(r.c.id)));
  if (first) {
    const have = new Set(arr.map((c) => c.id));
    const extras = (local.chars || []).filter((c) => c && !have.has(c.id) && !outbox.has("c/" + c.id) && !d.has("c/" + c.id));
    arr = [...arr, ...extras];
    extras.forEach((c) => prep(c, arr.indexOf(c)));
    if (!d.has("m/custom") && !outbox.has("m/custom")) queue("m/custom", JSON.stringify(local.custom));
    if (!d.has("m/prefs") && !outbox.has("m/prefs") && local.prefs.length) queue("m/prefs", JSON.stringify({ off: local.prefs }));
    setAccount({ ...acct, merged: true });
  }
  arr = arr.filter((c) => outbox.get("c/" + c.id)?.v !== null);
  for (const [k, e] of outbox) {
    if (!k.startsWith("c/") || e.v === null) continue;
    try {
      const { c } = JSON.parse(e.v);
      const at = arr.findIndex((x) => x.id === c.id);
      const whole = graft(c, byId.get(c.id) || (at >= 0 ? arr[at] : null));
      at >= 0 ? (arr[at] = whole) : arr.push(whole);
    } catch {}
  }
  if (JSON.stringify(arr) !== JSON.stringify(local.chars)) H.chars(arr);
  if (!outbox.has("m/custom") && d.get("m/custom")?.v) { try { H.custom(JSON.parse(d.get("m/custom").v), first); } catch {} }
  if (!outbox.has("m/prefs") && d.get("m/prefs")?.v) { try { H.prefs(JSON.parse(d.get("m/prefs").v).off || []); } catch {} }
}

function applyKey(k, v) {
  if (k === "m/custom") { if (v) try { H.custom(JSON.parse(v)); } catch {} return; }
  if (k === "m/prefs") { if (v) try { H.prefs(JSON.parse(v).off || []); } catch {} return; }
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

export function pushChars(next, prev) {
  if (!getAccount()) return;
  const base = prev && new Map(prev.map((c, i) => [c.id, JSON.stringify({ i, c })]));
  next.forEach((ch, i) => prep(ch, i, base));
}

export function deleteChar(id) {
  gens.set(id, (gens.get(id) || 0) + 1);
  if (getAccount()) queue("c/" + id, null);
}

async function prep(ch, i, base) {
  const k = "c/" + ch.id;
  if (base && base.get(ch.id) === JSON.stringify({ i, c: ch })) return;
  const gen = (gens.get(ch.id) || 0) + 1;
  gens.set(ch.id, gen);
  let body = ch;
  if (body.photo && body.photo.length > 90000) {
    const p = await shrinkPhoto(body.photo);
    if (gens.get(ch.id) !== gen) return;
    if (p) { H.photo(ch.id, p); body = { ...body, photo: p }; }
    else { const { photo, ...rest } = body; body = rest; }
  }
  if (gens.get(ch.id) !== gen) return;
  let v = JSON.stringify({ i, c: body });
  if (v.length > CAP) { const { log, hpLog, ...rest } = body; v = JSON.stringify({ i, c: rest }); }
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
