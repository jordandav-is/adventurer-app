// Portrait assets: full-resolution originals live as content-addressed Blobs (IndexedDB locally,
// R2 remotely). A character carries only `portrait: { id, w, h, x, y, z }` — the asset hash, its
// pixel size, and a framing (normalized centre + zoom) — plus `photo`, a 220px thumb derived from
// that framing so every existing consumer (roster, share card, sync) needs no original at all.
import { SYNC_URL } from "./sync-config.js";
import { getAccount } from "./sync.js";
import { useEffect, useState } from "react";

const MAX_SIDE = 2048, THUMB = 220;

// The one framing rule: a square window of side min(w,h)/z centred on (x·w, y·h), clamped inside.
export function frameRect(p) {
  const side = Math.min(p.w, p.h) / p.z;
  const clamp = (v, max) => Math.min(Math.max(v, 0), max - side);
  return { sx: clamp(p.x * p.w - side / 2, p.w), sy: clamp(p.y * p.h - side / 2, p.h), side };
}
export const clampFrame = (p) => {
  const { sx, sy, side } = frameRect({ ...p, z: Math.min(Math.max(p.z, 1), 4) });
  return { ...p, z: Math.min(p.w, p.h) / side, x: (sx + side / 2) / p.w, y: (sy + side / 2) / p.h };
};
// CSS for an <img> inside an overflow-hidden box of `size` px.
export function frameStyle(p, size) {
  const { sx, sy, side } = frameRect(p), k = size / side;
  return { position: "absolute", left: -sx * k, top: -sy * k, width: p.w * k, height: p.h * k, maxWidth: "none" };
}
export function thumbOf(img, p) {
  const c = document.createElement("canvas");
  c.width = c.height = THUMB;
  const { sx, sy, side } = frameRect(p);
  c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, THUMB, THUMB);
  return c.toDataURL("image/jpeg", 0.82);
}

// ---- local store ----
let db;
const store = (mode) => (db ||= new Promise((ok, no) => {
  const r = indexedDB.open("ledger-assets", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("blobs");
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
})).then((d) => d.transaction("blobs", mode).objectStore("blobs"));
const idb = (mode, fn) => store(mode).then((s) => new Promise((ok, no) => { const q = fn(s); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Decode, downscale to MAX_SIDE, re-encode, hash, keep. Returns a fresh centred portrait record.
export async function importPhoto(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
  const id = hex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  await idb("readwrite", (s) => s.put(blob, id));
  urls.set(id, URL.createObjectURL(blob));
  return { id, w: c.width, h: c.height, x: 0.5, y: 0.5, z: 1 };
}
export async function importModel(file) {
  if (!file) throw new Error("No file provided");
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 12) throw new Error("Not a valid GLB file (file is too small).");
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) {
    throw new Error("Choose a binary .glb file. Text .gltf files with separate textures are not supported.");
  }
  const id = hex(await crypto.subtle.digest("SHA-256", buffer));
  const blob = new Blob([buffer], { type: "model/gltf-binary" });
  await idb("readwrite", (s) => s.put(blob, id));
  urls.set(id, URL.createObjectURL(blob));
  remote(id, { method: "PUT", body: blob, headers: { "content-type": "model/gltf-binary" } })
    .then((r) => { if (r?.ok) localStorage.setItem(SENT(), JSON.stringify([...sent(), id])); })
    .catch(() => {});
  return { id };
}

export async function uploadAssetToR2(id) {
  if (!id || !SYNC_URL || !getAccount()) return false;
  const blob = await idb("readonly", (s) => s.get(id)).catch(() => null);
  if (!blob) return false;
  const r = await remote(id, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } }).catch(() => null);
  if (r?.ok) {
    localStorage.setItem(SENT(), JSON.stringify([...sent(), id]));
    return true;
  }
  return false;
}

export async function ensurePortraitRecord({ photo, portrait } = {}) {
  if (portrait?.id) {
    await uploadAssetToR2(portrait.id);
    return portrait;
  }
  if (!photo) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const w = img.naturalWidth || 512;
        const h = img.naturalHeight || 512;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
        if (!blob) return resolve(null);
        const id = hex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
        await idb("readwrite", (s) => s.put(blob, id));
        urls.set(id, URL.createObjectURL(blob));
        const rec = { id, w, h, x: 0.5, y: 0.5, z: 1 };
        await uploadAssetToR2(id);
        resolve(rec);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = photo;
  });
}

