#!/usr/bin/env node
/* Second bake stage: merge pre-2024 sourcebook content (spells + creatures) into
   public/compendium.json from 5etools-src data (verified against v2.32.1).

   Source: https://github.com/5etools-mirror-3/5etools-src (data/spells, data/bestiary).
   Usage: drop the JSON files at data/5etools/spells/*.json, data/5etools/bestiary/*.json
   and data/5etools/spell-sources.json, run scripts/bake-bestiary.cjs first (SRD base),
   then this, commit public/compendium.json, and delete the sources again.

   Rules: existing spell names and SRD-baked creatures are never overwritten; among the
   added creatures, later-published sources win (MPMM over VGM/MTF). Everything is
   flattened to the app's plain-text formats. */
const { readFileSync, writeFileSync, existsSync, readdirSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "data", "5etools");
const OUT = join(ROOT, "public", "compendium.json");

/* Publication order = merge order; later entries override earlier ADDED ones. */
const SPELL_SOURCES = ["PHB", "SCAG", "XGE", "GGR", "AI", "EGW", "IDRotF", "LLK", "TCE", "FTD", "SCC", "AAG", "SatO", "BMT"];
const BEAST_SOURCES = ["MM", "VGM", "MTF", "MFF", "GGR", "AI", "ERLW", "EGW", "MOT", "TCE", "VRGR", "FTD", "MPMM", "SCC", "BAM", "BGG", "MPP", "BMT"];
const SOURCE_NAMES = {
  PHB: "Player's Handbook", SCAG: "Sword Coast Adventurer's Guide", XGE: "Xanathar's Guide to Everything",
  GGR: "Guildmasters' Guide to Ravnica", AI: "Acquisitions Incorporated", EGW: "Explorer's Guide to Wildemount",
  IDRotF: "Icewind Dale: Rime of the Frostmaiden", LLK: "Lost Laboratory of Kwalish",
  TCE: "Tasha's Cauldron of Everything", FTD: "Fizban's Treasury of Dragons", SCC: "Strixhaven: A Curriculum of Chaos",
  AAG: "Astral Adventurer's Guide", SatO: "Sigil and the Outlands", BMT: "The Book of Many Things",
  MM: "Monster Manual", VGM: "Volo's Guide to Monsters", MTF: "Mordenkainen's Tome of Foes",
  MFF: "Mordenkainen's Fiendish Folio", ERLW: "Eberron: Rising from the Last War", MOT: "Mythic Odysseys of Theros",
  VRGR: "Van Richten's Guide to Ravenloft", MPMM: "Mordenkainen Presents: Monsters of the Multiverse",
  BAM: "Boo's Astral Menagerie", BGG: "Bigby Presents: Glory of the Giants", MPP: "Morte's Planar Parade",
};

/* ---- 5etools rich text -> plain text ---- */
const stripTags = (s) => {
  let t = String(s ?? "");
  for (let i = 0; i < 6 && t.includes("{@"); i++) {
    t = t.replace(/\{@(\w+)(?: ([^{}]*))?\}/g, (_, tag, body = "") => {
      const parts = body.split("|");
      if (tag === "chance") return `${parts[0]} percent`;
      if (tag === "recharge") return parts[0] ? `(Recharge ${parts[0]}–6)` : "(Recharge 6)";
      if (tag === "h") return "Hit: ";
      if (tag === "atk" || tag === "atkr") return { m: "Melee Attack:", r: "Ranged Attack:", "m,r": "Melee or Ranged Attack:", mw: "Melee Weapon Attack:", rw: "Ranged Weapon Attack:", "mw,rw": "Melee or Ranged Weapon Attack:", ms: "Melee Spell Attack:", rs: "Ranged Spell Attack:", "ms,rs": "Melee or Ranged Spell Attack:" }[parts[0]] || "Attack:";
      if (tag === "hitYourSpellAttack") return "your spell attack modifier";
      if (tag === "dcYourSpellSave") return "your spell save DC";
      if (tag === "dc") return parts[0] || "";
      return (parts[2] && parts[2].trim()) || parts[0] || "";
    });
  }
  return t.replace(/\bsummonSpellLevel\b/g, "the spell's level");
};
function renderEntries(e, out) {
  if (typeof e === "string" || typeof e === "number") out.push(stripTags(e));
  else if (Array.isArray(e)) e.forEach((x) => renderEntries(x, out));
  else if (e && typeof e === "object") {
    if (e.type === "list") (e.items || []).forEach((i) => { const t = []; renderEntries(i, t); out.push("• " + t.join(" ")); });
    else if (e.type === "table") {
      if (e.caption) out.push(stripTags(e.caption) + ":");
      if (e.colLabels) out.push(e.colLabels.map(stripTags).join(" | "));
      (e.rows || []).forEach((r) => out.push(r.map((c) => {
        if (c && typeof c === "object") return c.roll ? (c.roll.exact ?? `${c.roll.min}–${c.roll.max}`) : stripTags(c.entry || "");
        return stripTags(c);
      }).join(" | ")));
    } else if (e.name) { const t = []; renderEntries(e.entries || e.entry || [], t); out.push(`${stripTags(e.name)}. ${t.join("\n")}`); }
    else renderEntries(e.entries || e.entry || e.items || [], out);
  }
}
const renderText = (entries) => { const out = []; renderEntries(entries, out); return out.join("\n"); };

