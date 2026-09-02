import { ABILITIES, ABILITY_INFO, ABIL_NAMES, ANCESTRIES, ASI, BACKGROUNDS, BOON_INFO, CASTING_CLASSES, CHOICE_GROUPS, CLASSES, CLASS_GEAR_PROFS, CORE_FEATURE_INFO, DMG_TYPES, DMG_WORD_CODE, FEATS, FEATURE_TEXT, FEAT_INDEX, FEAT_MECHANICS, FEAT_PICKS, GRANTED_SUB_CLASSES, GRANT_CANTRIPS, HALF1_SLOTS, HALF_SLOTS, HEALING_TIERS, INVOCATION_DATA, INVOCATION_INFO, ITEM_TYPES, LAND_TERRAINS, LANG_INFO, MANEUVERS, MC_GEAR_PROFS, MC_PREREQ, MC_PROFS, MC_SLOTS, METAMAGIC_INFO, PACT, POTION_EFFECT_ALIAS, PROF_TEXT, RACES, RANGER_PREPARED, SCHOOL_NAMES, SIZE_RANK, SKILL_ABIL, SKILL_INFO, SOURCE_ABBR, SPELLS_KNOWN, SPELL_ABILITY, SRD_FOOT, STYLE_DESC, SUB_FEATS, SUB_LORE, SUB_SPELLS, TEXT_2024, WEAPON_PROPS, baseSubName, normSub, subFeatsFor } from "./data.js";
import { EMPTY_CUSTOM, __BASE, __BESTIARY, __SRC_OFF, creatureSrcOf, isSourceEnabled, sourceLabelOf, srcSpells, stripBase } from "./compendium.js";
const mod = (s) => Math.floor((s - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);
const profBonus = (lvl) => Math.ceil(lvl / 4) + 1;
const subTokens = (subclass) => {
  const toks = [normSub(baseSubName(subclass))];
  const m = (subclass || "").match(/\(([^)]+)\)$/);
  if (m) toks.push(normSub(m[1]));
  return toks;
};
function subSpellData(subclass, clsName, customs) {
  if (!subclass) return null;
  const base = baseSubName(subclass);
  if (base === "Circle of the Land") {
    const m = subclass.match(/\(([^)]+)\)/);
    const terr = m && LAND_TERRAINS[m[1]];
    return terr ? { type: "granted", label: `Circle spells — ${m[1]} (always prepared)`, spells: terr } : null;
  }
  if (SUB_SPELLS[base]) return SUB_SPELLS[base];
  if (!clsName || !customs) return null;
  const toks = subTokens(subclass);
  const tagged = (customs.spells || []).filter((sp) => (sp.classes || "").split(",").some((e) => {
    const m = e.trim().match(/^(.+?)\s*\(([^)]+)\)$/);
    return m && m[1].trim().toLowerCase() === clsName.toLowerCase() && toks.includes(normSub(m[2]));
  }));
  if (!tagged.length) return null;
  const grantedLabel = GRANTED_SUB_CLASSES[clsName];
  const spells = {};
  tagged.forEach((sp) => {
    let at = 1;
    while (at < 20 && maxSpellLevel(clsName, at) < sp.level) at++;
    (spells[at] = spells[at] || []).push(sp.name);
  });
  Object.values(spells).forEach((arr) => arr.sort());
  return grantedLabel
    ? { type: "granted", label: `${grantedLabel} — ${base} (always prepared)`, spells }
    : { type: "expanded", label: `Expanded spell list — ${base} (added to your ${clsName} options)`, spells };
}
const meetsPrereq = (cls, ab) => (MC_PREREQ[cls] || [{ int: 13 }]).some((req) => Object.entries(req).every(([k, v]) => ab[k] >= v));
function featureBody(rawName, cls, customs) {
  const name = String(rawName || "").trim();
  const strip = baseSubName(name);
  const ft = customs?.featureTexts || {};
  if (cls === "Ranger" && TEXT_2024.has(strip)) return FEATURE_TEXT[strip] || FEATURE_TEXT[name] || ft[name] || ft[strip];
  return (cls && (ft[`${cls}:${name}`] || ft[`${cls}:${strip}`] || FEATURE_TEXT[`${cls}:${name}`] || FEATURE_TEXT[`${cls}:${strip}`]))
    || ft[name] || ft[strip]
    || FEATURE_TEXT[name] || FEATURE_TEXT[strip]
    || CORE_FEATURE_INFO[strip]
    || (/\bfeature\b$/i.test(strip) ? "Granted by your subclass at this level — read its entry for the details." : null);
}
const featChoiceOf = (ch, name) => {
  const choices = ch?.featChoices || {};
  if (choices[name]) return choices[name];
  const targetNorm = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = Object.entries(choices).find(([k]) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "") === targetNorm);
  return hit ? hit[1] : {};
};
function featEffects(ch, customs) {
  const out = { hpPerLevel: 0, speed: 0, init: null, saves: [], mediumDexCap: 2, styles: [], sources: [] };
  const feats = allFeats(customs || EMPTY_CUSTOM);
  (ch?.feats || []).forEach((n) => {
    const normN = String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const def = feats.find((f) => String(f.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normN);
    const fxKey = Object.keys(FEAT_MECHANICS).find((k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "") === normN);
    const f = def?.fx || (fxKey ? FEAT_MECHANICS[fxKey] : null);
    if (!f) return;
    if (f.hpPerLevel) { out.hpPerLevel += f.hpPerLevel; out.sources.push(n); }
    if (f.speed) { out.speed += f.speed; out.sources.push(n); }
    if (f.mediumDexCap) out.mediumDexCap = Math.max(out.mediumDexCap, f.mediumDexCap);
    if (f.style) out.styles.push(f.style);
    if (f.save) out.saves.push({ abil: f.save, from: n });
    if (f.saveFromBump) { const b = featChoiceOf(ch, n).bump; if (b) out.saves.push({ abil: b, from: n }); }
    if (f.init) {
      const flat = (def?.text || "").match(/\+\s*(\d+)\s*bonus to initiative/i);
      out.init = { label: n, value: flat ? +flat[1] : profBonus(totalLevel(ch)) };
    }
  });
  return out;
}
const hasStyle = (ch, name) => (ch?.styles || []).includes(name) || (ch?.feats || []).includes(`Fighting Style: ${name}`);
const featHpBonus = (ch) => featEffects(ch).hpPerLevel * totalLevel(ch);
function featBlockedBy(def, { abilities, level, caster }) {
  if (!def) return null;
  if (def.lvl && level < def.lvl) return `needs character level ${def.lvl}`;
  if (def.caster && !caster) return "needs a spellcasting feature";
  if (def.min && ABILITIES.some((a) => def.min[a] && (abilities?.[a] ?? 0) < def.min[a]))
    return "needs " + ABILITIES.filter((a) => def.min[a]).map((a) => `${a.toUpperCase()} ${def.min[a]}`).join(" & ");
  if (def.minAny) {
    const opts = ABILITIES.filter((a) => def.minAny[a]);
    if (opts.length && !opts.some((a) => (abilities?.[a] ?? 0) >= def.minAny[a]))
      return "needs " + opts.map((a) => `${a.toUpperCase()} ${def.minAny[a]}`).join(" or ");
  }
  return null;
}
const featPickOf = (name, def) => {
  if (def?.pick) return def.pick;
  const normN = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const pkKey = Object.keys(FEAT_PICKS).find((k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "") === normN);
  return pkKey ? FEAT_PICKS[pkKey] : null;
};
function featGrantedSpells(name, level = 20, def) {
  const g = featPickOf(name, def)?.spells?.grant;
  if (!g) return [];
  if (Array.isArray(g)) return g;
  return Object.entries(g).filter(([l]) => level >= +l).flatMap(([, arr]) => arr);
}
function raceGrantedSpells(ch) {
  const g = RACES[ch?.race]?.grantSpells;
  if (!g) return [];
  const lvl = totalLevel(ch);
  return Object.entries(g).filter(([l]) => lvl >= +l).flatMap(([, arr]) => arr);
}
function featSpellsOf(ch) {
  const lvl = totalLevel(ch);
  return (ch?.feats || []).map((n) => {
    const c = featChoiceOf(ch, n);
    return { feat: n, names: [...featGrantedSpells(n, lvl), ...(c.cantrips || []), ...(c.spells || [])] };
  }).filter((e) => e.names.length);
}
function featPickDone(def, v) {
  if (!v?.name) return false;
  if (def?.bump?.length && !v.bump) return false;
  const pk = featPickOf(v.name, def);
  if (!pk) return true;
  if (pk.skills?.n && (v.skills || []).length !== pk.skills.n) return false;
  if (pk.expertise?.n && (v.expertise || []).length !== pk.expertise.n) return false;
  if (pk.langs?.n && (v.langs || []).length !== pk.langs.n) return false;
  if (pk.choice && !v.choice) return false;
  if (pk.spells?.cantrips && (v.cantrips || []).length !== pk.spells.cantrips) return false;
  if (pk.spells?.level1 && (v.spells || []).length !== pk.spells.level1) return false;
  if (pk.maneuvers?.n && (v.maneuvers || []).length !== pk.maneuvers.n) return false;
  return true;
}
function spellCapacity(clsName, clsLevel, abilities) {
  const m = mod(abilities[SPELL_ABILITY[clsName]]);
  switch (clsName) {
    case "Bard": case "Sorcerer": case "Warlock":
      return { n: SPELLS_KNOWN[clsName][clsLevel - 1], label: "spells known" };
    case "Ranger":
      return { n: RANGER_PREPARED[clsLevel - 1], label: "spells prepared (full ranger list available)" };
    case "Cleric": case "Druid":
      return { n: Math.max(1, m + clsLevel), label: "spells prepared (ability mod + level; full class list available)" };
    case "Paladin":
      return { n: clsLevel < 2 ? 0 : Math.max(1, m + Math.floor(clsLevel / 2)), label: "spells prepared (Cha mod + half level)" };
    case "Artificer":
      return { n: Math.max(1, m + Math.floor(clsLevel / 2)), label: "spells prepared (Int mod + half level)" };
    case "Wizard":
      return { n: 6 + 2 * (clsLevel - 1), label: `spellbook spells (prepare Int mod + level = ${Math.max(1, m + clsLevel)}/day)` };
    default: return { n: 0, label: "" };
  }
}
function maxSpellLevel(clsName, clsLevel) {
  const c = CLASSES[clsName].caster;
  if (c === "full") return clsLevel >= 1 ? Math.min(9, Math.ceil(clsLevel / 2)) : 0;
  if (c === "half") return clsLevel >= 2 ? Math.min(5, Math.ceil(clsLevel / 4)) : 0;
  if (c === "half1") return Math.min(5, Math.max(1, Math.ceil(clsLevel / 4)));
  if (c === "pact") return PACT(clsLevel).lvl;
  return 0;
}
function foldStarredSpells(spells) {
  const tok = (s) => (s || "").split(",").map((t) => t.trim()).filter(Boolean);
  const plainNames = new Set(spells.filter((sp) => !sp.name.endsWith("*")).map((sp) => sp.name));
  const extras = new Map();
  const kept = [];
  spells.forEach((sp) => {
    const plain = sp.name.replace(/\*+$/, "");
    if (plain !== sp.name && plainNames.has(plain)) {
      extras.set(plain, [...(extras.get(plain) || []), ...tok(sp.classes)]);
      return;
    }
    kept.push(sp);
  });
  if (!extras.size) return spells;
  return kept.map((sp) => {
    const ex = extras.get(sp.name);
    if (!ex) return sp;
    const have = tok(sp.classes);
    const add = [...new Set(ex)].filter((t) => !have.includes(t));
    return add.length ? { ...sp, classes: [...have, ...add].join(", ") } : sp;
  });
}
const spellFitsClass = (sp, clsName, subclass) => {
  const want = clsName.toLowerCase();
  const toks = subclass ? subTokens(subclass) : [];
  return (sp.classes || "").split(",").some((entry) => {
    const m = entry.trim().match(/^(.+?)(?:\s*\(([^)]*)\))?$/);
    if (!m || m[1].trim().toLowerCase() !== want) return false;
    return !m[2] || toks.includes(normSub(m[2]));
  });
};
function spellSlots(classes) {
  const casters = classes.filter((c) => ["full", "half", "half1"].includes(CLASSES[c.name].caster));
  if (!casters.length) return null;
  if (casters.length === 1 && CLASSES[casters[0].name].caster === "half") return HALF_SLOTS[casters[0].level - 1];
  if (casters.length === 1 && CLASSES[casters[0].name].caster === "half1") return HALF1_SLOTS[casters[0].level - 1];
  const cl = casters.reduce((s, c) => s + (CLASSES[c.name].caster === "full" ? c.level : CLASSES[c.name].caster === "half1" ? Math.ceil(c.level / 2) : Math.floor(c.level / 2)), 0);
  return cl > 0 ? MC_SLOTS[Math.min(cl, 20) - 1] : null;
}
const totalLevel = (ch) => ch.classes.reduce((s, c) => s + c.level, 0);
const isTechnique = (sp) => !(sp.classes || "").split(",").some((e) => {
  const m = e.trim().match(/^(.+?)(?:\s*\(([^)]*)\))?$/);
  return m && CASTING_CLASSES.has(m[1].trim()) && (m[2] || "").trim().toLowerCase() !== "no spells";
});
const choiceCum = (g, level) => Object.entries(g.counts).reduce((s, [l, n]) => s + (level >= +l ? n : 0), 0);
const groupMatches = (g, clsName, subclass) => g.cls === clsName && (!g.sub || (subclass && subTokens(subclass).includes(normSub(g.sub))));
function choiceOptionsFor(g, customs) {
  if (g.key === "Maneuvers") {
    return Object.keys(MANEUVERS).map((name) => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  if (g.key === "Arcane Shot Options") {
    const list = __BASE?.runtime?.arcaneShots || [];
    if (list.length) return list.filter(isSourceEnabled).map((s) => ({ name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  if (g.key === "Runes") {
    const list = __BASE?.runtime?.runes || [];
    if (list.length) return list.filter(isSourceEnabled).map((r) => ({ name: r.name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  if (g.key === "Elemental Disciplines") {
    const list = __BASE?.runtime?.elementalDisciplines || [];
    if (list.length) return list.filter(isSourceEnabled).map((d) => ({ name: d.name, minLvl: d.minLevel || 0 })).sort((a, b) => (a.minLvl || 0) - (b.minLvl || 0) || a.name.localeCompare(b.name));
  }
  if (g.key === "Infusions") {
    const list = __BASE?.runtime?.infusions || [];
    if (list.length) return list.filter(isSourceEnabled).map((i) => ({ name: i.name, minLvl: i.minLevel || 0 })).sort((a, b) => (a.minLvl || 0) - (b.minLvl || 0) || a.name.localeCompare(b.name));
  }
  if (g.source.list && g.source.list.length) return g.source.list.map((n) => ({ name: n }));
  if (g.source.spellTag) {
    return srcSpells(customs?.spells || []).filter((sp) => isTechnique(sp) && spellFitsClass(sp, g.cls, g.sub))
      .map((sp) => ({ name: sp.name, minLvl: +((sp.text || "").match(/Prerequisite:\s*(\d+)\w*\s*level/i)?.[1] || 0) }))
      .sort((a, b) => (a.minLvl || 0) - (b.minLvl || 0) || a.name.localeCompare(b.name));
  }
  const ft = customs?.featureTexts || {};
  if (g.source.featurePrefix) {
    const pre = g.source.featurePrefix + ": ";
    return Object.keys(ft).filter((k) => k.startsWith(pre)).map((k) => ({ name: k })).sort((a, b) => a.name.localeCompare(b.name));
  }
  if (g.source.featureSuffix) {
    return Object.keys(ft).filter((k) => k.endsWith(g.source.featureSuffix) && k !== g.source.featureSuffix && !k.includes(":"))
      .map((k) => ({ name: k })).sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
}
function characterChoiceGroups(ch, customs) {
  const out = [];
  for (const g of CHOICE_GROUPS) {
    const entry = ch.classes.find((c) => groupMatches(g, c.name, c.subclass));
    if (!entry) continue;
    const options = choiceOptionsFor(g, customs);
    if (!options.length) continue;
    const grants = Object.entries(g.grant || {}).flatMap(([l, arr]) => (entry.level >= +l ? arr : []));
    const held = ch.choices?.[g.key] || [];
    out.push({ g, entry, options, grants, held, cap: choiceCum(g, entry.level) + grants.length });
  }
  return out;
}
function allKnownCantrips(ch) {
  return [
    ...Object.values(ch.spells || {}).flatMap((b) => b.cantrips || []),
    ...(ch.tomeCantrips || []),
    ...(ch.racialChoices?.cantrip ? [ch.racialChoices.cantrip] : []),
    ...(ch.feats || []).flatMap((n) => [
      ...(featChoiceOf(ch, n).cantrips || []),
      ...featGrantedSpells(n, totalLevel(ch)).filter((sp) => GRANT_CANTRIPS.has(sp)),
    ]),
    ...raceGrantedSpells(ch).filter((sp) => GRANT_CANTRIPS.has(sp)),
  ];
}
function sourceOf(value) {
  if (value && typeof value === "object") {
    const label = sourceLabelOf(value);
    return `${label}${value.page ? ` p.${value.page}` : ""}`;
  }
  const m = (value || "").match(/Source:\s*([^\n]+)/);
  if (!m) return null;
  const first = m[1].split(/[;·]/)[0].trim();
  for (const [long, abbr] of SOURCE_ABBR) if (first.includes(long)) { const p = first.match(/p\.?\s*(\d+)/); return abbr + (p ? ` p.${p[1]}` : ""); }
  return first.length > 28 ? first.slice(0, 28) + "…" : first;
}
const findItem = (name, customs) => (customs?.items || []).find((x) => x.name === name && isSourceEnabled(x));
const isArmorType = (t) => ["LA", "MA", "HA"].includes(t);
const isWeaponType = (t) => ["M", "R"].includes(t);
const equippedOf = (ch) => (ch.inventory || []).filter((r) => r.equipped);
const isMartial = (it) => (it.property || "").split(",").map((x) => x.trim()).includes("M");
const nameMatchesAny = (itemName, names) => {
  const hay = itemName.toLowerCase();
  return names.some((n) => n.toLowerCase().split(/[\s,]+/).every((w) => hay.includes(w)));
};
function canEquip(item, ch) {
  if (!item) return true;
  const profs = ch.classes.map((c, i) => (i === 0 ? CLASS_GEAR_PROFS[c.name] : MC_GEAR_PROFS[c.name])).filter(Boolean);
  if (isArmorType(item.type) || item.type === "S") {
    const want = item.type === "S" ? "S" : item.type;
    return profs.some((p) => p.armor.includes(want));
  }
  if (isWeaponType(item.type)) {
    return profs.some((p) => {
      const w = p.weapons || {};
      if (w.martial) return true;
      if (w.simple && !isMartial(item)) return true;
      return w.named ? nameMatchesAny(item.name, w.named) : false;
    });
  }
  return true;
}
function equippedGear(ch, customs) {
  const inv = equippedOf(ch).map((r) => findItem(r.name, customs)).filter(Boolean);
  return { armor: inv.find((x) => isArmorType(x.type)), shield: inv.find((x) => x.type === "S") };
}
function armorClass(ch, customs, fx = fxMods(ch)) {
  const dex = mod(ch.abilities.dex);
  const { armor, shield } = equippedGear(ch, customs);
  const parts = [];
  let ac;
  if (armor) {
    if (armor.type === "HA") { ac = armor.ac; parts.push(`${armor.name} ${armor.ac}`); }
    else if (armor.type === "MA") { const cap = featEffects(ch, customs).mediumDexCap; ac = armor.ac + Math.min(cap, dex); parts.push(`${armor.name} ${armor.ac}`, `Dex ${fmtMod(Math.min(cap, dex))} (max +${cap}${cap > 2 ? ", Medium Armor Master" : ""})`); }
    else { ac = armor.ac + dex; parts.push(`${armor.name} ${armor.ac}`, `Dex ${fmtMod(dex)}`); }
  } else {
    const barb = ch.classes.some((c) => c.name === "Barbarian");
    const monk = ch.classes.some((c) => c.name === "Monk");
    const draconic = ch.classes.some((c) => baseSubName(c.subclass || "") === "Draconic Bloodline");
    if (monk && !shield) { ac = 10 + dex + mod(ch.abilities.wis); parts.push("Unarmored Defense 10", `Dex ${fmtMod(dex)}`, `Wis ${fmtMod(mod(ch.abilities.wis))}`); }
    else if (barb) { ac = 10 + dex + mod(ch.abilities.con); parts.push("Unarmored Defense 10", `Dex ${fmtMod(dex)}`, `Con ${fmtMod(mod(ch.abilities.con))}`); }
    else if (draconic) { ac = 13 + dex; parts.push("Draconic Resilience 13", `Dex ${fmtMod(dex)}`); }
    else { ac = 10 + dex; parts.push("Unarmored 10", `Dex ${fmtMod(dex)}`); }
  }
  const rn = RACES[ch.race] || {};
  if (!armor && rn.natArmor && rn.natArmor + dex > ac) { ac = rn.natArmor + dex; parts.splice(0, parts.length, `Natural Armor ${rn.natArmor}`, `Dex ${fmtMod(dex)}`); }
  if (!armor && rn.natArmorFlat && rn.natArmorFlat > ac) { ac = rn.natArmorFlat; parts.splice(0, parts.length, `Natural Armor ${rn.natArmorFlat} (Dex ignored)`); }
  if (!armor && fx.acBase && fx.acBase.value + dex > ac) { ac = fx.acBase.value + dex; parts.splice(0, parts.length, `${fx.acBase.label} ${fx.acBase.value}`, `Dex ${fmtMod(dex)}`); }
  if (shield) { ac += shield.ac || 2; parts.push(`${shield.name} +${shield.ac || 2}`); }
  if (armor && hasStyle(ch, "Defense")) { ac += 1; parts.push("Defense style +1"); }
  if (rn.acBonus) { ac += rn.acBonus; parts.push(`Integrated Protection +${rn.acBonus}`); }
  fx.ac.forEach((b) => { ac += b.value; parts.push(`${b.label} ${fmtMod(b.value)}`); });
  if (fx.acFloor && ac < fx.acFloor.value) { ac = fx.acFloor.value; parts.push(`${fx.acFloor.label} (AC can't drop below ${fx.acFloor.value})`); }
  return { ac, parts, armor, shield };
}
const classLevel = (ch, name) => ch.classes.find((c) => c.name === name)?.level || 0;
const hasSub = (ch, name) => ch.classes.some((c) => c.subclass && subTokens(c.subclass).includes(normSub(name)));
const hasFeat = (ch, name) => {
  const targetNorm = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (ch?.feats || []).some((f) => String(f || "").toLowerCase().replace(/[^a-z0-9]/g, "") === targetNorm);
};
const effectsOf = (ch) => (Array.isArray(ch.effects) ? ch.effects : []);
const knownSpellNames = (ch, customs) => {
  const out = new Set();
  Object.values(ch.spells || {}).forEach((b) => ["cantrips", "spells"].forEach((k) => (b?.[k] || []).forEach((n) => out.add(n))));
  ch.classes.forEach((c) => {
    const sd = c.subclass && subSpellData(c.subclass, c.name, customs);
    if (sd?.type === "granted") Object.entries(sd.spells).forEach(([lvl, arr]) => { if (c.level >= +lvl) arr.forEach((n) => out.add(n)); });
  });
  return out;
};
const slugFx = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const E = (kind, name, def) => ({ key: slugFx(name), kind, name, ...def });
const shillAbil = (ch) => {
  for (const [cls, book] of Object.entries(ch.spells || {})) {
    if (SPELL_ABILITY[cls] && ["cantrips", "spells"].some((k) => (book?.[k] || []).includes("Shillelagh"))) return SPELL_ABILITY[cls];
  }
  if ((ch.tomeCantrips || []).includes("Shillelagh") && ch.classes.some((c) => c.name === "Warlock")) return SPELL_ABILITY.Warlock;
  return "wis";
};
const EFFECT_LIB = [
  E("Spell", "Mage Armor", { dur: "8 hours", ends: "long", brief: "Base AC becomes 13 + Dex while you wear no armor", mods: () => ({ acBase: { label: "Mage Armor", value: 13 } }) }),
  E("Spell", "Shield", { dur: "until the start of your next turn", ends: "short", brief: "+5 AC, including against the attack that triggered it", mods: () => ({ ac: [{ label: "Shield", value: 5 }] }) }),
  E("Spell", "Shield of Faith", { conc: true, dur: "10 minutes", ends: "short", brief: "+2 AC", mods: () => ({ ac: [{ label: "Shield of Faith", value: 2 }] }) }),
  E("Spell", "Barkskin", { conc: true, dur: "1 hour", ends: "short", brief: "Your AC can't drop below 16", mods: () => ({ acFloor: { label: "Barkskin", value: 16 } }) }),
  E("Spell", "Haste", { conc: true, dur: "1 minute", ends: "short", brief: "+2 AC, double speed, advantage on Dex saves, one extra limited action each turn", desc: "When the spell ends, you can't move or take actions until after your next turn — the lethargy bill comes due.", mods: () => ({ ac: [{ label: "Haste", value: 2 }], speedMult: 2, notes: { save: [{ t: "Haste: advantage on Dexterity saving throws", abil: "dex" }], attack: ["Haste: one extra action per turn (one Attack, Dash, Disengage, Hide, or Use an Object)"] } }) }),
  E("Spell", "Slow", { conc: true, dur: "1 minute", ends: "short", brief: "−2 AC and Dex saves, speed halved, no reactions, one attack per turn", mods: () => ({ ac: [{ label: "Slow", value: -2 }], speedMult: 0.5, notes: { save: [{ t: "Slow: −2 to Dexterity saving throws", abil: "dex" }], attack: ["Slow: one attack per turn; no bonus-action spells"] } }) }),
  E("Spell", "Bless", { conc: true, dur: "1 minute", ends: "short", brief: "Add +1d4 to attack rolls and saving throws", mods: () => ({ notes: { attack: ["Bless: add +1d4 to the attack roll"], save: ["Bless: add +1d4 to the save"] } }) }),
  E("Spell", "Bane", { conc: true, dur: "1 minute", ends: "short", brief: "Subtract 1d4 from attack rolls and saving throws", mods: () => ({ notes: { attack: ["Bane: subtract 1d4 from the attack roll"], save: ["Bane: subtract 1d4 from the save"] } }) }),
  E("Spell", "Aid", { dur: "8 hours", ends: "long", brief: "Max & current HP increase by 5 per slot level above 1st", input: { label: "Cast at slot level", unit: "slot", min: 2, max: 9, def: 2 }, mods: (v) => ({ maxHp: 5 * Math.max(1, (v || 2) - 1) }) }),
  E("Spell", "False Life", { dur: "1 hour", ends: "short", brief: "Gain temporary hit points (1d4 + 4, +5 per slot level above 1st)", input: { label: "Temp HP rolled", unit: "temp HP", min: 1, max: 45, def: 7 }, tempHp: (v) => v || 7 }),
  E("Spell", "Armor of Agathys", { dur: "1 hour", ends: "short", brief: "5 temp HP per slot level; melee attackers take that much cold damage while it holds", input: { label: "Cast at slot level", unit: "slot", min: 1, max: 9, def: 1 }, tempHp: (v) => 5 * (v || 1), mods: (v) => ({ notes: { dmg: [`Armor of Agathys: melee attackers take ${5 * (v || 1)} cold damage while the temp HP holds`] } }) }),
  E("Spell", "Heroism", { conc: true, dur: "1 minute", ends: "short", brief: "Immune to being frightened; gain temp HP equal to the caster's spell modifier at the start of each turn", mods: () => ({ notes: { save: ["Heroism: immune to being frightened"] } }) }),
  E("Spell", "Shillelagh", { dur: "1 minute", ends: "short", brief: "Your club or quarterstaff attacks use your spellcasting ability and deal 1d8 damage", mods: (v, ch) => ({ shillelagh: { abil: shillAbil(ch) } }) }),
  E("Spell", "Longstrider", { dur: "1 hour", ends: "short", brief: "+10 ft speed", mods: () => ({ speedAdd: [{ label: "Longstrider", value: 10 }] }) }),
  E("Spell", "Expeditious Retreat", { conc: true, dur: "10 minutes", ends: "short", brief: "Dash as a bonus action every turn" }),
  E("Spell", "Jump", { dur: "1 minute", ends: "short", brief: "Your jump distance is tripled", mods: () => ({ notes: { check: ["Jump: your jump distance is tripled"] } }) }),
  E("Spell", "Enhance Ability", { conc: true, dur: "1 hour", ends: "short", brief: "Advantage on checks with one chosen ability, plus its rider (Bear: temp HP, Bull: double carry, Cat: safe falls…)", mods: () => ({ notes: { check: ["Enhance Ability: advantage on checks with the chosen ability"] } }) }),
  E("Spell", "Enlarge", { match: "Enlarge/Reduce", conc: true, dur: "1 minute", ends: "short", brief: "Size doubled: advantage on Str checks & saves, +1d4 on enlarged-weapon damage", mods: () => ({ notes: { check: [{ t: "Enlarge: advantage on Strength checks", abil: "str" }], save: [{ t: "Enlarge: advantage on Strength saves", abil: "str" }], dmg: ["Enlarge: +1d4 damage with your enlarged weapon"] } }) }),
  E("Spell", "Reduce", { match: "Enlarge/Reduce", conc: true, dur: "1 minute", ends: "short", brief: "Size halved: disadvantage on Str checks & saves, −1d4 on reduced-weapon damage", mods: () => ({ notes: { check: [{ t: "Reduce: disadvantage on Strength checks", abil: "str" }], save: [{ t: "Reduce: disadvantage on Strength saves", abil: "str" }], dmg: ["Reduce: −1d4 damage with your reduced weapon"] } }) }),
  E("Spell", "Invisibility", { conc: true, dur: "1 hour", ends: "short", brief: "Attackers have disadvantage; you attack with advantage — but attacking or casting ends the spell", mods: () => ({ notes: { attack: ["Invisibility: attack with advantage — and the spell ends the moment you attack or cast"] } }) }),
  E("Spell", "Greater Invisibility", { conc: true, dur: "1 minute", ends: "short", brief: "Invisible even while attacking and casting", mods: () => ({ notes: { attack: ["Greater Invisibility: your attack rolls have advantage"] } }) }),
  E("Spell", "Blur", { conc: true, dur: "1 minute", ends: "short", brief: "Attackers who rely on sight have disadvantage against you" }),
  E("Spell", "Mirror Image", { dur: "1 minute", ends: "short", brief: "Three duplicates; incoming attacks may strike an image (AC 10 + your Dex) instead of you" }),
  E("Spell", "Blink", { dur: "1 minute", ends: "short", brief: "Roll a d20 at the end of each turn: 11+ whisks you to the Ethereal Plane until your next turn" }),
  E("Spell", "Stoneskin", { conc: true, dur: "1 hour", ends: "short", brief: "Resistance to nonmagical bludgeoning, piercing, and slashing damage" }),
  E("Spell", "Protection from Energy", { conc: true, dur: "1 hour", ends: "short", brief: "Resistance to one damage type: acid, cold, fire, lightning, or thunder" }),
  E("Spell", "Protection from Evil and Good", { conc: true, dur: "10 minutes", ends: "short", brief: "Aberrations, celestials, elementals, fey, fiends, and undead have disadvantage to hit you and can't charm, frighten, or possess you" }),
  E("Spell", "Sanctuary", { dur: "1 minute", ends: "short", brief: "Attackers must pass a Wisdom save or lose the attack; ends if you attack or harm anyone" }),
  E("Spell", "Divine Favor", { conc: true, dur: "1 minute", ends: "short", brief: "Weapon hits deal +1d4 radiant damage", mods: () => ({ notes: { dmg: ["Divine Favor: +1d4 radiant damage"] } }) }),
  E("Spell", "Magic Weapon", { conc: true, dur: "1 hour", ends: "short", brief: "One weapon becomes magical: +1 to attack and damage (+2/+3 at higher slots) — shown on every weapon, honor it only on the enchanted one", input: { label: "Bonus (+1, or more at higher slots)", unit: "+", min: 1, max: 3, def: 1 }, mods: (v) => ({ atk: [{ label: "Magic Weapon", value: v || 1, scope: "weapon" }], dmg: [{ label: "Magic Weapon", value: v || 1, scope: "weapon" }] }) }),
  E("Spell", "Guidance", { conc: true, dur: "1 minute", ends: "short", brief: "Add +1d4 to one ability check, then the spell is spent", mods: () => ({ notes: { check: ["Guidance: add +1d4 to the check (then the spell is spent)"] } }) }),
  E("Spell", "Resistance", { conc: true, dur: "1 minute", ends: "short", brief: "Add +1d4 to one saving throw, then the spell is spent", mods: () => ({ notes: { save: ["Resistance: add +1d4 to the save (then the spell is spent)"] } }) }),
  E("Spell", "Hunter's Mark", { conc: true, dur: "1 hour", ends: "short", brief: "+1d6 damage on weapon hits against your marked quarry; advantage to track it", mods: () => ({ notes: { dmg: ["Hunter's Mark: +1d6 against your marked quarry"], check: ["Hunter's Mark: advantage on Perception/Survival to find your quarry"] } }) }),
  E("Spell", "Hex", { conc: true, dur: "1 hour", ends: "short", brief: "+1d6 necrotic on hits against the hexed target; it has disadvantage on one ability's checks", mods: () => ({ notes: { dmg: ["Hex: +1d6 necrotic against the hexed target"] } }) }),
  E("Spell", "True Strike", { conc: true, dur: "1 round", ends: "short", brief: "Advantage on your first attack against the studied target on your next turn", mods: () => ({ notes: { attack: ["True Strike: advantage on your first attack against the studied target"] } }) }),
  E("Spell", "Foresight", { dur: "8 hours", ends: "long", brief: "Advantage on attacks, checks, and saves; attackers have disadvantage; you can't be surprised", mods: () => ({ notes: { attack: ["Foresight: advantage"], save: ["Foresight: advantage"], check: ["Foresight: advantage"] } }) }),
  E("Spell", "Freedom of Movement", { dur: "1 hour", ends: "short", brief: "Ignore difficult terrain; magic can't reduce your speed, paralyze, or restrain you; escape grapples for 5 ft" }),
  E("Spell", "Death Ward", { dur: "8 hours", ends: "long", brief: "The first time you'd drop to 0 HP, you drop to 1 instead" }),
  E("Spell", "Fire Shield", { dur: "10 minutes", ends: "short", brief: "Resistance to fire or cold (your choice); melee attackers take 2d8 damage", mods: () => ({ notes: { dmg: ["Fire Shield: melee attackers take 2d8 damage"] } }) }),
  E("Spell", "Warding Bond", { dur: "1 hour", ends: "short", brief: "+1 AC, +1 saves, resistance to all damage — and the caster shares your wounds", mods: () => ({ ac: [{ label: "Warding Bond", value: 1 }], save: [{ label: "Warding Bond", value: 1 }] }) }),
  E("Spell", "Heroes' Feast", { dur: "24 hours", ends: "long", brief: "Immune to poison & fear, advantage on Wisdom saves, max & current HP up by 2d10", input: { label: "HP increase rolled (2d10)", unit: "HP", min: 2, max: 20, def: 11 }, mods: (v) => ({ maxHp: v || 11, notes: { save: [{ t: "Heroes' Feast: advantage on Wisdom saves", abil: "wis" }, "Heroes' Feast: immune to poison and fright"] } }) }),
  E("Spell", "Mind Blank", { dur: "24 hours", ends: "long", brief: "Immune to psychic damage, mind reading, and divination" }),
  E("Spell", "Holy Aura", { conc: true, dur: "1 minute", ends: "short", brief: "Attackers have disadvantage against you; you have advantage on all saves", mods: () => ({ notes: { save: ["Holy Aura: advantage on saving throws"] } }) }),
  E("Spell", "Beacon of Hope", { conc: true, dur: "1 minute", ends: "short", brief: "Advantage on Wisdom saves and death saves; healing you receive is maximized", mods: () => ({ notes: { save: [{ t: "Beacon of Hope: advantage on Wisdom saving throws", abil: "wis" }] } }) }),
  E("Spell", "Spider Climb", { conc: true, dur: "1 hour", ends: "short", brief: "Walk on walls and ceilings, hands free" }),
  E("Spell", "Fly", { conc: true, dur: "10 minutes", ends: "short", brief: "Flying speed of 60 ft" }),
  E("Spell", "Levitate", { conc: true, dur: "10 minutes", ends: "short", brief: "Float vertically up to 20 ft; no horizontal movement without pushing off something" }),
  E("Spell", "Feather Fall", { dur: "1 minute", ends: "short", brief: "Fall at 60 ft per round and land without damage" }),
  E("Spell", "Gaseous Form", { conc: true, dur: "1 hour", ends: "short", brief: "A misty cloud: fly 10 ft, resistance to nonmagical damage, advantage on Str/Dex/Con saves — no attacks, no casting", mods: () => ({ notes: { save: [{ t: "Gaseous Form: advantage on Str/Dex/Con saves", abil: ["str", "dex", "con"] }] } }) }),
  E("Spell", "Alter Self", { conc: true, dur: "1 hour", ends: "short", brief: "Change appearance, grow natural weapons (+1 magical, 1d6), or adapt to water" }),
  E("Spell", "Darkvision", { dur: "8 hours", ends: "long", brief: "See in darkness to 60 ft" }),
  E("Spell", "See Invisibility", { dur: "1 hour", ends: "short", brief: "See invisible creatures and into the Ethereal Plane" }),
  E("Spell", "Water Breathing", { dur: "24 hours", ends: "long", brief: "Breathe underwater" }),
  E("Spell", "Water Walk", { dur: "1 hour", ends: "short", brief: "Stride across liquid surfaces as if they were solid ground" }),
  E("Spell", "Regenerate", { dur: "1 hour", ends: "short", brief: "Regain 1 HP at the start of each of your turns; severed bits reattach" }),

  E("Feature", "Rage", { dur: "1 minute (keep attacking or taking damage to sustain it)", ends: "short", brief: "Resistance to bludgeoning/piercing/slashing; bonus damage on Str melee hits; advantage on Str checks & saves; no spellcasting or concentration", mine: (ch) => classLevel(ch, "Barbarian") >= 1,
    mods: (v, ch) => { const l = classLevel(ch, "Barbarian"); const b = l >= 16 ? 4 : l >= 9 ? 3 : 2; return { dmg: [{ label: "Rage", value: b, scope: "melee", abil: "str" }], notes: { save: [{ t: "Rage: advantage on Strength saves · resistance to bludgeoning, piercing, slashing", abil: "str" }], check: [{ t: "Rage: advantage on Strength checks", abil: "str" }], attack: [{ t: `Rage: +${b} damage on Strength-based melee hits`, abil: "str" }] } }; } }),
  E("Feature", "Reckless Attack", { dur: "until your next turn", ends: "short", brief: "Advantage on Strength melee attacks this turn — and every attack against you has advantage too", mine: (ch) => classLevel(ch, "Barbarian") >= 2, mods: () => ({ notes: { attack: [{ t: "Reckless Attack: advantage on Strength-based melee attacks; enemies have advantage against you", abil: "str" }] } }) }),
  E("Feature", "Frenzy", { dur: "while raging", ends: "short", brief: "Bonus-action melee attack each turn; one level of exhaustion when the rage ends", mine: (ch) => hasSub(ch, "Path of the Berserker") }),
  E("Feature", "Wild Shape", { dur: "up to half your druid level in hours", ends: "short", brief: "You are the beast: use its physical stats and HP, keep your Int/Wis/Cha, saves, and skill proficiencies; at 0 beast HP you revert and excess damage carries over", desc: "Track the beast's own hit-point pool in the Minions & Summons card — when it empties, remove this effect and take any leftover damage on your true body.", mine: (ch) => classLevel(ch, "Druid") >= 2 }),
  E("Feature", "Bardic Inspiration (received)", { dur: "10 minutes or until spent", ends: "short", brief: "Add the inspiration die to one attack roll, ability check, or saving throw — after you see the d20", mods: () => ({ notes: { attack: ["Bardic Inspiration: you may add the die after seeing the roll"], save: ["Bardic Inspiration: you may add the die after seeing the roll"], check: ["Bardic Inspiration: you may add the die after seeing the roll"] } }) }),
  E("Feature", "Sacred Weapon", { dur: "1 minute", ends: "short", brief: "Add your Charisma modifier to attack rolls with the blessed weapon (shown on every weapon — honor it on the blessed one); it sheds bright light", mine: (ch) => hasSub(ch, "Oath of Devotion"), mods: (v, ch) => ({ atk: [{ label: "Sacred Weapon", value: Math.max(1, mod(ch.abilities.cha)), scope: "weapon" }] }) }),
  E("Feature", "Empty Body", { dur: "1 minute", ends: "short", brief: "Invisible, and resistant to all damage except force", mine: (ch) => classLevel(ch, "Monk") >= 18, mods: () => ({ notes: { attack: ["Empty Body: your attack rolls have advantage (invisible)"] } }) }),
  E("Action", "Dodge", { dur: "until the start of your next turn", ends: "short", brief: "Attackers you can see have disadvantage; you have advantage on Dexterity saves", mods: () => ({ notes: { save: [{ t: "Dodge: advantage on Dexterity saves", abil: "dex" }] } }) }),
  E("Action", "Patient Defense", { dur: "until the start of your next turn", ends: "short", brief: "Dodge as a bonus action (1 ki): attackers have disadvantage; advantage on Dex saves", mine: (ch) => classLevel(ch, "Monk") >= 2, mods: () => ({ notes: { save: [{ t: "Patient Defense: advantage on Dexterity saves", abil: "dex" }] } }) }),
  E("Action", "Help (received)", { dur: "your next roll", ends: "short", brief: "Advantage on your next ability check, or on your first attack against the distracted target", mods: () => ({ notes: { attack: ["Help: advantage on your first attack against the target"], check: ["Help: advantage on the assisted check"] } }) }),
  E("Action", "Hidden", { dur: "until you're found, move into view, or attack", ends: "short", brief: "Attack with advantage from hiding — attacking reveals you", mods: () => ({ notes: { attack: ["Hidden: attack with advantage — and give away your position"] } }) }),

  E("Feat", "Great Weapon Master", { dur: "declared before each attack", ends: "short", brief: "Take −5 to hit with a heavy melee weapon for +10 damage", mine: (ch) => hasFeat(ch, "Great Weapon Master"), mods: () => ({ atk: [{ label: "Great Weapon Master", value: -5, scope: "melee", prop: "H" }], dmg: [{ label: "Great Weapon Master", value: 10, scope: "melee", prop: "H" }] }) }),
  E("Feat", "Sharpshooter", { dur: "declared before each attack", ends: "short", brief: "Take −5 to hit with a ranged weapon for +10 damage; ignore cover and long range", mine: (ch) => hasFeat(ch, "Sharpshooter"), mods: () => ({ atk: [{ label: "Sharpshooter", value: -5, scope: "ranged" }], dmg: [{ label: "Sharpshooter", value: 10, scope: "ranged" }] }) }),
  E("Feat", "Defensive Duelist", { dur: "until the start of your next turn", ends: "short", brief: "Reaction while wielding a finesse weapon: add your proficiency bonus to AC against one melee hit", mine: (ch) => hasFeat(ch, "Defensive Duelist"), mods: (v, ch) => ({ ac: [{ label: "Defensive Duelist", value: profBonus(totalLevel(ch)) }] }) }),

  E("Condition", "Blinded", { dur: "until removed", ends: "manual", brief: "Auto-fail sight checks; your attacks have disadvantage, attacks against you have advantage", mods: () => ({ notes: { attack: ["Blinded: disadvantage on your attacks; attackers have advantage"], check: ["Blinded: automatic failure on checks that require sight"] } }) }),
  E("Condition", "Charmed", { dur: "until removed", ends: "manual", brief: "You can't attack the charmer; they have advantage on social checks against you" }),
  E("Condition", "Deafened", { dur: "until removed", ends: "manual", brief: "Auto-fail checks that require hearing", mods: () => ({ notes: { check: ["Deafened: automatic failure on checks that require hearing"] } }) }),
  E("Condition", "Frightened", { dur: "until removed", ends: "manual", brief: "Disadvantage on checks and attacks while the source of fear is in sight; you can't willingly move closer to it", mods: () => ({ notes: { attack: ["Frightened: disadvantage while the source of fear is in sight"], check: ["Frightened: disadvantage while the source of fear is in sight"] } }) }),
  E("Condition", "Grappled", { dur: "until you escape or the grappler lets go", ends: "manual", brief: "Speed 0. Escape with Athletics/Acrobatics vs the grappler", mods: () => ({ speedZero: true }) }),
  E("Condition", "Incapacitated", { dur: "until removed", ends: "manual", brief: "No actions, no reactions" }),
  E("Condition", "Invisible (condition)", { dur: "until removed", ends: "manual", brief: "Attackers have disadvantage; your attacks have advantage", mods: () => ({ notes: { attack: ["Invisible: your attack rolls have advantage"] } }) }),
  E("Condition", "Paralyzed", { dur: "until removed", ends: "manual", brief: "Incapacitated, speed 0; auto-fail Str & Dex saves; attackers have advantage and hits within 5 ft are crits", mods: () => ({ speedZero: true, notes: { save: [{ t: "Paralyzed: automatic failure on Strength and Dexterity saves", abil: ["str", "dex"] }] } }) }),
  E("Condition", "Petrified", { dur: "until removed", ends: "manual", brief: "Stone: incapacitated, speed 0, resistance to all damage, immune to poison & disease; auto-fail Str & Dex saves", mods: () => ({ speedZero: true, notes: { save: [{ t: "Petrified: automatic failure on Strength and Dexterity saves", abil: ["str", "dex"] }] } }) }),
  E("Condition", "Poisoned", { dur: "until removed", ends: "manual", brief: "Disadvantage on attack rolls and ability checks", mods: () => ({ notes: { attack: ["Poisoned: disadvantage on attack rolls"], check: ["Poisoned: disadvantage on ability checks"] } }) }),
  E("Condition", "Prone", { dur: "until you stand (half your movement)", ends: "manual", brief: "Crawl at half speed; your attacks have disadvantage; melee attackers within 5 ft have advantage, ranged have disadvantage", mods: () => ({ speedMult: 0.5, notes: { attack: ["Prone: disadvantage on your attack rolls"] } }) }),
  E("Condition", "Restrained", { dur: "until freed", ends: "manual", brief: "Speed 0; your attacks and Dex saves have disadvantage; attacks against you have advantage", mods: () => ({ speedZero: true, notes: { attack: ["Restrained: disadvantage on your attacks; attackers have advantage"], save: [{ t: "Restrained: disadvantage on Dexterity saves", abil: "dex" }] } }) }),
  E("Condition", "Stunned", { dur: "until removed", ends: "manual", brief: "Incapacitated, speed 0, auto-fail Str & Dex saves; attackers have advantage", mods: () => ({ speedZero: true, notes: { save: [{ t: "Stunned: automatic failure on Strength and Dexterity saves", abil: ["str", "dex"] }] } }) }),
  E("Condition", "Unconscious", { dur: "until you wake", ends: "manual", brief: "Incapacitated, prone, speed 0; drop what you hold; auto-fail Str & Dex saves; attackers have advantage, hits within 5 ft are crits", mods: () => ({ speedZero: true, notes: { save: [{ t: "Unconscious: automatic failure on Strength and Dexterity saves", abil: ["str", "dex"] }] } }) }),
  E("Condition", "Exhaustion", { dur: "one level fades per long rest", ends: "manual", stacks: 6, restDecay: "long", brief: "1: disadvantage on checks · 2: speed halved · 3: disadvantage on attacks & saves · 4: max HP halved · 5: speed 0 · 6: death",
    mods: (v, ch, inst) => {
      const s = Math.max(1, Math.min(6, inst?.stacks || 1));
      const m = { notes: { check: [`Exhaustion ${s}: disadvantage on ability checks`] } };
      if (s >= 2) m.speedMult = 0.5;
      if (s >= 3) { m.notes.attack = [`Exhaustion ${s}: disadvantage on attack rolls`]; m.notes.save = [`Exhaustion ${s}: disadvantage on saving throws`]; }
      if (s >= 4) m.halveMaxHp = true;
      if (s >= 5) m.speedZero = true;
      return m;
    } }),
];
const EFFECT_BY_KEY = Object.fromEntries(EFFECT_LIB.map((e) => [e.key, e]));
const hasEffect = (ch, key) => effectsOf(ch).some((e) => e.key === key);
const effDefOf = (e) => (e.key === "custom" ? null : EFFECT_BY_KEY[e.key]);
const isConcDef = (e) => (e.key === "custom" ? !!e.conc : !!effDefOf(e)?.conc);
const isConcInst = (e) => !e.ally && isConcDef(e);
const effEnds = (e) => (e.key === "custom" ? e.ends || "manual" : effDefOf(e)?.ends || "manual");
const instMaxHp = (e, ch) => {
  if (e.key === "custom") return (e.mods || {}).maxHp || 0;
  const def = effDefOf(e);
  return (def?.mods ? def.mods(e.val, ch, e).maxHp : 0) || 0;
};
const describeCustomFx = (m) => [m.ac && `AC ${fmtMod(m.ac)}`, m.atk && `attacks ${fmtMod(m.atk)}`, m.save && `saves ${fmtMod(m.save)}`, m.dmg && `weapon damage ${fmtMod(m.dmg)}`, m.speed && `speed ${fmtMod(m.speed)} ft`, m.maxHp && `max HP ${fmtMod(m.maxHp)}`].filter(Boolean).join(" · ");
function applyEffectPatch(ch, inst, grantTemp) {
  const effects = effectsOf(ch);
  let next = effects, dropped = [];
  const def = effDefOf(inst);
  if (isConcInst(inst)) { dropped = next.filter(isConcInst); next = next.filter((e) => !isConcInst(e)); }
  if (def?.stacks && next.some((e) => e.key === inst.key)) next = next.map((e) => (e.key === inst.key ? { ...e, stacks: Math.min(def.stacks, (e.stacks || 1) + 1) } : e));
  else if (inst.key !== "custom" && next.some((e) => e.key === inst.key)) {}
  else next = [...next, inst];
  const refund = dropped.reduce((s, e) => s + instMaxHp(e, ch), 0);
  return {
    effects: next,
    ...(grantTemp ? { tempHp: Math.max(Math.max(0, ch.tempHp || 0), grantTemp) } : {}),
    ...(refund ? { dmg: Math.max(0, Math.max(0, ch.dmg || 0) - refund) } : {}),
  };
}
function fxMods(ch) {
  const out = { ac: [], acBase: null, acFloor: null, maxHp: 0, halveMaxHp: false, speedAdd: [], speedMult: 1, speedZero: false, atk: [], save: [], dmg: [], shillelagh: null, conc: [], notes: { attack: [], save: [], check: [], dmg: [] } };
  for (const inst of effectsOf(ch)) {
    const def = effDefOf(inst);
    if (!def && inst.key !== "custom") continue;
    if (isConcInst(inst)) out.conc.push(inst.name || def.name);
    let m = {};
    if (def) m = def.mods ? def.mods(inst.val, ch, inst) : {};
    else {
      const c = inst.mods || {}, L = inst.name || "Custom effect";
      if (c.ac) m.ac = [{ label: L, value: c.ac }];
      if (c.atk) m.atk = [{ label: L, value: c.atk, scope: "all" }];
      if (c.save) m.save = [{ label: L, value: c.save }];
      if (c.dmg) m.dmg = [{ label: L, value: c.dmg, scope: "weapon" }];
      if (c.speed) m.speedAdd = [{ label: L, value: c.speed }];
      if (c.maxHp) m.maxHp = c.maxHp;
    }
    if (m.ac) out.ac.push(...m.ac);
    if (m.acBase && (!out.acBase || m.acBase.value > out.acBase.value)) out.acBase = m.acBase;
    if (m.acFloor && (!out.acFloor || m.acFloor.value > out.acFloor.value)) out.acFloor = m.acFloor;
    if (m.maxHp) out.maxHp += m.maxHp;
    if (m.halveMaxHp) out.halveMaxHp = true;
    if (m.speedAdd) out.speedAdd.push(...m.speedAdd);
    if (m.speedMult != null) out.speedMult *= m.speedMult;
    if (m.speedZero) out.speedZero = true;
    if (m.atk) out.atk.push(...m.atk);
    if (m.save) out.save.push(...m.save);
    if (m.dmg) out.dmg.push(...m.dmg);
    if (m.shillelagh) out.shillelagh = m.shillelagh;
    if (m.notes) for (const k of ["attack", "save", "check", "dmg"]) if (m.notes[k]) out.notes[k].push(...m.notes[k]);
  }
  return out;
}
function effMaxHp(ch, fx = fxMods(ch)) {
  const t = ch.maxHp + featHpBonus(ch) + fx.maxHp;
  return Math.max(1, fx.halveMaxHp ? Math.floor(t / 2) : t);
}
function speedOf(ch, customs, fx = fxMods(ch)) {
  let v = RACES[ch.race].speed;
  const parts = [`base ${v}`];
  const { armor, shield } = equippedGear(ch, customs);
  const monk = classLevel(ch, "Monk"), barb = classLevel(ch, "Barbarian");
  if (monk >= 2 && !armor && !shield) { const b = monk >= 18 ? 30 : monk >= 14 ? 25 : monk >= 10 ? 20 : monk >= 6 ? 15 : 10; v += b; parts.push(`Unarmored Movement +${b}`); }
  if (barb >= 5 && (!armor || armor.type !== "HA")) { v += 10; parts.push("Fast Movement +10"); }
  if (classLevel(ch, "Ranger") >= 6 && (!armor || armor.type !== "HA")) { v += 10; parts.push("Roving +10"); }
  const fe = featEffects(ch, customs);
  if (fe.speed) { v += fe.speed; parts.push(`feats +${fe.speed}`); }
  fx.speedAdd.forEach((s) => { v += s.value; parts.push(`${s.label} ${fmtMod(s.value)}`); });
  if (fx.speedMult !== 1) { v = Math.floor(v * fx.speedMult); parts.push(fx.speedMult > 1 ? `×${fx.speedMult}` : "halved"); }
  if (fx.speedZero) { v = 0; parts.push("held at 0"); }
  return { v: Math.max(0, v), parts, modified: parts.length > 1 };
}
const USE_TRACKERS = [
  { key: "rage-uses", name: "Rage", cls: "Barbarian", when: (ch) => classLevel(ch, "Barbarian") >= 1 && classLevel(ch, "Barbarian") < 20, max: (ch) => { const l = classLevel(ch, "Barbarian"); return l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2; }, per: "long", effect: "rage" },
  { key: "second-wind", name: "Second Wind", cls: "Fighter", when: (ch) => classLevel(ch, "Fighter") >= 1, max: () => 1, per: "short", die: () => 10, dieBonus: (ch) => classLevel(ch, "Fighter"), dieLabel: "healing", heal: true },
  { key: "action-surge", name: "Action Surge", cls: "Fighter", when: (ch) => classLevel(ch, "Fighter") >= 2, max: (ch) => (classLevel(ch, "Fighter") >= 17 ? 2 : 1), per: "short" },
  { key: "indomitable", name: "Indomitable", cls: "Fighter", when: (ch) => classLevel(ch, "Fighter") >= 9, max: (ch) => { const l = classLevel(ch, "Fighter"); return l >= 17 ? 3 : l >= 13 ? 2 : 1; }, per: "long" },
  { key: "superiority-dice", name: "Superiority Dice", cls: "Fighter", when: (ch) => hasSub(ch, "Battle Master") && classLevel(ch, "Fighter") >= 3, max: (ch) => { const l = classLevel(ch, "Fighter"); return l >= 15 ? 6 : l >= 7 ? 5 : 4; }, per: "short", die: (ch) => { const l = classLevel(ch, "Fighter"); return l >= 18 ? 12 : l >= 10 ? 10 : 8; }, dieLabel: "superiority" },
  { key: "bardic-inspiration-uses", name: "Bardic Inspiration", cls: "Bard", when: (ch) => classLevel(ch, "Bard") >= 1, max: (ch) => Math.max(1, mod(ch.abilities.cha)), per: (ch) => (classLevel(ch, "Bard") >= 5 ? "short" : "long") },
  { key: "channel-divinity", name: "Channel Divinity", when: (ch) => classLevel(ch, "Cleric") >= 2 || classLevel(ch, "Paladin") >= 3, max: (ch) => { const c = classLevel(ch, "Cleric"); return c >= 18 ? 3 : c >= 6 ? 2 : 1; }, per: "short" },
  { key: "wild-shape-uses", name: "Wild Shape", cls: "Druid", when: (ch) => classLevel(ch, "Druid") >= 2 && classLevel(ch, "Druid") < 20, max: () => 2, per: "short", effect: "wild-shape" },
  { key: "natural-recovery", name: "Natural Recovery", cls: "Druid", when: (ch) => hasSub(ch, "Circle of the Land"), max: () => 1, per: "long" },
  { key: "ki-points", name: "Ki Points", cls: "Monk", when: (ch) => classLevel(ch, "Monk") >= 2, max: (ch) => classLevel(ch, "Monk"), per: "short" },
  { key: "wholeness-of-body", name: "Wholeness of Body", cls: "Monk", when: (ch) => hasSub(ch, "Way of the Open Hand") && classLevel(ch, "Monk") >= 6, max: () => 1, per: "long" },
  { key: "lay-on-hands", name: "Lay on Hands", cls: "Paladin", when: (ch) => classLevel(ch, "Paladin") >= 1, max: (ch) => 5 * classLevel(ch, "Paladin"), per: "long", pool: true, unit: "HP" },
  { key: "divine-sense", name: "Divine Sense", cls: "Paladin", when: (ch) => classLevel(ch, "Paladin") >= 1, max: (ch) => 1 + Math.max(0, mod(ch.abilities.cha)), per: "long" },
  { key: "cleansing-touch", name: "Cleansing Touch", cls: "Paladin", when: (ch) => classLevel(ch, "Paladin") >= 14, max: (ch) => Math.max(1, mod(ch.abilities.cha)), per: "long" },
  { key: "sorcery-points", name: "Sorcery Points", cls: "Sorcerer", when: (ch) => classLevel(ch, "Sorcerer") >= 2, max: (ch) => classLevel(ch, "Sorcerer"), per: "long", pool: true },
  { key: "arcane-recovery", name: "Arcane Recovery", cls: "Wizard", when: (ch) => classLevel(ch, "Wizard") >= 1, max: () => 1, per: "long" },
  { key: "stroke-of-luck", name: "Stroke of Luck", cls: "Rogue", when: (ch) => classLevel(ch, "Rogue") >= 20, max: () => 1, per: "short" },
  { key: "dark-ones-own-luck", name: "Dark One's Own Luck", cls: "Warlock", when: (ch) => hasSub(ch, "The Fiend"), max: () => 1, per: "short" },
  { key: "hurl-through-hell", name: "Hurl Through Hell", cls: "Warlock", when: (ch) => hasSub(ch, "The Fiend") && classLevel(ch, "Warlock") >= 14, max: () => 1, per: "long" },
  { key: "breath-weapon", name: "Breath Weapon", when: (ch) => ch.race === "Dragonborn", max: () => 1, per: "short" },
  { key: "dreadful-strike", name: "Dreadful Strike (+2d6 psychic)", cls: "Ranger", when: (ch) => hasSub(ch, "Gloom Stalker") && classLevel(ch, "Ranger") >= 3, max: (ch) => Math.max(1, mod(ch.abilities.wis)), per: "long" },
  { key: "fey-reinforcements", name: "Fey Reinforcements (free Summon Fey)", cls: "Ranger", when: (ch) => hasSub(ch, "Fey Wanderer") && classLevel(ch, "Ranger") >= 11, max: () => 1, per: "long" },
  { key: "misty-wanderer", name: "Misty Wanderer (free Misty Step)", cls: "Ranger", when: (ch) => hasSub(ch, "Fey Wanderer") && classLevel(ch, "Ranger") >= 15, max: (ch) => Math.max(1, mod(ch.abilities.wis)), per: "long" },
  { key: "favored-enemy-24", name: "Favored Enemy (free Hunter's Mark)", cls: "Ranger", when: (ch) => classLevel(ch, "Ranger") >= 1, max: (ch) => { const l = classLevel(ch, "Ranger"); return l >= 17 ? 6 : l >= 13 ? 5 : l >= 9 ? 4 : l >= 5 ? 3 : 2; }, per: "long" },
  { key: "tireless", name: "Tireless", cls: "Ranger", when: (ch) => classLevel(ch, "Ranger") >= 10, max: (ch) => Math.max(1, mod(ch.abilities.wis)), per: "long" },
  { key: "natures-veil", name: "Nature's Veil", cls: "Ranger", when: (ch) => classLevel(ch, "Ranger") >= 14, max: (ch) => Math.max(1, mod(ch.abilities.wis)), per: "long" },
  { key: "healing-hands", name: "Healing Hands", when: (ch) => /^Aasimar/.test(ch.race), max: () => 1, per: "long" },
  { key: "radiant-soul", name: "Radiant Soul", when: (ch) => ch.race === "Aasimar (Protector)" && totalLevel(ch) >= 3, max: () => 1, per: "long" },
  { key: "radiant-consumption", name: "Radiant Consumption", when: (ch) => ch.race === "Aasimar (Scourge)" && totalLevel(ch) >= 3, max: () => 1, per: "long" },
  { key: "necrotic-shroud", name: "Necrotic Shroud", when: (ch) => ch.race === "Aasimar (Fallen)" && totalLevel(ch) >= 3, max: () => 1, per: "long" },
  { key: "firbolg-magic", name: "Firbolg Magic", when: (ch) => ch.race === "Firbolg", max: () => 1, per: "short" },
  { key: "hidden-step", name: "Hidden Step", when: (ch) => ch.race === "Firbolg", max: () => 1, per: "short" },
  { key: "stones-endurance", name: "Stone's Endurance", when: (ch) => ch.race === "Goliath", max: () => 1, per: "short" },
  { key: "fury-of-the-small", name: "Fury of the Small", when: (ch) => ch.race === "Goblin", max: () => 1, per: "short" },
  { key: "hungry-jaws", name: "Hungry Jaws", when: (ch) => ch.race === "Lizardfolk", max: () => 1, per: "short" },
  { key: "saving-face", name: "Saving Face", when: (ch) => ch.race === "Hobgoblin", max: () => 1, per: "short" },
  { key: "grovel-cower-beg", name: "Grovel, Cower, and Beg", when: (ch) => ch.race === "Kobold", max: () => 1, per: "short" },
  { key: "relentless-endurance", name: "Relentless Endurance", when: (ch) => ch.race === "Half-Orc", max: () => 1, per: "long" },
];
function parseLimitedUse(text, ch) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  const limiter = t.split(/\.\s+/).find((s) => /(rest|dawn)/.test(s) &&
    /(can't (use|do)[^.]*again|once (you have )?(use|used|per)|must finish a[^.]*rest before|regain[^.]*expended (uses|points|luck))/.test(s));
  if (!limiter) return null;
  const per = /short/.test(limiter) ? "short" : "long";
  let max = 1;
  const abil = t.match(/number of times equal to (?:(\d+) \+ )?your (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier/);
  const pts = t.match(/you have (\d+|two|three|four|five) (?:[a-z]+ )?points/);
  if (abil) max = Math.max(1, mod(ch.abilities[abil[2].slice(0, 3)]) + (abil[1] ? +abil[1] : 0));
  else if (/number of times equal to your proficiency bonus/.test(t)) max = profBonus(totalLevel(ch));
  else if (/use (this feature|it) twice/.test(t)) max = 2;
  else if (/use (this feature|it) three times/.test(t)) max = 3;
  else if (pts) max = { two: 2, three: 3, four: 4, five: 5 }[pts[1]] || +pts[1] || 1;
  return { max: Math.max(1, Math.min(20, max)), per };
}
function derivedTrackers(ch, customs) {
  const normFeatName = (s) => baseSubName(String(s || "").trim()).toLowerCase();
  const curated = new Set(USE_TRACKERS.map((t) => normFeatName(t.name)));
  const names = [], seen = new Set();
  const add = (raw) => {
    const n = String(raw || "").trim();
    const k = normFeatName(n);
    if (n && k && !seen.has(k) && !curated.has(k)) { seen.add(k); names.push(n); }
  };
  ch.classes.forEach((c) => {
    for (let l = 1; l <= c.level; l++) {
      (CLASSES[c.name].feats[l] || []).forEach((f) => { if (!(c.subclass && /\bfeature\b$/i.test(f))) add(f); });
      allSubFeats(c.subclass, l, customs).forEach(add);
    }
  });
  (ch.invocations || []).forEach(add);
  (ch.feats || []).forEach(add);
  (RACES[ch.race]?.traits || []).forEach((tr) => add(tr.replace(/\s*\(.*$/, "")));
  const out = [];
  names.forEach((n) => {
    const p = parseLimitedUse(infoFor(n, customs)?.body, ch);
    if (p) out.push({ key: `feat-${slugFx(n)}`, name: n, max: p.max, per: p.per });
  });
  return out;
}
function useTrackersFor(ch, customs) {
  const built = USE_TRACKERS.filter((t) => t.when(ch)).map((t) => ({ ...t, max: t.max(ch), per: typeof t.per === "function" ? t.per(ch) : t.per, die: typeof t.die === "function" ? t.die(ch) : t.die, dieBonus: typeof t.dieBonus === "function" ? t.dieBonus(ch) : t.dieBonus }));
  const custom = (Array.isArray(ch.customTrackers) ? ch.customTrackers : []).map((t) => ({ key: `custom-${t.id}`, name: t.name, max: Math.max(1, t.max || 1), per: t.per === "short" ? "short" : "long", pool: (t.max || 1) > 12, custom: true, id: t.id }));
  return [...built, ...derivedTrackers(ch, customs), ...custom];
}
const minionsOf = (ch) => (Array.isArray(ch.minions) ? ch.minions : []);
const crShow = (cr) => (cr === 0.125 ? "⅛" : cr === 0.25 ? "¼" : cr === 0.5 ? "½" : String(cr));
const creatureByName = (n) => {
  const q = String(n || "").trim().toLowerCase();
  return (q && __BESTIARY.find((c) => c.name.toLowerCase() === q && isSourceEnabled(c))) || null;
};
function summonFormsFor(def) {
  if (__BESTIARY.length) {
    let hits = null;
    if (def.pickNames) hits = def.pickNames.map(creatureByName).filter(Boolean);
    else if (def.pick) hits = __BESTIARY.filter((c) =>
      isSourceEnabled(c)
      && (!def.pick.types || def.pick.types.some((t) => c.type.startsWith(t)))
      && (def.pick.maxCr == null || c.cr <= def.pick.maxCr)
      && (def.pick.maxSize == null || SIZE_RANK[c.size] <= SIZE_RANK[def.pick.maxSize]));
    if (hits) hits = hits.filter(isSourceEnabled);
    if (hits && hits.length) return hits
      .map((c) => ({ name: c.name, hp: c.hp, ac: c.ac, cr: c.cr, stat: true }))
      .sort((a, b) => ((a.cr ?? 99) - (b.cr ?? 99)) || a.name.localeCompare(b.name));
  }
  return def.forms;
}
const SM = (kind, source, def) => ({ key: slugFx(source), kind, source, ...def });
const SUMMON_LIB = [
  SM("Spell", "Find Familiar", { ends: "manual", role: "Scout", pickNames: ["Bat", "Cat", "Crab", "Frog", "Hawk", "Lizard", "Octopus", "Owl", "Poisonous Snake", "Quipper", "Rat", "Raven", "Sea Horse", "Spider", "Weasel"], brief: "A spirit takes an animal form of your choosing; it can deliver your touch spells and lend you its eyes", forms: [
    ["Owl", 1, 11], ["Bat", 1, 12], ["Cat", 2, 12], ["Raven", 1, 12], ["Hawk", 1, 13], ["Weasel", 1, 13],
    ["Spider", 1, 12], ["Rat", 1, 10], ["Frog", 1, 11], ["Lizard", 2, 10], ["Crab", 2, 11], ["Octopus", 3, 12], ["Poisonous Snake", 2, 13], ["Fish (Quipper)", 1, 13],
  ] }),
  SM("Spell", "Find Steed", { ends: "manual", role: "Mount", pickNames: ["Warhorse", "Riding Horse", "Pony", "Camel", "Elk", "Mastiff"], brief: "A loyal otherworldly mount; while mounted, your single-target spells can touch it too", forms: [
    ["Warhorse", 19, 11], ["Riding Horse", 13, 10], ["Pony", 10, 10], ["Camel", 15, 9], ["Elk", 13, 10], ["Mastiff", 5, 12],
  ] }),
  SM("Spell", "Conjure Animals", { ends: "short", conc: true, role: "Skirmisher", pick: { types: ["beast"], maxCr: 2 }, countHint: "8 beasts of CR ¼, 4 of CR ½, 2 of CR 1, or 1 of CR 2 — counts double at 5th, triple at 7th, quadruple at 9th", brief: "Fey spirits in beast shapes fight at your command for up to an hour", forms: [
    ["Wolf", 11, 13], ["Panther", 13, 12], ["Boar", 11, 11], ["Giant Poisonous Snake", 11, 14], ["Elk", 13, 10],
    ["Black Bear", 19, 11], ["Giant Wolf Spider", 11, 13], ["Brown Bear", 34, 11], ["Dire Wolf", 37, 14], ["Giant Spider", 26, 14], ["Giant Eagle", 26, 13], ["Giant Elk", 42, 14], ["Giant Constrictor Snake", 60, 12],
  ] }),
  SM("Spell", "Conjure Minor Elementals", { ends: "short", conc: true, role: "Striker", pick: { types: ["elemental"], maxCr: 2 }, countHint: "8 of CR ¼, 4 of CR ½, 2 of CR 1, or 1 of CR 2 — counts double at 6th level, triple at 8th", brief: "Small elementals coalesce and obey for up to an hour", forms: [
    ["Steam Mephit", 21, 10], ["Dust Mephit", 17, 12], ["Ice Mephit", 21, 11], ["Magma Mephit", 22, 11], ["Mud Mephit", 27, 11], ["Smoke Mephit", 22, 12], ["Azer", 39, 17], ["Gargoyle", 52, 15],
  ] }),
  SM("Spell", "Conjure Woodland Beings", { ends: "short", conc: true, role: "Skirmisher", pick: { types: ["fey"], maxCr: 2 }, countHint: "8 fey of CR ¼, 4 of CR ½, 2 of CR 1, or 1 of CR 2 — counts double at 6th level, triple at 8th", brief: "Fey creatures step out of the green to fight beside you", forms: [
    ["Pixie", 1, 15], ["Sprite", 2, 15], ["Blink Dog", 22, 13], ["Satyr", 31, 14], ["Dryad", 22, 11],
  ] }),
  SM("Spell", "Conjure Elemental", { ends: "short", conc: true, role: "Defender", pick: { types: ["elemental"] }, countHint: "one elemental of CR ≤ 5; +1 CR per slot level above 5th — mind it if concentration breaks", brief: "A pillar of the raw elements answers, obedient while your concentration holds", forms: [
    ["Air Elemental", 90, 15], ["Earth Elemental", 126, 17], ["Fire Elemental", 102, 13], ["Water Elemental", 114, 14],
  ] }),
  SM("Spell", "Conjure Fey", { ends: "short", conc: true, role: "Striker", pick: { types: ["fey", "beast"], maxCr: 6 }, countHint: "one fey creature (or fey-spirit beast) of CR ≤ 6; +1 CR per slot level above 6th", brief: "A fey creature steps through — it turns hostile if concentration breaks", forms: [["Fey creature", 60, 13]] }),
  SM("Spell", "Conjure Celestial", { ends: "short", conc: true, role: "Healer", pick: { types: ["celestial"], maxCr: 5 }, countHint: "one celestial of CR ≤ 4 (CR ≤ 5 with a 9th-level slot)", brief: "A celestial answers the call, friendly to you and yours", forms: [
    ["Couatl", 97, 19], ["Pegasus", 59, 12], ["Unicorn", 67, 12],
  ] }),
  SM("Spell", "Planar Ally", { ends: "manual", role: "Striker", pick: { types: ["celestial", "elemental", "fiend"] }, brief: "Your patron deity lends a servant — celestial, elemental, or fiend. Payment is negotiable", forms: [["Planar ally", 68, 14]] }),
  SM("Spell", "Animate Dead", { ends: "manual", role: "Servant", pickNames: ["Skeleton", "Zombie"], countHint: "one per casting, +2 per slot level above 3rd; each casting also reasserts control over four you've already raised", brief: "A pile of bones or a corpse rises as your servant for 24 hours at a time", forms: [
    ["Skeleton", 13, 13], ["Zombie", 22, 8],
  ] }),
  SM("Spell", "Create Undead", { ends: "manual", role: "Servant", pickNames: ["Ghoul", "Ghast", "Wight", "Mummy"], countHint: "3 ghouls at 6th; 4 ghouls at 7th; 5 ghouls or 2 ghasts/wights at 8th; 6 ghouls, 3 ghasts/wights, or 2 mummies at 9th", brief: "Corpses rise as fouler servants — yours for 24 hours at a time", forms: [
    ["Ghoul", 22, 12], ["Ghast", 36, 13], ["Wight", 45, 14], ["Mummy", 58, 11],
  ] }),
  SM("Spell", "Animate Objects", { ends: "short", conc: true, role: "Striker", countHint: "10 tiny, 5 small, 2 medium, or 1 large/huge object — two more objects per slot level above 5th", brief: "Loose objects spring to life and swarm at your word", forms: [
    ["Tiny object", 20, 18], ["Small object", 25, 16], ["Medium object", 40, 13], ["Large object", 50, 10], ["Huge object", 80, 10],
  ] }),
  SM("Spell", "Giant Insect", { ends: "short", conc: true, role: "Striker", pickNames: ["Giant Centipede", "Giant Spider", "Giant Wasp", "Giant Scorpion"], countHint: "10 centipedes, 3 spiders, 5 wasps, or 1 scorpion — they grow giant and obey", brief: "Ordinary vermin swell to giants under your command", forms: [
    ["Giant Centipede", 4, 13], ["Giant Wasp", 13, 12], ["Giant Spider", 26, 14], ["Giant Scorpion", 52, 15],
  ] }),
  SM("Spell", "Unseen Servant", { ends: "short", role: "Servant", brief: "An invisible, mindless force fetches and carries for an hour", forms: [["Unseen servant", 1, 10]] }),
  SM("Spell", "Summon Lesser Demons", { ends: "short", conc: true, role: "Striker", pick: { types: ["fiend"], maxCr: 1 }, countHint: "8 of CR ¼, 4 of CR ½, or 2 of CR 1 — they attack the nearest creature, friend or foe", brief: "Demons claw through — uncontrolled, hungry, and aimed only by proximity", forms: [
    ["Manes", 9, 9], ["Dretch", 18, 11], ["Quasit", 7, 13],
  ] }),
  SM("Spell", "Summon Greater Demon", { ends: "short", conc: true, role: "Striker", pick: { types: ["fiend"], maxCr: 5 }, countHint: "one demon of CR ≤ 5; +1 CR per slot level above 4th — it slips your leash when concentration ends", brief: "A greater demon answers, straining against your commands every round", forms: [
    ["Barlgura", 68, 15], ["Shadow Demon", 66, 13], ["Vrock", 104, 15],
  ] }),
  SM("Feature", "Wild Shape", { ends: "manual", role: "Wild Shape", mine: (ch) => classLevel(ch, "Druid") >= 2, pick: { types: ["beast"], maxCr: 6 }, countHint: "CR caps by druid level: ¼ at 2nd (no fly/swim), ½ at 4th (no fly), 1 at 8th — Circle of the Moon goes higher. At 0 HP the form breaks and leftover damage carries to your true body", brief: "Track your beast form's own hit-point pool here while you wear it", forms: [
    ["Wolf", 11, 13], ["Panther", 13, 12], ["Giant Wolf Spider", 11, 13], ["Black Bear", 19, 11], ["Brown Bear", 34, 11], ["Dire Wolf", 37, 14], ["Giant Spider", 26, 14], ["Giant Eagle", 26, 13],
  ] }),
  SM("Feature", "Primal Companion", { ends: "manual", role: "Companion", mine: (ch) => hasSub(ch, "Beast Master"), hpOf: (ch) => 5 + 5 * classLevel(ch, "Ranger"), countHint: "AC 13 + your Wis mod · HP 5 + 5 × your ranger level", brief: "The Beast Master's bonded primal beast — land, sea, or sky, scaling with your ranger level", forms: [
    ["Beast of the Land", 30, 13], ["Beast of the Sea", 30, 13], ["Beast of the Sky", 20, 13],
  ] }),
  SM("Feature", "Pact of the Chain", { ends: "manual", role: "Scout", mine: (ch) => ch.pactBoon === "Pact of the Chain", pickNames: ["Imp", "Quasit", "Pseudodragon", "Sprite"], brief: "Your special familiar — imp, quasit, pseudodragon, or sprite — and it can attack in your stead", forms: [
    ["Imp", 10, 13], ["Quasit", 7, 13], ["Pseudodragon", 7, 13], ["Sprite", 2, 15],
  ] }),
  SM("Feature", "Wildfire Spirit", { ends: "manual", role: "Companion", mine: (ch) => hasSub(ch, "Circle of Wildfire"), hpOf: (ch) => 5 + 5 * classLevel(ch, "Druid"), countHint: "AC 13 · HP 5 + 5 × your druid level", brief: "The Circle of Wildfire's bonded spirit — it ferries allies and scorches what it leaves behind", forms: [["Wildfire Spirit", 30, 13]] }),
  SM("Spell", "Summon Beast", { ends: "short", conc: true, spirit: true, slot: 2, acPlus: 11, hpStep: 5, role: "Companion", countHint: "Bestial Spirit — AC 11 + slot level · HP 30 (land/water) or 20 (air), +5 per slot level above 2nd", brief: "A bestial spirit answers in air, land, or water form", forms: [
    { name: "Bestial Spirit (Land)", hp: 30 }, { name: "Bestial Spirit (Water)", hp: 30 }, { name: "Bestial Spirit (Air)", hp: 20 },
  ] }),
  SM("Spell", "Summon Fey", { ends: "short", conc: true, spirit: true, slot: 3, acPlus: 12, hpStep: 10, role: "Striker", countHint: "Fey Spirit — AC 12 + slot level · HP 30 + 10 per slot level above 3rd", brief: "A fey spirit in fuming, mirthful, or tricksy mood", forms: [
    { name: "Fey Spirit (Fuming)", hp: 30 }, { name: "Fey Spirit (Mirthful)", hp: 30 }, { name: "Fey Spirit (Tricksy)", hp: 30 },
  ] }),
  SM("Spell", "Summon Undead", { ends: "short", conc: true, spirit: true, slot: 3, acPlus: 11, hpStep: 10, role: "Striker", countHint: "Undead Spirit — AC 11 + slot level · HP 30 (ghostly/putrid) or 20 (skeletal), +10 per slot level above 3rd", brief: "An undead spirit in ghostly, putrid, or skeletal form", forms: [
    { name: "Undead Spirit (Ghostly)", hp: 30 }, { name: "Undead Spirit (Putrid)", hp: 30 }, { name: "Undead Spirit (Skeletal)", hp: 20 },
  ] }),
  SM("Spell", "Summon Shadowspawn", { ends: "short", conc: true, spirit: true, slot: 3, acPlus: 11, hpStep: 15, role: "Striker", countHint: "Shadow Spirit — AC 11 + slot level · HP 35 + 15 per slot level above 3rd", brief: "A shadow spirit of fury, despair, or fear", forms: [
    { name: "Shadow Spirit (Fury)", hp: 35 }, { name: "Shadow Spirit (Despair)", hp: 35 }, { name: "Shadow Spirit (Fear)", hp: 35 },
  ] }),
  SM("Spell", "Summon Aberration", { ends: "short", conc: true, spirit: true, slot: 4, acPlus: 11, hpStep: 10, role: "Striker", countHint: "Aberrant Spirit — AC 11 + slot level · HP 40 + 10 per slot level above 4th", brief: "An aberrant spirit — beholderkin, slaad, or star spawn", forms: [
    { name: "Aberrant Spirit (Beholderkin)", hp: 40 }, { name: "Aberrant Spirit (Slaad)", hp: 40 }, { name: "Aberrant Spirit (Star Spawn)", hp: 40 },
  ] }),
  SM("Spell", "Summon Construct", { ends: "short", conc: true, spirit: true, slot: 4, acPlus: 13, hpStep: 15, role: "Defender", countHint: "Construct Spirit — AC 13 + slot level · HP 40 + 15 per slot level above 4th", brief: "A construct spirit of clay, metal, or stone", forms: [
    { name: "Construct Spirit (Clay)", hp: 40 }, { name: "Construct Spirit (Metal)", hp: 40 }, { name: "Construct Spirit (Stone)", hp: 40 },
  ] }),
  SM("Spell", "Summon Elemental", { ends: "short", conc: true, spirit: true, slot: 4, acPlus: 11, hpStep: 10, role: "Defender", countHint: "Elemental Spirit — AC 11 + slot level · HP 50 + 10 per slot level above 4th", brief: "An elemental spirit of air, earth, fire, or water", forms: [
    { name: "Elemental Spirit (Air)", hp: 50 }, { name: "Elemental Spirit (Earth)", hp: 50 }, { name: "Elemental Spirit (Fire)", hp: 50 }, { name: "Elemental Spirit (Water)", hp: 50 },
  ] }),
  SM("Spell", "Summon Celestial", { ends: "short", conc: true, spirit: true, slot: 5, acPlus: 11, hpStep: 10, role: "Healer", countHint: "Celestial Spirit — AC 11 + slot level (defender +2) · HP 40 + 10 per slot level above 5th", brief: "A celestial spirit as avenger or defender", forms: [
    { name: "Celestial Spirit (Avenger)", hp: 40 }, { name: "Celestial Spirit (Defender)", hp: 40, acPlus: 13 },
  ] }),
  SM("Spell", "Summon Fiend", { ends: "short", conc: true, spirit: true, slot: 6, acPlus: 12, hpStep: 15, role: "Striker", countHint: "Fiendish Spirit — AC 12 + slot level · HP 50 (demon), 40 (devil), or 60 (yugoloth), +15 per slot level above 6th", brief: "A fiendish spirit — demon, devil, or yugoloth", forms: [
    { name: "Fiendish Spirit (Demon)", hp: 50 }, { name: "Fiendish Spirit (Devil)", hp: 40 }, { name: "Fiendish Spirit (Yugoloth)", hp: 60 },
  ] }),
  SM("Spell", "Summon Draconic Spirit", { ends: "short", conc: true, spirit: true, slot: 5, acPlus: 14, hpStep: 10, role: "Striker", countHint: "Draconic Spirit — AC 14 + slot level · HP 50 + 10 per slot level above 5th", brief: "A draconic spirit — chromatic, gem, or metallic", forms: [
    { name: "Draconic Spirit (Chromatic)", hp: 50 }, { name: "Draconic Spirit (Gem)", hp: 50 }, { name: "Draconic Spirit (Metallic)", hp: 50 },
  ] }),
  SM("Bestiary", "Any creature", { ends: "manual", role: "Companion", pick: {}, brief: "Every SRD stat block — muster anything a feat, item, or DM's whim can grant", forms: [["Creature", 10, 10]] }),
].map((d) => ({ ...d, forms: d.forms.map((f) => (Array.isArray(f) ? { name: f[0], hp: f[1], ac: f[2] } : f)) }));
const summonDefFor = (name) => {
  const n = baseSubName(String(name || "").trim());
  return SUMMON_LIB.find((d) => d.source === n || d.source === String(name || "").trim()) || null;
};
const spiritHp = (def, form, slot) => (form.hp || 1) + (def.hpStep || 0) * Math.max(0, (slot || def.slot) - def.slot);
const spiritAc = (def, form, slot) => (form.acPlus ?? def.acPlus) + (slot || def.slot);
function spiritDefFromSpell(sp) {
  if (!sp || sp.level == null) return null;
  const t = String(sp.text || "");
  const acM = t.match(/armou?r class:?\s*(\d+)\s*\+\s*the (?:level of the spell|spell'?s level)/i);
  const hpM = t.match(/hit points:?\s*(\d+)[^]{0,80}?\+\s*(\d+)\s*for each spell level above (\d+)/i);
  if (!acM && !hpM) return null;
  const base = hpM ? +hpM[3] : sp.level;
  return {
    key: `spirit-${slugFx(sp.name)}`, kind: "Spell", source: sp.name,
    ends: "short", conc: /concentration/i.test(sp.duration || ""), role: "Striker",
    spirit: true, slot: base, acPlus: acM ? +acM[1] : 10, hpStep: hpM ? +hpM[2] : 0,
    countHint: `AC ${acM ? acM[1] : "10"} + slot level · HP ${hpM ? `${hpM[1]} + ${hpM[2]} per slot level above ${base}` : "as the spell states"}`,
    brief: "A summoned spirit — its strength scales with the slot",
    forms: [{ name: sp.name.replace(/^summon\s+/i, "") + " Spirit", hp: hpM ? +hpM[1] : 20 }],
  };
}
function minionAttackRolls(c) {
  const out = [];
  (c?.acts || []).forEach((a) => {
    const first = String(a.t).split(/\n/)[0];
    if (!/Attack:/i.test(first)) return;
    const hit = first.match(/([+-]\d+)\s*to hit/i);
    const hitClause = first.match(/Hit:\s*([^.]*)/i);
    const dice = [];
    let bonus = 0;
    if (hitClause) for (const m of hitClause[1].matchAll(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/g)) {
      for (let i = 0; i < Math.min(20, +m[1]); i++) dice.push(+m[2]);
      if (m[4]) bonus += (m[3] === "-" ? -1 : 1) * +m[4];
    }
    const scaled = /the spell's level/i.test(first);
    const useSpellAtk = /your spell attack/i.test(first);
    if (hit || dice.length) out.push({ name: a.n.replace(/\s*\(.*$/, ""), atk: hit ? +hit[1] : null, dice, bonus, scaled, useSpellAtk });
  });
  return out;
}
function summonerSpellAtk(ch, spellName) {
  let cls = null;
  for (const c of ch.classes) {
    const b = (ch.spells || {})[c.name];
    if (b && (["cantrips", "spells"].some((k) => (b[k] || []).includes(spellName)) || Object.values(b.arcanum || {}).includes(spellName))) { cls = c.name; break; }
  }
  if (!cls && (ch.tomeCantrips || []).includes(spellName)) cls = "Warlock";
  if (!cls) cls = ch.classes.find((c) => CLASSES[c.name].caster)?.name || null;
  const abil = SPELL_ABILITY[cls];
  return abil ? profBonus(totalLevel(ch)) + mod(ch.abilities[abil]) : null;
}
function minionSaves(c) {
  const listed = {};
  (c?.saves || "").split(",").forEach((s) => {
    const m = s.trim().match(/^([A-Za-z]{3})[a-z]*\s*([+-]\d+)/);
    if (m) listed[m[1].toLowerCase()] = +m[2];
  });
  return ABILITIES.map((a) => ({ a, mod: listed[a] ?? mod(c.ab[a]), prof: a in listed }));
}
const minionSkills = (c) => (c?.skills || "").split(",").map((s) => {
  const m = s.trim().match(/^(.+?)\s*([+-]\d+)$/);
  return m && { name: m[1], mod: +m[2] };
}).filter(Boolean);
const minionHp = (m) => Math.max(0, (m.maxHp || 1) - Math.max(0, m.dmg || 0));
function minionApplyHp(m, delta) {
  if (delta >= 0) return { ...m, dmg: Math.max(0, Math.max(0, m.dmg || 0) - delta) };
  const d = -delta, temp = Math.max(0, m.tempHp || 0);
  const fromTemp = Math.min(temp, d);
  return { ...m, tempHp: temp - fromTemp, dmg: Math.min(m.maxHp || 1, Math.max(0, m.dmg || 0) + (d - fromTemp)) };
}
const isBladeCantrip = (name) => /(booming|green[- ]?flame)\s*blade/i.test(String(name || ""));
const bladeRiderTier = (lvl) => (lvl >= 17 ? 3 : lvl >= 11 ? 2 : lvl >= 5 ? 1 : 0);
const SPELL_STRIKE_SPECIAL = {
  "Magic Missile": { special: "missiles", attack: null, type: "FC", die: 4, plusEach: 1, count: (castLvl) => 3 + Math.max(0, castLvl - 1), what: "dart" },
  "Eldritch Blast": { special: "beams", attack: "ranged", type: "FC", die: 10, n: 1, count: (castLvl, lvl) => bladeRiderTier(lvl) + 1, what: "beam" },
  "Scorching Ray": { special: "rays", attack: "ranged", type: "F", die: 6, n: 2, count: (castLvl) => 3 + Math.max(0, castLvl - 2), what: "ray" },
};
function strikeProfile(sp) {
  if (!sp) return null;
  if (SPELL_STRIKE_SPECIAL[sp.name]) return { name: sp.name, level: sp.level, ...SPELL_STRIKE_SPECIAL[sp.name] };
  const t = sp.text || "";
  const dmgM = t.match(/(\d+)d(\d+)\s*(?:\+\s*(\d+)\s*)?(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)?\s*damage/i);
  if (!dmgM) return null;
  const atkM = t.match(/make a (ranged|melee) spell attack/i);
  const saveM = t.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i);
  if (!atkM && !saveM) return null;
  const up = t.match(/increases by (\d+)d(\d+) for each slot level above (\d+)/i);
  return {
    name: sp.name, level: sp.level,
    attack: atkM ? atkM[1].toLowerCase() : null,
    save: saveM ? saveM[1].slice(0, 3).toLowerCase() : null,
    base: { n: +dmgM[1], sides: +dmgM[2], plus: +(dmgM[3] || 0) },
    type: dmgM[4] ? DMG_WORD_CODE[dmgM[4].toLowerCase()] : null,
    upcast: up ? { n: +up[1], sides: +up[2], above: +up[3] } : null,
    cantripScale: sp.level === 0 && /increases by (?:one die|\d+d\d+) when you reach 5th level/i.test(t),
  };
}
function useRecipe(name, ch, customs) {
  const n = String(name || "").trim();
  if (!n) return null;
  const strip = baseSubName(n);
  const sp = (customs?.spells || []).find((s) => s.name === n || s.name === strip) || null;
  const effs = EFFECT_LIB.filter((d) => d.kind !== "Condition" && [d.name, d.match].some((m) => m && (m === n || m === strip)));
  const norm = (s) => baseSubName(String(s || "").trim()).toLowerCase();
  const tracker = useTrackersFor(ch, customs).find((t) => norm(t.name) === norm(n)) || null;
  if (!sp && !effs.length && !tracker) return null;
  return { name: sp?.name || effs[0]?.name || tracker.name, sp, effs, tracker };
}
const usesAmmo = (it) => (it.property || "").split(",").map((x) => x.trim()).includes("A");
function ammoRowFor(ch, customs, weapon) {
  const rows = (ch.inventory || []).filter((r) => (r.qty || 1) > 0);
  const ammo = rows.filter((r) => { const it = findItem(r.name, customs); return (it && it.type === "A") || /arrow|bolt|bullet|needle/i.test(r.name); });
  const w = weapon.name.toLowerCase();
  const word = w.includes("crossbow") ? "bolt" : w.includes("bow") ? "arrow" : w.includes("sling") ? "bullet" : w.includes("blowgun") ? "needle" : null;
  return (word && ammo.find((r) => r.name.toLowerCase().includes(word))) || ammo[0] || null;
}
const isConsumableRow = (row, item) => (item ? ["P", "SC"].includes(item.type) : false) || /potion|elixir|philter|oil of|scroll of|antitoxin|holy water|alchemist's fire|acid \(vial\)|tanglefoot/i.test(row.name);
const healingDiceFor = (name) => (/potion of.*healing|healing potion/i.test(name) ? HEALING_TIERS.find(([re]) => re.test(name))[1] : null);
function consumableEffectKey(name) {
  const m = name.match(/^\s*(?:potion|philter|elixir|oil)\s+of\s+(.+?)\s*(?:\(.*\))?\s*$/i);
  if (!m) return null;
  const base = m[1].trim().toLowerCase();
  if (POTION_EFFECT_ALIAS[base]) return POTION_EFFECT_ALIAS[base];
  const hit = EFFECT_LIB.find((e) => e.name.toLowerCase() === base);
  return hit ? hit.key : null;
}
const creatureInfo = (b) => ({
  title: b.name,
  meta: [[b.size, b.type].filter(Boolean).join(" "), b.align].filter(Boolean).join(", "),
  block: b,
  foot: `Source: ${sourceOf(b)}`,
});
function infoFor(rawName, customs) {
  const name = String(rawName || "").trim();
  if (!name) return null;
  if (name.startsWith("creature:")) {
    const b = creatureByName(name.slice(9));
    if (b) return creatureInfo(b);
  }
  const strip = baseSubName(name);
  const sp = (customs?.spells || []).find((s) => (s.name === name || s.name === strip) && isSourceEnabled(s));
  if (sp) return {
    title: sp.name,
    meta: [sp.level === 0 ? "Cantrip" : `Level ${sp.level}`, schoolName(sp.school), sp.time && `Cast: ${sp.time}`, sp.range && `Range: ${sp.range}`, sp.components && `Components: ${sp.components}`, sp.duration && `Duration: ${sp.duration}`].filter(Boolean).join(" · "),
    body: sp.text || null, foot: [sourceOf(sp), sp.classes ? `Classes: ${sp.classes}` : null].filter(Boolean).join(" · ") || null,
  };
  const item = (customs?.items || []).find((x) => (x.name === name || x.name === strip) && isSourceEnabled(x));
  if (item) {
    const props = (item.property || "").split(",").map((p) => WEAPON_PROPS[p.trim()] || p.trim()).filter(Boolean).join(", ");
    return {
      title: item.name,
      meta: [ITEM_TYPES[item.type] || item.type, item.ac ? `AC ${item.type === "S" ? "+" : ""}${item.ac}` : "", item.dmg1 ? `${item.dmg1}${item.dmg2 ? ` (${item.dmg2} versatile)` : ""} ${DMG_TYPES[item.dmgType] || item.dmgType || ""}` : "", props, item.range ? `Range ${item.range}` : "", item.strReq ? `Str ${item.strReq} required` : "", item.stealthDis ? "Stealth disadvantage" : "", item.weight ? `${item.weight} lb` : "", item.value ? `${item.value} gp` : ""].filter(Boolean).join(" · "),
      body: item.text || null, foot: sourceOf(item),
    };
  }
  const inv = INVOCATION_DATA.find(([n]) => n === name || n === strip);
  if (inv) return { title: inv[0], meta: ["Eldritch Invocation", inv[1] > 0 ? `requires warlock ${inv[1]}` : "", inv[2] ? `requires ${inv[2]}` : ""].filter(Boolean).join(" · "), body: INVOCATION_INFO[inv[0]] || null, foot: sourceOf({ src: inv[3], sources: inv[4] }) || "Player's Handbook (2014)" };
  const mmObj = (__BASE?.runtime?.metamagic || []).find((m) => m.name === name || m.name === strip);
  if (METAMAGIC_INFO[name]) return { title: name, meta: "Metamagic", body: METAMAGIC_INFO[name], foot: sourceOf(mmObj) || "Player's Handbook (2014) p.101" };
  const mvObj = (__BASE?.runtime?.maneuvers || {})[strip] || (__BASE?.runtime?.maneuvers || {})[name];
  if (MANEUVERS[strip]) return { title: strip, meta: "Battle Master maneuver", body: MANEUVERS[strip] + "\n\nManeuvers ride on superiority dice — a Battle Master's own, or the single d6 the Martial Adept feat grants (regained on a short or long rest).", foot: sourceOf(mvObj) || "Player's Handbook (2014) p.73" };
  const infusion = (__BASE?.runtime?.infusions || []).find((x) => x.name === name || x.name === strip);
  if (infusion) return { title: infusion.name, meta: ["Artificer Infusion", infusion.minLevel ? `requires level ${infusion.minLevel}` : ""].filter(Boolean).join(" · "), body: infusion.desc || null, foot: sourceOf(infusion) };
  const arcaneShot = (__BASE?.runtime?.arcaneShots || []).find((x) => x.name === name || x.name === strip);
  if (arcaneShot) return { title: arcaneShot.name, meta: "Arcane Shot", body: arcaneShot.desc || null, foot: sourceOf(arcaneShot) };
  const rune = (__BASE?.runtime?.runes || []).find((x) => x.name === name || x.name === strip);
  if (rune) return { title: rune.name, meta: "Rune Knight Rune", body: rune.desc || null, foot: sourceOf(rune) };
  const elemDisc = (__BASE?.runtime?.elementalDisciplines || []).find((x) => x.name === name || x.name === strip);
  if (elemDisc) return { title: elemDisc.name, meta: ["Elemental Discipline", elemDisc.minLevel ? `requires monk ${elemDisc.minLevel}` : ""].filter(Boolean).join(" · "), body: elemDisc.desc || null, foot: sourceOf(elemDisc) };
  const boonObj = (__BASE?.runtime?.pactBoons || []).find((b) => b.name === name || b.name === strip);
  if (BOON_INFO[name]) return { title: name, meta: "Pact Boon", body: BOON_INFO[name], foot: sourceOf(boonObj) || "Player's Handbook (2014) p.107" };
  const fs = strip.replace(/^Fighting Style:\s*/, "");
  if (STYLE_DESC[fs] || STYLE_DESC[strip]) return { title: `Fighting Style: ${fs}`, meta: "Fighting Style", body: STYLE_DESC[fs] || STYLE_DESC[strip], foot: (STYLE_DESC[fs]?.includes("Tasha") || fs === "Blind Fighting" || fs === "Interception" || fs === "Superior Technique" || fs === "Thrown Weapon Fighting" || fs === "Unarmed Fighting" || fs === "Blessed Warrior" || fs === "Druidic Warrior" ? "Tasha's Cauldron of Everything p.41" : "Player's Handbook (2014) p.72") };
  if (LANG_INFO[name]) return { title: name, meta: "Language", body: LANG_INFO[name], foot: "Player's Handbook (2014) p.123" };
  if (ABILITY_INFO[name]) return { title: name, meta: "Ability score", body: ABILITY_INFO[name], foot: "Player's Handbook (2014) p.173" };
  if (SKILL_ABIL[name]) return { title: name, meta: `Skill · ${ABIL_NAMES[SKILL_ABIL[name]]}`, body: SKILL_INFO[name], foot: "Player's Handbook (2014) p.174" };
  const cleanNorm = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const stripNorm = String(strip || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const feat = allFeats(customs || EMPTY_CUSTOM).find((f) => {
    const fn = String(f.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return fn === cleanNorm || fn === stripNorm || cleanNorm.startsWith(fn);
  });
  if (feat) return { title: feat.name, meta: ["Feat", feat.prereq && `Prerequisite: ${feat.prereq}`].filter(Boolean).join(" · "), body: feat.text || feat.desc || null, foot: sourceOf(feat) };
  const rt = (__BASE?.runtime?.raceTraits || {})[name] || (__BASE?.runtime?.raceTraits || {})[strip];
  if (rt) return { title: rt.name, meta: rt.race ? `Racial trait · ${rt.race}` : "Racial trait", body: rt.desc, foot: sourceOf(rt) };
  const optF = (__BASE?.runtime?.optionalFeatureMap || {})[name] || (__BASE?.runtime?.optionalFeatureMap || {})[strip];
  if (optF) return { title: optF.name, meta: "Optional Feature", body: optF.desc, foot: sourceOf(optF) };
  const raceData = RACES[name] || RACES[strip];
  if (raceData) {
    const rParts = [];
    if (raceData.flavor) rParts.push(raceData.flavor);
    if (raceData.traits?.length) rParts.push("Racial Traits:\n" + raceData.traits.map((t) => `• ${t}`).join("\n"));
    if (rParts.length || raceData.text) {
      return {
        title: name,
        meta: ["Race", raceData.speed ? `${raceData.speed} ft speed` : null].filter(Boolean).join(" · "),
        body: rParts.join("\n\n") || raceData.text || null,
        foot: sourceOf(raceData) || "Player's Handbook (2014)",
      };
    }
  }
  for (const [cls, arr] of Object.entries(customs?.subs || {})) {
    const s = arr.find((x) => (x.name === name || x.name === strip) && isSourceEnabled(x));
    if (s) return { title: s.name, meta: `${cls} subclass`, body: Object.entries(s.feats).map(([l, fx]) => `Level ${l}: ${fx.join(", ")}`).join("\n"), foot: sourceOf(s) || "Long-press any feature name for its own entry." };
  }
  if (SUB_LORE[strip]) {
    const sl = SUB_LORE[strip];
    const sd = subSpellData(strip === "Circle of the Land" ? name : strip, sl.cls, customs);
    const lines = [sl.flavor];
    if (sd) { lines.push(`${sd.label} — ` + Object.entries(sd.spells).sort((a, b) => a[0] - b[0]).map(([l, arr]) => `${sl.cls} ${l}: ${arr.join(", ")}`).join("; ") + "."); }
    Object.entries(sl.features).sort((a, b) => a[0] - b[0]).forEach(([l, fx]) => fx.forEach((f) => lines.push(`Level ${l} — ${f.n}. ${f.t}`)));
    return { title: strip, meta: `${CLASSES[sl.cls].subName} · ${sl.cls}`, body: lines.join("\n"), foot: SRD_FOOT };
  }
  if (SUB_FEATS[strip]) return { title: strip, meta: "Subclass", body: Object.entries(SUB_FEATS[strip]).map(([l, fx]) => `Level ${l}: ${fx.join(", ")}`).join("\n"), foot: SRD_FOOT };
  const bgd = BACKGROUNDS[name] || BACKGROUNDS[strip];
  if (bgd) {
    const bgTitle = BACKGROUNDS[name] ? name : strip;
    const ftx = (customs?.featureTexts || {})[bgTitle];
    const bgParts = [];
    if (bgd.flavor) bgParts.push(bgd.flavor);
    if (bgd.feature && bgd.featureText) {
      bgParts.push(`Feature: ${bgd.feature}\n${bgd.featureText}`);
    } else if (bgd.text) {
      bgParts.push(bgd.text);
    }
    return {
      title: bgTitle,
      meta: ["Background", `Skills: ${bgd.skills.join(" & ")}`, bgd.langs ? `${bgd.langs} extra language${bgd.langs > 1 ? "s" : ""}` : null, bgd.tools ? `Tools: ${bgd.tools}` : null].filter(Boolean).join(" · "),
      body: ftx || bgParts.join("\n\n"),
      foot: ftx ? sourceOf(ftx) : sourceOf(bgd) || "Player's Handbook (2014) p.125",
    };
  }
  const fSrc = (__BASE?.runtime?.featureSources || {})[name] || (__BASE?.runtime?.featureSources || {})[strip];
  const ft = customs?.featureTexts || {};
  let key = ft[name] ? name : ft[strip] ? strip : Object.keys(ft).find((k) => baseSubName(k) === strip || k.startsWith(strip + " ("));
  if (!key) { const cp = name.match(/^([^:]+):/); if (cp && ft[cp[1].trim()]) key = cp[1].trim(); }
  if (!key) key = Object.keys(ft).filter((k) => k.length > 3 && strip.startsWith(k + " ")).sort((a, b) => b.length - a.length)[0];
  if (key) return { title: strip, meta: "Feature", body: ft[key], foot: sourceOf(fSrc) || sourceOf(ft[key]) || SRD_FOOT };
  if (FEATURE_TEXT[name] || FEATURE_TEXT[strip]) return { title: strip, meta: "Feature", body: FEATURE_TEXT[name] || FEATURE_TEXT[strip], foot: sourceOf(fSrc) || SRD_FOOT };
  if (CORE_FEATURE_INFO[strip]) return { title: strip, meta: "Feature", body: CORE_FEATURE_INFO[strip], foot: sourceOf(fSrc) || "Player's Handbook (2014)" };
  const eff = EFFECT_LIB.find((x) => x.name === name || x.name === strip);
  if (eff) return { title: eff.name, meta: [eff.kind === "Condition" ? "Condition" : `${eff.kind} · trackable effect`, eff.conc && "Concentration", eff.dur].filter(Boolean).join(" · "), body: [eff.brief, eff.desc].filter(Boolean).join("\n"), foot: "Player's Handbook (2014) p.290" };
  const bgFeat = Object.entries(BACKGROUNDS).find(([, b]) => b.feature === name || b.feature === strip);
  if (bgFeat) return { title: bgFeat[1].feature, meta: `Background feature · ${bgFeat[0]}`, body: bgFeat[1].featureText, foot: sourceOf(bgFeat[1]) || "Player's Handbook (2014)" };
  const beast = creatureByName(name) || creatureByName(strip);
  if (beast) return creatureInfo(beast);
  return null;
}
const allSubs = (cls, customs) => {
  const imported = customs?.subs?.[cls] || [];
  const activeImported = imported.filter(isSourceEnabled);
  const activeNames = new Set(activeImported.map((sub) => sub.name));
  const staticNames = (CLASSES[cls]?.subs || []).filter((name) => {
    const record = imported.find((sub) => sub.name === name);
    return !record || isSourceEnabled(record);
  });
  return staticNames.concat(activeImported.map((sub) => sub.name).filter((name) => !activeNames.has(name) || !staticNames.includes(name)));
};
const customSubFeats = (subclass, level, customs) => {
  for (const arr of Object.values(customs?.subs || {})) {
    const hit = arr.find((s) => s.name === subclass || s.name === baseSubName(subclass));
    if (hit) return hit.feats?.[level] || [];
  }
  return [];
};
const allSubFeats = (subclass, level, customs) =>
  SUB_FEATS[baseSubName(subclass || "")]
    ? subFeatsFor(subclass, level)
    : subFeatsFor(subclass, level).concat(customSubFeats(subclass, level, customs));
const allFeats = (customs) => {
  const imported = customs?.feats || [];
  const map = new Map((imported.some((f) => f.canonical) ? [] : FEATS).map((f) => [f.name, f]));
  imported.forEach((f) => {
    const base = map.get(f.name);
    const fx = FEAT_MECHANICS[f.name];
    map.set(f.name, {
      cat: base?.cat || "Imported", ...f,
      ...(!f.canonical && !f.bump?.length && fx?.bump ? { bump: fx.bump } : {}),
    });
  });
  return [...map.values()].filter(isSourceEnabled).map((f) => ({ ...f, pick: featPickOf(f.name, f) }));
};
const featChoiceSummary = (ch, name) => {
  const c = featChoiceOf(ch, name);
  return [
    c.bump ? `+1 ${c.bump.toUpperCase()}` : null, c.choice,
    ...(c.skills || []), ...(c.expertise || []).map((x) => `★ ${x}`), ...(c.langs || []),
    ...(c.cantrips || []), ...(c.spells || []), ...(c.maneuvers || []),
  ].filter(Boolean).join(", ");
};
const loreName = (t) => String(t || "").replace(/\s*\(.*$/, "");
function featureBuckets(ch, customs) {
  const text = (name, cls) => featureBody(name, cls, customs) || infoFor(name, customs)?.body || null;
  const item = (name, extra = {}) => ({ name, lore: name, body: text(extra.lore || name, extra.cls), ...extra });
  const buckets = [];
  const race = RACES[ch.race];
  const rc = ch.racialChoices || {};
  buckets.push({ key: "race", label: "Race", title: ch.race, items: [
    ...(race?.traits || []).map((t) => item(t, { lore: loreName(t) })),
    ...(rc.ancestry ? [{ name: `${rc.ancestry} Dragon Ancestry`, lore: "Draconic Ancestry", detail: `${ANCESTRIES[rc.ancestry]} breath weapon & resistance`, body: text("Draconic Ancestry") }] : []),
    ...(rc.cantrip ? [item(rc.cantrip, { detail: "racial cantrip" })] : []),
    ...(rc.lineage ? [{ name: rc.lineage === "darkvision" ? "Darkvision 60 ft" : "Extra skill proficiency", detail: "lineage gift" }] : []),
  ] });
  const bg = BACKGROUNDS[ch.background];
  const bgProfs = bg ? [bg.skills?.length ? `Skills: ${bg.skills.join(" & ")}` : null, bg.tools ? `Tools: ${bg.tools}` : null, bg.langs ? `${bg.langs} extra language${bg.langs > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") : "";
  buckets.push({ key: "background", label: "Background", title: ch.background, items: [
    ...(bg?.feature ? [{ name: bg.feature, lore: bg.feature, body: (customs?.featureTexts || {})[ch.background] || bg.featureText }] : []),
    ...(bgProfs ? [{ name: "Proficiencies", detail: bgProfs }] : []),
  ] });
  const styleHost = ch.classes.find((c) => Object.values(CLASSES[c.name]?.feats || {}).flat().includes("Fighting Style")) || ch.classes[0];
  const choiceHost = (key) => ch.classes.find((c) => c.name === CHOICE_GROUPS.find((g) => g.key === key)?.cls) || ch.classes[0];
  ch.classes.forEach((c) => {
    const cls = CLASSES[c.name];
    if (!cls) return;
    const items = [];
    const gear = ch.classes[0] === c ? PROF_TEXT[c.name] : MC_PROFS[c.name];
    items.push({ name: "Proficiencies", level: 1, detail: [gear, ch.classes[0] === c && cls.saves?.length ? `saves ${cls.saves.map((a) => a.toUpperCase()).join(" & ")}` : null].filter(Boolean).join(" · ") || "—" });
    for (let l = 1; l <= c.level; l++) {
      (cls.feats[l] || []).filter((f) => !(c.subclass && /\bfeature\b$/i.test(f))).forEach((f) => {
        const name = c.name === "Rogue" && /^Sneak Attack/.test(f) ? `Sneak Attack (${Math.ceil(c.level / 2)}d6)` : f;
        items.push(item(name, { lore: f, cls: c.name, level: l }));
      });
      if (cls.asi.includes(l)) items.push(item(ASI, { cls: c.name, level: l }));
    }
    if (c === styleHost) (ch.styles || []).forEach((st) => items.push(item(`Fighting Style: ${st}`, { detail: STYLE_DESC[st] })));
    if (c.name === "Sorcerer") (ch.metamagic || []).forEach((m) => items.push(item(m, { detail: "metamagic" })));
    if (c.name === "Warlock") {
      if (ch.pactBoon) items.push(item(ch.pactBoon, { detail: "pact boon" }));
      (ch.invocations || []).forEach((inv) => items.push(item(inv, { detail: "eldritch invocation" })));
    }
    if (c.name === "Ranger" && ch.rangerChoices) {
      const foes = [ch.rangerChoices.favEnemy, ...(ch.rangerChoices.extraEnemies || [])].filter(Boolean);
      const lands = [ch.rangerChoices.natTerrain, ...(ch.rangerChoices.extraTerrains || [])].filter(Boolean);
      if (foes.length) items.push(item("Favored Enemy", { detail: foes.join(", ") }));
      if (lands.length) items.push(item("Natural Explorer", { detail: lands.join(", ") }));
    }
    Object.entries(ch.choices || {}).filter(([k, v]) => v?.length && choiceHost(k) === c).forEach(([k, v]) => v.forEach((n) => items.push(item(n, { detail: k }))));
    buckets.push({ key: `class:${c.name}`, label: `Class · level ${c.level}`, title: c.name, cls: c.name, items });
    if (c.subclass) {
      const subItems = [];
      for (let l = 1; l <= c.level; l++) allSubFeats(c.subclass, l, customs).forEach((f) => subItems.push(item(f, { cls: c.name, level: l })));
      const sd = subSpellData(c.subclass, c.name, customs);
      const granted = sd ? Object.entries(sd.spells).filter(([l]) => +l <= c.level).flatMap(([, arr]) => arr) : [];
      if (granted.length) subItems.push({ name: sd.label, detail: granted.join(", ") });
      buckets.push({ key: `sub:${c.name}`, label: cls.subName, title: c.subclass, cls: c.name, items: subItems });
    }
  });
  buckets.push({ key: "feats", label: null, title: "Feats", items: (ch.feats || []).map((f) => item(f, { detail: featChoiceSummary(ch, f) || null })) });
  buckets.push({ key: "boons", label: null, title: "Boons & Grants", items: (ch.boons || []).map((b) => ({ id: b.id, name: b.name, detail: b.source || null, body: b.text || null })) });
  return buckets.filter((b) => b.items.length || b.key === "boons");
}
const b64uFromBytes = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const bytesFromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const pipeBytes = async (bytes, transform) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());
function shareCustomsFor(ch, customs) {
  const own = stripBase(customs, __BASE);
  const norm = (s) => String(s || "").toLowerCase();
  const spellNames = new Set();
  const addSpell = (n) => n && spellNames.add(norm(n));
  Object.values(ch.spells || {}).forEach((b) => {
    (b.cantrips || []).forEach(addSpell);
    (b.spells || []).forEach(addSpell);
    Object.values(b.arcanum || {}).forEach(addSpell);
  });
  (ch.tomeCantrips || []).forEach(addSpell);
  (ch.boasRituals || []).forEach(addSpell);
  addSpell(ch.racialChoices?.cantrip);
  Object.values(ch.choices || {}).forEach((v) => (Array.isArray(v) ? v : [v]).forEach(addSpell));
  (ch.feats || []).forEach((fn) => {
    const c = featChoiceOf(ch, fn);
    [...(c.cantrips || []), ...(c.spells || []), ...featGrantedSpells(fn, totalLevel(ch))].forEach(addSpell);
  });
  raceGrantedSpells(ch).forEach(addSpell);
  if (ch.classes.some((c) => c.name === "Ranger")) addSpell("Hunter's Mark");
  const itemNames = new Set((ch.inventory || []).map((r) => norm(r.name)));
  const subKeep = new Set(ch.classes.flatMap((c) => (c.subclass ? [norm(c.subclass), norm(baseSubName(c.subclass))] : [])));
  const subs = {};
  Object.entries(own.subs || {}).forEach(([cls, arr]) => {
    const keep = arr.filter((s) => subKeep.has(norm(s.name)) || subKeep.has(norm(baseSubName(s.name))));
    if (keep.length) subs[cls] = keep;
  });
  const featureNames = new Set();
  const addFeature = (n) => n && featureNames.add(norm(baseSubName(String(n).replace(/\s*\(.*$/, ""))));
  ch.classes.forEach((c) => {
    for (let l = 1; l <= c.level; l++) {
      (CLASSES[c.name].feats[l] || []).forEach(addFeature);
      allSubFeats(c.subclass, l, customs).forEach(addFeature);
    }
  });
  (ch.feats || []).forEach(addFeature);
  (ch.invocations || []).forEach(addFeature);
  (ch.metamagic || []).forEach(addFeature);
  addFeature(ch.pactBoon);
  (RACES[ch.race]?.traits || []).forEach(addFeature);
  const featureTexts = {};
  Object.entries(own.featureTexts || {}).forEach(([k, v]) => { if (featureNames.has(norm(baseSubName(k)))) featureTexts[k] = v; });
  return {
    subs,
    feats: (own.feats || []).filter((f) => (ch.feats || []).some((n) => norm(n) === norm(f.name))),
    spells: (own.spells || []).filter((sp) => spellNames.has(norm(sp.name))),
    items: (own.items || []).filter((it) => itemNames.has(norm(it.name))),
    featureTexts,
  };
}
function getRacialBonusPool(raceData, race) {
  if (!raceData) return [2, 1];
  if (race === "Human") return [2, 1];
  const pool = [];
  Object.values(raceData.bonus || {}).forEach((v) => {
    if (typeof v === "number" && v > 0) pool.push(v);
  });
  const chooseCount = raceData.choose || 0;
  const chooseAmt = raceData.chooseAmt || 1;
  for (let i = 0; i < chooseCount; i++) {
    pool.push(chooseAmt);
  }
  pool.sort((a, b) => b - a);
  return pool.length > 0 ? pool : [2, 1];
}
function getDefaultRacialSlots(raceData, race) {
  if (!raceData) return ["str", "dex"];
  if (race === "Human") return ["str", "dex"];
  const fixed = Object.entries(raceData.bonus || {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const remaining = ABILITIES.filter((a) => !fixed.includes(a));
  const chooseCount = raceData.choose || 0;
  const slots = [...fixed];
  for (let i = 0; i < chooseCount; i++) {
    const candidate = remaining.find((a) => !(raceData.chooseNot || []).includes(a) && !slots.includes(a));
    if (candidate) slots.push(candidate);
  }
  return slots;
}
function formatStandardRaceBonus(raceData, race) {
  if (race === "Human") return "+1 to all";
  if (!raceData) return "+2 / +1";
  const parts = [];
  Object.entries(raceData.bonus || {}).forEach(([a, v]) => {
    if (v > 0) parts.push(`${a.toUpperCase()} +${v}`);
  });
  if (raceData.choose) {
    parts.push(`+${raceData.chooseAmt || 1} to ${raceData.choose === 1 ? "one choice" : `${raceData.choose} choices`}`);
  }
  return parts.join(", ") || "+2 / +1";
}
const searchRank = (name, q) => {
  const n = name.toLowerCase(), s = q.toLowerCase();
  return n === s ? 0 : n.startsWith(s) ? 1 : 2;
};
const schoolName = (s) => SCHOOL_NAMES[(s || "").toUpperCase()] || s;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export { mod, fmtMod, profBonus, subSpellData, meetsPrereq, featureBody, featChoiceOf, featEffects, hasStyle, featHpBonus, featBlockedBy, featPickOf, featGrantedSpells, raceGrantedSpells, featSpellsOf, featPickDone, spellCapacity, maxSpellLevel, foldStarredSpells, spellFitsClass, spellSlots, totalLevel, isTechnique, choiceCum, groupMatches, choiceOptionsFor, characterChoiceGroups, allKnownCantrips, sourceOf, findItem, isArmorType, isWeaponType, equippedOf, canEquip, armorClass, classLevel, hasSub, hasFeat, effectsOf, knownSpellNames, EFFECT_LIB, EFFECT_BY_KEY, hasEffect, effDefOf, isConcDef, isConcInst, effEnds, instMaxHp, describeCustomFx, applyEffectPatch, fxMods, effMaxHp, speedOf, useTrackersFor, minionsOf, crShow, creatureByName, summonFormsFor, SUMMON_LIB, summonDefFor, spiritHp, spiritAc, spiritDefFromSpell, minionAttackRolls, summonerSpellAtk, minionSaves, minionSkills, minionHp, minionApplyHp, isBladeCantrip, bladeRiderTier, strikeProfile, useRecipe, usesAmmo, ammoRowFor, isConsumableRow, healingDiceFor, consumableEffectKey, allSubs, allSubFeats, allFeats, b64uFromBytes, bytesFromB64u, pipeBytes, shareCustomsFor, getRacialBonusPool, getDefaultRacialSlots, formatStandardRaceBonus, searchRank, schoolName, round2, infoFor, featChoiceSummary, featureBuckets };