// ---- remote (R2 via the sync Worker), content-addressed and immutable ----
const remote = (id, init) => {
  if (!SYNC_URL) return Promise.reject(new Error("No sync URL configured"));
  const a = getAccount();
  if (init?.method === "PUT") {
    return a ? fetch(`${SYNC_URL}/asset/${id}?account=${a.id}`, { ...init, headers: { authorization: `Bearer ${a.token}`, ...init?.headers } }) : Promise.reject(new Error("Sign in required to upload"));
  }
  const query = a?.id ? `?account=${a.id}` : "";
  const headers = a?.token ? { authorization: `Bearer ${a.token}`, ...init?.headers } : { ...init?.headers };
  return fetch(`${SYNC_URL}/asset/${id}${query}`, { ...init, headers });
};
const SENT = () => "ledger-assets-sent:" + getAccount()?.id;
const sent = () => { try { return new Set(JSON.parse(localStorage.getItem(SENT())) || []); } catch { return new Set(); } };
// Upload every referenced original the account has not yet received. Safe to call often.
export function flushAssets(chars) {
  const done = sent();
  for (const ch of chars) {
    const ids = [ch.portrait?.id, ch.model?.id].filter(Boolean);
    for (const id of ids) {
      if (done.has(id)) continue;
      idb("readonly", (s) => s.get(id)).then((blob) => blob && remote(id, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } }))
        .then((r) => { if (r?.ok) localStorage.setItem(SENT(), JSON.stringify([...sent(), id])); }).catch(() => {});
    }
  }
}

// Prepares a scaled-down base64 JPEG reference payload from an existing portrait/photo for the vision model.
export async function referenceImagePayload({ photo, portrait } = {}, maxDim = 768) {
  const url = portrait?.id ? await assetUrl(portrait.id).catch(() => null) : null;
  const src = url || photo;
  if (!src) return null;
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const nw = img.naturalWidth || img.width || 1;
      const nh = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxDim / Math.max(nw, nh));
      const w = Math.max(1, Math.round(nw * scale));
      const h = Math.max(1, Math.round(nh * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      res(base64 ? { mimeType: "image/jpeg", data: base64 } : null);
    };
    img.onerror = () => {
      if (photo && photo.startsWith("data:")) {
        const [meta, data] = photo.split(",");
        const mimeType = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
        res(data ? { mimeType, data } : null);
      } else {
        res(null);
      }
    };
    img.src = src;
  });
}

// Ask the Worker to write a prompt from the brief and paint four candidates. Returns Blobs.
export async function conjure(brief, referenceImage) {
  const a = getAccount();
  if (!a || !SYNC_URL) throw new Error("Sign in to conjure a portrait.");
  const payload = { accountId: a.id, token: a.token, brief };
  if (referenceImage?.data) payload.referenceImage = referenceImage;
  const res = await fetch(`${SYNC_URL}/conjure`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The muse did not answer.");
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { prompt: data.prompt, blobs: data.images.map((i) => new Blob([bytes(i.data)], { type: i.mime })) };
}

// Ask the Worker to sculpt, rig and animate a figure from an uploaded image. Resolves to the GLB's
// asset id; `onStage` hears each stage name as the job advances.
export async function forge(imageId, onStage) {
  const a = getAccount();
  if (!a || !SYNC_URL) throw new Error("Sign in to forge a figure.");
  const call = (init) => fetch(`${SYNC_URL}/forge/${imageId}?account=${a.id}`, { ...init, headers: { authorization: `Bearer ${a.token}` } })
    .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "The forge is cold."); return d; });
  let job = await call({ method: "POST" });
  while (!job.done) {
    onStage?.(job.stage);
    await new Promise((ok) => setTimeout(ok, 6000));
    job = await call({ method: "GET" });
  }
  return job.done;
}

// ---- object URLs, local first, then the aether ----
const urls = new Map();
export function assetUrl(id) {
  if (!id) return Promise.resolve(null);
  if (!urls.has(id)) urls.set(id, idb("readonly", (s) => s.get(id))
    .then((b) => b || remote(id).then((r) => (r.ok ? r.blob() : null)).then((b) => b && idb("readwrite", (s) => s.put(b, id)).then(() => b)).catch(() => null))
    .then((b) => { const u = b ? URL.createObjectURL(b) : null; if (u) urls.set(id, u); else urls.delete(id); return u; }));
  const u = urls.get(id);
  return typeof u === "string" ? Promise.resolve(u) : u;
}
export function useAssetUrl(id) {
  const [url, setUrl] = useState(() => (typeof urls.get(id) === "string" ? urls.get(id) : null));
  useEffect(() => { let on = true; assetUrl(id).then((u) => on && setUrl(u)); return () => { on = false; }; }, [id]);
  return url;
}