/* ---- spells ---- */
const SCHOOL_MAP = { A: "A", C: "C", D: "D", E: "EN", V: "EV", I: "I", N: "N", T: "T", P: "EV" };
const timeStr = (arr) => (arr || []).map((t) => `${t.number} ${t.unit}${t.condition ? `, ${stripTags(t.condition)}` : ""}`).join(" or ");
const distStr = (d) => (!d ? "" : d.type === "self" ? "Self" : d.type === "touch" ? "Touch" : d.type === "sight" ? "Sight" : d.type === "unlimited" ? "Unlimited" : `${d.amount} ${d.type}`);
const rangeStr = (r) => {
  if (!r) return "";
  if (r.type === "special") return "Special";
  if (r.type === "point") return distStr(r.distance);
  const a = r.distance?.amount;
  return `Self (${a}-${(r.distance?.type || "foot").replace(/^feet$/, "foot").replace(/^miles?$/, "mile")} ${r.type})`;
};
const compStr = (c) => [c?.v && "V", c?.s && "S", c?.m && `M (${typeof c.m === "object" ? stripTags(c.m.text) : stripTags(c.m)})`].filter(Boolean).join(", ");
const durStr = (arr) => (arr || []).map((d) => {
  if (d.type === "instant") return "Instantaneous";
  if (d.type === "special") return "Special";
  if (d.type === "permanent") return `Until dispelled${(d.ends || []).includes("trigger") ? " or triggered" : ""}`;
  if (d.type === "timed") { const u = d.duration || {}; const n = u.amount; return `${d.concentration ? "Concentration, up to " : ""}${n} ${u.type}${n > 1 ? "s" : ""}`; }
  return "";
}).join(" or ");

function convertSpell(sp, classIndex) {
  const cls = classIndex.get(`${sp.source}|${sp.name.toLowerCase()}`) || [];
  const body = [renderText(sp.entries || []), sp.entriesHigherLevel ? renderText(sp.entriesHigherLevel) : ""].filter(Boolean).join("\n");
  return {
    name: sp.name,
    level: sp.level,
    school: SCHOOL_MAP[sp.school] || sp.school,
    classes: cls.join(", "),
    time: timeStr(sp.time),
    range: rangeStr(sp.range),
    components: compStr(sp.components),
    duration: durStr(sp.duration),
    ritual: !!sp.meta?.ritual,
    text: `${body}\n\nSource: ${SOURCE_NAMES[sp.source] || sp.source}${sp.page ? `, p. ${sp.page}` : ""}`,
  };
}

