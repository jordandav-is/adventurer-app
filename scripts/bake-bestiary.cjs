#!/usr/bin/env node
/* Merge the SRD bestiary into public/compendium.json as a `bestiary` key.

   Source: the 5e-bits SRD monster database (CC-BY-4.0) —
   https://github.com/5e-bits/5e-database (src/2014/5e-SRD-Monsters.json),
   also shipped inside the `febdnddata` npm package under
   vendor/5e-database/src/2014/5e-SRD-Monsters.json.

   Usage: drop the source at data/5e-SRD-Monsters.json, run this, commit the
   refreshed public/compendium.json, and delete the source again.
   NOTE: this writes the SRD base layer and REPLACES the bestiary key — run
   scripts/bake-sources.cjs afterwards to re-add the other sourcebooks. */
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "data", "5e-SRD-Monsters.json");
const OUT = join(ROOT, "public", "compendium.json");

if (!existsSync(SRC)) { console.error(`No source at ${SRC}`); process.exit(1); }
if (!existsSync(OUT)) { console.error(`No compendium at ${OUT} — bake it first.`); process.exit(1); }

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (arr) => (arr && arr.length ? arr.map(cap).join(", ") : undefined);
const speedStr = (sp) => Object.entries(sp || {}).map(([k, v]) => (k === "walk" ? v : `${k} ${v}`)).join(", ");
const sensesStr = (sn) => Object.entries(sn || {}).map(([k, v]) => (k === "passive_perception" ? `passive Perception ${v}` : `${k.replace(/_/g, " ")} ${v}`)).join(", ");
const acNote = (e) => {
  if (!e) return undefined;
  if (e.type === "natural") return "natural armor";
  if (e.type === "armor") return (e.armor || []).map((a) => a.name.toLowerCase()).join(", ") || "armor";
  if (e.type === "spell") return e.spell ? `with ${e.spell.name}` : "spell";
  if (e.type === "condition") return e.condition ? `while ${e.condition.name.toLowerCase()}` : undefined;
  return undefined;
};
const entries = (arr) => (arr && arr.length ? arr.map((a) => ({ n: a.name, t: String(a.desc || "").trim() })).filter((x) => x.n && x.t) : undefined);
const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null));
/* A creature's real AC is its best-equipped line (Azer and Lizardfolk list a bare
   line first, then the with-shield one) — but spell and condition lines (a mage's
   mage armor, a dryad's barkskin) are situational and only annotate the note. */
const acPick = (arr) => {
  if (!arr || !arr.length) return { value: undefined, note: undefined };
  const situational = (a) => a.type === "spell" || a.type === "condition";
  const solid = arr.filter((a) => !situational(a));
  const pool = solid.length ? solid : arr;
  const best = pool.reduce((a, b) => (b.value > a.value ? b : a));
  const notes = [...new Set([
    ...solid.map(acNote).filter(Boolean),
    ...arr.filter(situational).map((a) => `${a.value} ${acNote(a)}`),
  ])];
  return { value: best.value, note: notes.join(", ") || undefined };
};
/* Upstream 5e-bits errors, corrected against the printed stat blocks (verified via
   the 5etools-src v2.32.1 bestiary): Basilisk AC and Cult Fanatic hit points. */
const OVERRIDES = {
  Basilisk: { ac: 15, acN: "natural armor" },
  "Cult Fanatic": { hp: 33, hd: "6d8+6" },
};

const monsters = JSON.parse(readFileSync(SRC, "utf8"));
const bestiary = monsters.map((m) => {
  const saves = [], skills = [];
  (m.proficiencies || []).forEach((p) => {
    const n = p.proficiency?.name || "";
    if (n.startsWith("Saving Throw:")) saves.push(`${n.slice(13).trim()} +${p.value}`);
    else if (n.startsWith("Skill:")) skills.push(`${n.slice(6).trim()} +${p.value}`);
  });
  const acBest = acPick(m.armor_class);
  return prune({
    name: m.name,
    size: m.size,
    type: m.subtype ? `${m.type} (${m.subtype})` : m.type,
    align: m.alignment,
    cr: m.challenge_rating,
    xp: m.xp,
    ac: acBest.value,
    acN: acBest.note,
    hp: m.hit_points,
    hd: m.hit_points_roll || m.hit_dice,
    spd: speedStr(m.speed),
    ab: { str: m.strength, dex: m.dexterity, con: m.constitution, int: m.intelligence, wis: m.wisdom, cha: m.charisma },
    saves: saves.join(", ") || undefined,
    skills: skills.join(", ") || undefined,
    vuln: list(m.damage_vulnerabilities),
    res: list(m.damage_resistances),
    imm: list(m.damage_immunities),
    cond: (m.condition_immunities || []).map((c) => c.name).join(", ") || undefined,
    sen: sensesStr(m.senses),
    lang: m.languages || undefined,
    traits: entries(m.special_abilities),
    acts: entries(m.actions),
    reacts: entries(m.reactions),
    leg: entries(m.legendary_actions),
    ...(OVERRIDES[m.name] || {}),
  });
}).sort((a, b) => a.name.localeCompare(b.name));

const compendium = JSON.parse(readFileSync(OUT, "utf8"));
compendium.bestiary = bestiary;
writeFileSync(OUT, JSON.stringify(compendium));
console.log(`Baked ${bestiary.length} creatures into ${OUT} (${(JSON.stringify(bestiary).length / 1048576).toFixed(2)} MB of bestiary, ${(JSON.stringify(compendium).length / 1048576).toFixed(1)} MB total)`);
