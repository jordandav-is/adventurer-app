#!/usr/bin/env node
/* Merge the SRD bestiary into public/compendium.json as a `bestiary` key.

   Source: the 5e-bits SRD monster database (CC-BY-4.0) —
   https://github.com/5e-bits/5e-database (src/2014/5e-SRD-Monsters.json),
   also shipped inside the `febdnddata` npm package under
   vendor/5e-database/src/2014/5e-SRD-Monsters.json.

   Usage: drop the source at data/5e-SRD-Monsters.json, run this, commit the
   refreshed public/compendium.json, and delete the source again. */
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

const monsters = JSON.parse(readFileSync(SRC, "utf8"));
const bestiary = monsters.map((m) => {
  const saves = [], skills = [];
  (m.proficiencies || []).forEach((p) => {
    const n = p.proficiency?.name || "";
    if (n.startsWith("Saving Throw:")) saves.push(`${n.slice(13).trim()} +${p.value}`);
    else if (n.startsWith("Skill:")) skills.push(`${n.slice(6).trim()} +${p.value}`);
  });
  return prune({
    name: m.name,
    size: m.size,
    type: m.subtype ? `${m.type} (${m.subtype})` : m.type,
    align: m.alignment,
    cr: m.challenge_rating,
    xp: m.xp,
    ac: (m.armor_class || [])[0]?.value,
    acN: acNote((m.armor_class || [])[0]),
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
  });
}).sort((a, b) => a.name.localeCompare(b.name));

const compendium = JSON.parse(readFileSync(OUT, "utf8"));
compendium.bestiary = bestiary;
writeFileSync(OUT, JSON.stringify(compendium));
console.log(`Baked ${bestiary.length} creatures into ${OUT} (${(JSON.stringify(bestiary).length / 1048576).toFixed(2)} MB of bestiary, ${(JSON.stringify(compendium).length / 1048576).toFixed(1)} MB total)`);