/* ---- creatures ---- */
const SIZE_MAP = { F: "Medium", D: "Medium", T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
const ALIGN_MAP = { L: "lawful", C: "chaotic", NX: "neutral", NY: "neutral", N: "neutral", G: "good", E: "evil", U: "unaligned", A: "any alignment" };
const alignStr = (a) => {
  if (!Array.isArray(a) || !a.length) return undefined;
  if (a[0] && typeof a[0] === "object") return a[0].alignment ? alignStr(a[0].alignment) : undefined;
  const words = a.map((x) => ALIGN_MAP[x]).filter(Boolean);
  const dedup = [...new Set(words)];
  return (dedup.length === 2 && dedup[0] === "neutral" && dedup[1] === "neutral" ? ["neutral"] : dedup).join(" ") || undefined;
};
const XP_BY_CR = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
const crNum = (c) => {
  const s = typeof c === "object" && c ? c.cr : c;
  if (s == null) return undefined;
  if (s === "1/8") return 0.125; if (s === "1/4") return 0.25; if (s === "1/2") return 0.5;
  const n = +s; return Number.isFinite(n) ? n : undefined;
};
const typeStr = (t) => (typeof t === "string" ? t : t?.type ? `${typeof t.type === "string" ? t.type : "creature"}${Array.isArray(t.tags) && t.tags.length ? ` (${t.tags.filter((x) => typeof x === "string").join(", ")})` : ""}` : "creature");
const speedStr = (sp) => {
  if (!sp) return "";
  return Object.entries(sp).filter(([k]) => ["walk", "burrow", "climb", "fly", "swim"].includes(k)).map(([k, v]) => {
    const n = typeof v === "object" ? v.number : v;
    const cond = typeof v === "object" && v.condition ? ` ${stripTags(v.condition)}` : "";
    return `${k === "walk" ? "" : k + " "}${n} ft.${cond}`;
  }).join(", ") + (sp.canHover ? " (hover)" : "");
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dmgList = (arr) => (arr && arr.length ? arr.map((x) => (typeof x === "string" ? cap(x) : x && typeof x === "object" ? [x.preNote, (x.resist || x.immune || x.vulnerable || []).map(cap).join(", "), x.note].filter(Boolean).join(" ") : "")).filter(Boolean).join("; ") : undefined);
const acPick = (arr) => {
  if (!Array.isArray(arr) || !arr.length) return {};
  const norm = arr.map((a) => (typeof a === "number" ? { ac: a } : a)).filter((a) => a && a.ac != null);
  if (!norm.length) return {};
  const solid = norm.filter((a) => !a.condition);
  const best = (solid.length ? solid : norm).reduce((a, b) => (b.ac > a.ac ? b : a));
  const notes = [...new Set([
    ...(best.from || []).map(stripTags),
    ...norm.filter((a) => a.condition).map((a) => `${a.ac} ${stripTags(a.condition)}`),
  ])];
  return { value: best.ac, note: notes.join(", ") || undefined };
};
const namedEntries = (arr) => (arr && arr.length ? arr.map((x) => ({ n: stripTags(x.name || ""), t: renderText(x.entries || []) })).filter((x) => x.n && x.t) : undefined);
function spellcastingTraits(sc) {
  if (!Array.isArray(sc)) return [];
  return sc.map((s) => {
    const lines = [renderText(s.headerEntries || [])];
    if (s.will) lines.push("At will: " + s.will.map(stripTags).join(", "));
    Object.entries(s.daily || {}).forEach(([k, arr]) => lines.push(`${k.replace("e", "")}/day${k.endsWith("e") ? " each" : ""}: ` + arr.map(stripTags).join(", ")));
    Object.entries(s.spells || {}).forEach(([lvl, o]) => lines.push(`${lvl === "0" ? "Cantrips (at will)" : `Level ${lvl}${o.slots ? ` (${o.slots} slots)` : ""}`}: ` + (o.spells || []).map(stripTags).join(", ")));
    if (s.footerEntries) lines.push(renderText(s.footerEntries));
    return { n: stripTags(s.name || "Spellcasting"), t: lines.filter(Boolean).join("\n") };
  });
}
const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null));

