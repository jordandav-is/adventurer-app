import { ABILITIES, ABIL_NAMES, BACKGROUNDS, BOON_INFO, CLASSES, FIGHTING_STYLES, INVOCATION_DATA, INVOCATION_INFO, MANEUVERS, METAMAGIC, METAMAGIC_INFO, PACT_BOONS, RACES, RACE_LANGS, STYLE_DESC, normSub } from "./data.js";
const uid = () => Math.random().toString(36).slice(2, 10);
let __SRC_OFF = new Set();
let __SOURCES = [];
const setSourceExclusions = (sources) => { __SRC_OFF = sources; };
let __BESTIARY = [];
const SRD_SRC = "System Reference Document 5.1";
const sourceByCode = (code) => __SOURCES.find((source) => source.code === code);
const sourceCodesOf = (record) => {
  if (!record || typeof record !== "object") return [];
  if (Array.isArray(record.sources) && record.sources.length) return record.sources;
  if (sourceByCode(record.src)) return [record.src];
  const named = __SOURCES.find((source) => source.name === record.src || source.name === record.source);
  if (named) return [named.code];
  const legacy = ((record.text || "").match(/Source:\s*([^,\n]+)/) || [])[1]?.trim();
  const legacySource = legacy && __SOURCES.find((source) => source.name === legacy);
  return legacySource ? [legacySource.code] : [];
};
const isSourceEnabled = (record) => {
  const codes = sourceCodesOf(record);
  return !codes.length || codes.some((code) => !__SRC_OFF.has(code));
};
const sourceLabelOf = (record) => {
  if (!record || typeof record !== "object") return "Homebrew & unsourced";
  const code = sourceCodesOf(record)[0];
  return record.source || sourceByCode(code)?.name || record.src || "Homebrew & unsourced";
};
const spellSrcOf = sourceLabelOf;
const creatureSrcOf = sourceLabelOf;
const srcSpells = (list) => list.filter(isSourceEnabled);
const KEY = "dnd-srd-characters-v1";
async function loadChars() {
  try { const r = await window.storage.get(KEY); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveChars(chars) {
  try { await window.storage.set(KEY, JSON.stringify(chars)); } catch (e) { console.error("save failed", e); }
}
const SRCKEY = "dnd-source-prefs-v2";
const defaultSourceExclusions = () => new Set(__SOURCES.filter((source) => !source.defaultEnabled).map((source) => source.code));
const normalizeSourcePrefs = (values) => new Set((values || []).map((value) =>
  sourceByCode(value)?.code || __SOURCES.find((source) => source.name === value)?.code
).filter(Boolean));
async function loadSrcPrefs() {
  try {
    const r = await window.storage.get(SRCKEY);
    return r ? normalizeSourcePrefs(JSON.parse(r.value).off) : defaultSourceExclusions();
  } catch { return defaultSourceExclusions(); }
}
async function saveSrcPrefs(off) {
  try { await window.storage.set(SRCKEY, JSON.stringify({ off: [...off].sort() })); } catch (e) { console.error("save failed", e); }
}
const CKEY = "dnd-custom-content-v1";
const EMPTY_CUSTOM = { subs: {}, feats: [], spells: [], items: [], featureTexts: {} };
let __BASE = null;
const hydrateRuntime = (base) => {
  __SOURCES = Array.isArray(base.sources) ? base.sources : [];
  Object.entries(base.runtime?.classes || {}).forEach(([name, value]) => {
    CLASSES[name] = { ...(CLASSES[name] || {}), ...value };
  });
  Object.assign(RACES, base.runtime?.races || {});
  Object.assign(RACE_LANGS, base.runtime?.raceLangs || {});
  Object.assign(BACKGROUNDS, base.runtime?.backgrounds || {});

  if (Array.isArray(base.runtime?.invocations)) {
    INVOCATION_DATA.length = 0;
    base.runtime.invocations.forEach((inv) => {
      INVOCATION_DATA.push([inv.name, inv.lvl, inv.req, inv.src, inv.sources]);
    });
  }
  if (base.runtime?.invocationInfo) Object.assign(INVOCATION_INFO, base.runtime.invocationInfo);

  if (Array.isArray(base.runtime?.metamagic)) {
    METAMAGIC.length = 0;
    base.runtime.metamagic.forEach((m) => {
      METAMAGIC.push(m.name);
    });
  }
  if (base.runtime?.metamagicInfo) Object.assign(METAMAGIC_INFO, base.runtime.metamagicInfo);

  if (base.runtime?.maneuvers) {
    Object.entries(base.runtime.maneuvers).forEach(([name, m]) => {
      MANEUVERS[name] = m.desc || m;
    });
  }

  if (base.runtime?.fightingStyles) {
    Object.entries(base.runtime.fightingStyles).forEach(([cls, list]) => {
      FIGHTING_STYLES[cls] = list.map((s) => s.name);
    });
  }
  if (base.runtime?.styleDesc) Object.assign(STYLE_DESC, base.runtime.styleDesc);

  if (Array.isArray(base.runtime?.pactBoons)) {
    PACT_BOONS.length = 0;
    base.runtime.pactBoons.forEach((b) => {
      PACT_BOONS.push(b.name);
    });
  }
  if (base.runtime?.boonInfo) Object.assign(BOON_INFO, base.runtime.boonInfo);
};
async function fetchBaseCompendium() {
  if (__BASE) return __BASE;
  try {
    const res = await fetch("compendium.json");
    if (!res.ok) return null;
    __BASE = await res.json();
    hydrateRuntime(__BASE);
    __BESTIARY = Array.isArray(__BASE.bestiary) ? __BASE.bestiary : [];
    if (typeof window !== "undefined") window.__ledgerBase = __BASE;
    return __BASE;
  } catch { return null; }
}
function stripBase(c, base) {
  if (!base) return c;
  const sig = (x) => JSON.stringify(x);
  const bSpells = new Map((base.spells || []).map((x) => [x.name, sig(x)]));
  const bItems = new Map((base.items || []).map((x) => [x.name, sig(x)]));
  const bFeats = new Map((base.feats || []).map((x) => [x.name, sig(x)]));
  const subs = {};
  Object.entries(c.subs || {}).forEach(([cls, arr]) => {
    const bSubs = new Map(((base.subs || {})[cls] || []).map((s) => [s.name, sig(s)]));
    const keep = arr.filter((s) => bSubs.get(s.name) !== sig(s));
    if (keep.length) subs[cls] = keep;
  });
  const bTexts = base.featureTexts || {};
  const featureTexts = {};
  Object.entries(c.featureTexts || {}).forEach(([k, v]) => { if (bTexts[k] !== v) featureTexts[k] = v; });
  return {
    subs,
    feats: (c.feats || []).filter((x) => bFeats.get(x.name) !== sig(x)),
    spells: (c.spells || []).filter((x) => bSpells.get(x.name) !== sig(x)),
    items: (c.items || []).filter((x) => bItems.get(x.name) !== sig(x)),
    featureTexts,
  };
}
async function loadCustom() {
  try { const r = await window.storage.get(CKEY); return r ? JSON.parse(r.value) : EMPTY_CUSTOM; } catch { return EMPTY_CUSTOM; }
}
async function saveCustom(c) {
  try { await window.storage.set(CKEY, JSON.stringify(c)); } catch (e) { console.error("save failed", e); }
}
function exportLedger(chars, customs) {
  const payload = { app: "adventurers-ledger", version: 1, exported: new Date().toISOString(), chars, customs };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adventurers-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function mergeLedger(payload, chars, customs) {
  if (!payload || !Array.isArray(payload.chars)) throw new Error("Not a ledger file");
  const ids = new Set(chars.map((c) => c.id));
  const incoming = payload.chars
    .filter((c) => c && c.name && Array.isArray(c.classes) && c.abilities)
    .map((c) => (ids.has(c.id) ? { ...c, id: uid() } : c));
  const pc = payload.customs || {};
  const mergedCustoms = {
    subs: { ...customs.subs },
    feats: [...customs.feats],
    spells: [...customs.spells],
  };
  for (const [cls, arr] of Object.entries(pc.subs || {})) {
    const have = new Set((mergedCustoms.subs[cls] || []).map((s) => s.name));
    mergedCustoms.subs[cls] = [...(mergedCustoms.subs[cls] || []), ...arr.filter((s) => s?.name && !have.has(s.name))];
  }
  const haveFeats = new Set(mergedCustoms.feats.map((f) => f.name));
  mergedCustoms.feats.push(...(pc.feats || []).filter((f) => f?.name && !haveFeats.has(f.name)));
  const haveSpells = new Set(mergedCustoms.spells.map((s) => s.name));
  mergedCustoms.spells.push(...(pc.spells || []).filter((s) => s?.name && !haveSpells.has(s.name)));
  return { chars: [...chars, ...incoming], customs: mergedCustoms, added: incoming.length };
}
function unionCustoms(base, add) {
  const by = (a = [], b = []) => { const have = new Set(a.map((x) => x?.name)); return [...a, ...b.filter((x) => x?.name && !have.has(x.name))]; };
  const subs = {};
  for (const cls of new Set([...Object.keys(base.subs || {}), ...Object.keys(add.subs || {})])) subs[cls] = by(base.subs?.[cls], add.subs?.[cls]);
  return { subs, feats: by(base.feats, add.feats), spells: by(base.spells, add.spells), items: by(base.items, add.items), featureTexts: { ...add.featureTexts, ...base.featureTexts } };
}
function mergeCompendium(customs, res) {
  const existingSubs = new Set(Object.values(customs.subs || {}).flat().map((x) => x.name));
  const subsIn = {};
  Object.entries(res.subs).forEach(([c, arr]) => { const a = arr.filter((x) => !existingSubs.has(x.name)); if (a.length) subsIn[c] = a; });
  const oldFeats = new Map((customs.feats || []).map((f) => [f.name, f]));
  const featsIn = res.feats.filter((f) => !oldFeats.has(f.name) || (f.text && !oldFeats.get(f.name).text));
  const oldSpells = new Map((customs.spells || []).map((x) => [x.name, x]));
  const spellsIn = res.spells.filter((x) => !oldSpells.has(x.name) || (x.text && !oldSpells.get(x.name).text) || oldSpells.get(x.name).ritual === undefined);
  const oldItems = new Set((customs.items || []).map((x) => x.name));
  const itemsIn = res.items.filter((x) => !oldItems.has(x.name));
  const oldTexts = customs.featureTexts || {};
  const newTexts = Object.keys(res.featureTexts || {}).some((k) => oldTexts[k] !== res.featureTexts[k]);
  const subs = { ...customs.subs };
  Object.entries(subsIn).forEach(([c, arr]) => { subs[c] = [...(subs[c] || []), ...arr]; });
  const inFeats = new Map(featsIn.map((f) => [f.name, f]));
  const feats = [...(customs.feats || []).map((f) => inFeats.get(f.name) || f), ...featsIn.filter((f) => !(customs.feats || []).some((o) => o.name === f.name))];
  const inSpells = new Map(spellsIn.map((x) => [x.name, x]));
  const spells = [...(customs.spells || []).map((s) => inSpells.get(s.name) || s), ...spellsIn.filter((x) => !(customs.spells || []).some((o) => o.name === x.name))];
  return {
    changed: !!(Object.keys(subsIn).length || featsIn.length || spellsIn.length || itemsIn.length || newTexts),
    customs: { subs, feats, spells, items: [...(customs.items || []), ...itemsIn], featureTexts: { ...oldTexts, ...(res.featureTexts || {}) } },
  };
}
function parseCompendiumXML(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not valid XML");
  const out = { subs: {}, feats: [], spells: [], skippedClasses: [], featureTexts: {}, items: [] };

  const keepText = (key, txt) => {
    if (!key || !txt) return;
    if (!out.featureTexts[key] || out.featureTexts[key].length < txt.length) out.featureTexts[key] = txt;
  };
  doc.querySelectorAll("compendium > class").forEach((clsEl) => {
    const clsName = clsEl.querySelector(":scope > name")?.textContent?.trim();
    if (!clsName) return;
    if (!CLASSES[clsName]) { out.skippedClasses.push(clsName); return; }
    const rows = [];
    clsEl.querySelectorAll(":scope > autolevel").forEach((al) => {
      const lvl = +al.getAttribute("level") || 1;
      al.querySelectorAll(":scope > feature").forEach((fe) => {
        const t = fe.querySelector(":scope > name")?.textContent?.trim();
        if (!t) return;
        const txt = [...fe.querySelectorAll(":scope > text")].map((x) => x.textContent).join("\n").replace(/\n{3,}/g, "\n\n").trim();
        rows.push({ lvl, n: t });
        keepText(t, txt);
        const pp = splitParen(t); if (pp) keepText(pp[0], txt);
        const cp = splitColon(t); if (cp) keepText(cp[1], txt);
      });
    });
    const colonPairs = rows.map((r) => ({ ...r, m: splitColon(r.n) })).filter((r) => r.m);
    const parenPairs = rows.map((r) => ({ ...r, m: splitParen(r.n) })).filter((r) => r.m);
    // XML autolevel features use introducer-member patterns (A: Y vs Y: F); normSub matches dropped leading articles and nested group filtering prevents false-positive subclass splits.
    const memberCount = (y) =>
      colonPairs.filter((r) => normSub(r.m[0]) === normSub(y)).length + parenPairs.filter((r) => normSub(r.m[1]) === normSub(y)).length;
    let cands = new Set(colonPairs.map((r) => r.m[1]).filter((y) => memberCount(y) > 0));
    cands = new Set([...cands].filter((y) => colonPairs.some((r) => r.m[1] === y && !cands.has(r.m[0]))));

    const known = new Set(CLASSES[clsName].subs.map(normSub));
    cands.forEach((subName) => {
      if (known.has(normSub(subName))) return;
      known.add(normSub(subName));
      const grouped = {};
      colonPairs.forEach((r) => { if (normSub(r.m[0]) === normSub(subName)) (grouped[r.lvl] = grouped[r.lvl] || []).push(r.m[1]); });
      parenPairs.forEach((r) => { if (normSub(r.m[1]) === normSub(subName)) (grouped[r.lvl] = grouped[r.lvl] || []).push(r.m[0]); });
      if (Object.keys(grouped).length) (out.subs[clsName] = out.subs[clsName] || []).push({ name: subName, feats: grouped });
    });
  });

  doc.querySelectorAll("compendium > race, compendium > background").forEach((el) => {
    const owner = el.querySelector(":scope > name")?.textContent?.trim();
    const bodies = [];
    el.querySelectorAll(":scope > trait").forEach((tr) => {
      const tn = tr.querySelector(":scope > name")?.textContent?.trim();
      const txt = [...tr.querySelectorAll(":scope > text")].map((x) => x.textContent).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!tn || !txt) return;
      if (tn !== "Description") { keepText(tn, txt); const cp = splitColon(tn); if (cp) keepText(cp[1], txt); }
      bodies.push(tn === "Description" ? txt : `${tn}: ${txt}`);
    });
    if (owner && bodies.length) keepText(owner, bodies.join("\n\n"));
  });

  doc.querySelectorAll("compendium > item").forEach((it) => {
    const name = it.querySelector(":scope > name")?.textContent?.trim();
    if (!name) return;
    const grab = (tag) => it.querySelector(`:scope > ${tag}`)?.textContent?.trim() || "";
    const text = [...it.querySelectorAll(":scope > text")].map((t) => t.textContent).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500);
    out.items.push({
      name, type: grab("type"), weight: +grab("weight") || 0, value: grab("value"),
      ac: +grab("ac") || 0, strReq: +grab("strength") || 0, stealthDis: grab("stealth") === "1",
      dmg1: grab("dmg1"), dmg2: grab("dmg2"), dmgType: grab("dmgType"), property: grab("property"), range: grab("range"), text,
    });
  });

  doc.querySelectorAll("compendium > feat").forEach((fe) => {
    const name = fe.querySelector(":scope > name")?.textContent?.trim();
    if (!name) return;
    const full = [...fe.querySelectorAll(":scope > text")].map((t) => t.textContent.trim()).filter(Boolean).join("\n").trim();
    const flat = full.replace(/\s+/g, " ");
    const prereq = fe.querySelector(":scope > prerequisite")?.textContent?.trim() || "";
    const bm = flat.match(/increase your ([^.]{3,60}?) score by 1/i);
    const bump = bm ? ABILITIES.filter((a) => new RegExp(ABIL_NAMES[a], "i").test(bm[1])) : [];
    out.feats.push({ name, desc: flat.slice(0, 160), prereq, bump, text: full });
  });
  return out;
}
if (typeof window !== "undefined") window.__parseCompendium = parseCompendiumXML;
export { __SRC_OFF, __SOURCES, __BESTIARY, SRD_SRC, sourceCodesOf, sourceLabelOf, isSourceEnabled, spellSrcOf, creatureSrcOf, srcSpells, setSourceExclusions, loadChars, saveChars, loadSrcPrefs, saveSrcPrefs, EMPTY_CUSTOM, __BASE, fetchBaseCompendium, stripBase, loadCustom, saveCustom, exportLedger, mergeLedger, unionCustoms, mergeCompendium, parseCompendiumXML, uid };