function convertMonster(m) {
  const cr = crNum(m.cr);
  /* Summon-spirit blocks state AC and HP as slot formulas ("11 + the level of the
     spell") — keep the formula text alongside a parsed base number. */
  const acSpecial = (m.ac || []).find((a) => a && typeof a === "object" && a.special);
  const acBest = acSpecial ? { value: parseInt(acSpecial.special, 10) || undefined, note: undefined } : acPick(m.ac);
  const acS = acSpecial ? stripTags(acSpecial.special) : undefined;
  const hpS = m.hp?.special ? stripTags(m.hp.special) : undefined;
  const hp = m.hp?.average ?? (hpS ? parseInt(hpS, 10) || 1 : undefined);
  const traits = [...(namedEntries(m.trait) || []), ...spellcastingTraits(m.spellcasting)];
  const acts = [...(namedEntries(m.action) || []), ...(namedEntries(m.bonus) || []).map((x) => ({ n: `${x.n} (Bonus Action)`, t: x.t }))];
  return prune({
    name: m.name,
    size: SIZE_MAP[(m.size || ["M"])[0]] || "Medium",
    type: typeStr(m.type),
    align: alignStr(m.alignment),
    cr,
    xp: cr != null ? XP_BY_CR[cr] : undefined,
    ac: acBest.value,
    acN: acBest.note,
    acS,
    hp,
    hpS,
    hd: m.hp?.formula ? m.hp.formula.replace(/\s/g, "") : undefined,
    spd: speedStr(m.speed),
    ab: { str: m.str, dex: m.dex, con: m.con, int: m.int, wis: m.wis, cha: m.cha },
    saves: m.save ? Object.entries(m.save).map(([k, v]) => `${cap(k)} ${stripTags(v)}`).join(", ") : undefined,
    skills: m.skill ? Object.entries(m.skill).filter(([k]) => k !== "other").map(([k, v]) => `${cap(k)} ${stripTags(String(v))}`).join(", ") : undefined,
    vuln: dmgList(m.vulnerable),
    res: dmgList(m.resist),
    imm: dmgList(m.immune),
    cond: dmgList(m.conditionImmune),
    sen: [(m.senses || []).map(stripTags).join(", "), m.passive != null ? `passive Perception ${m.passive}` : ""].filter(Boolean).join(", "),
    lang: (m.languages || []).map(stripTags).join(", ") || undefined,
    traits: traits.length ? traits : undefined,
    acts: acts.length ? acts : undefined,
    reacts: namedEntries(m.reaction),
    leg: namedEntries(m.legendary),
    src: SOURCE_NAMES[m.source] || m.source,
  });
}

/* ---- merge ---- */
if (!existsSync(SRC)) { console.error(`No source data at ${SRC}`); process.exit(1); }
const compendium = JSON.parse(readFileSync(OUT, "utf8"));

const classIndex = new Map();
const srcMapPath = join(SRC, "spell-sources.json");
if (existsSync(srcMapPath)) {
  const srcMap = JSON.parse(readFileSync(srcMapPath, "utf8"));
  Object.entries(srcMap).forEach(([source, spells]) => Object.entries(spells).forEach(([name, o]) => {
    const names = [...new Set([...(o.class || []), ...(o.classVariant || [])].map((c) => c.name))];
    if (names.length) classIndex.set(`${source}|${name.toLowerCase()}`, names);
  }));
}

const haveSpells = new Set((compendium.spells || []).map((s) => s.name.toLowerCase()));
let addedSpells = 0;
for (const code of SPELL_SOURCES) {
  const p = join(SRC, "spells", `spells-${code.toLowerCase()}.json`);
  if (!existsSync(p)) continue;
  for (const sp of JSON.parse(readFileSync(p, "utf8")).spell || []) {
    if (sp.source !== code || haveSpells.has(sp.name.toLowerCase())) continue;
    compendium.spells.push(convertSpell(sp, classIndex));
    haveSpells.add(sp.name.toLowerCase());
    addedSpells++;
  }
}

const srdNames = new Set((compendium.bestiary || []).map((b) => b.name.toLowerCase()));
const added = new Map();
let skippedCopies = 0;
for (const code of BEAST_SOURCES) {
  const p = join(SRC, "bestiary", `bestiary-${code.toLowerCase()}.json`);
  if (!existsSync(p)) continue;
  for (const m of JSON.parse(readFileSync(p, "utf8")).monster || []) {
    if (m.source !== code) continue;
    if (m._copy) { skippedCopies++; continue; }
    const key = m.name.toLowerCase();
    if (srdNames.has(key)) continue; // the verified SRD block stays canonical
    const c = convertMonster(m);
    if ((c.hp == null && !c.hpS) || (c.ac == null && !c.acS) || c.ab.str == null) continue; // stubs without a real block
    added.set(key, c); // later-published sources override earlier added versions
  }
}
compendium.bestiary = [...(compendium.bestiary || []), ...added.values()].sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(OUT, JSON.stringify(compendium));
console.log(`Added ${addedSpells} spells (total ${compendium.spells.length}) and ${added.size} creatures (total ${compendium.bestiary.length}; ${skippedCopies} _copy variants skipped). Compendium: ${(JSON.stringify(compendium).length / 1048576).toFixed(1)} MB.`);
