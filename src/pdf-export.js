// Fills the official WotC fillable 5e character sheet (public/5e-character-sheet.pdf) from a
// ledger character. Derived numbers mirror Sheet.jsx so the paper matches the screen.
import { ABILITIES, ABIL_NAMES, ALL_SKILLS, CLASSES, DMG_TYPES, MC_PROFS, PACT, PREP_ALL_CLASSES, PROF_TEXT, SKILL_ABIL, SPELL_ABILITY } from "./data.js";
import { rollFeatures } from "./dice.jsx";
import { assetUrl, frameRect } from "./portrait.js";
import { allKnownCantrips, armorClass, bonusProfsOf, canEquip, effMaxHp, effectiveAbilities, equippedOf, featEffects, featureBuckets, findItem, fmtMod, fxMods, gearMods, hasStyle, hasSub, isWeaponType, mod, profBonus, profSummary, spellGrantsOf, spellSlots, speedOf, totalLevel } from "./rules.js";

const TEMPLATE = "5e-character-sheet.pdf";
const SAVE_BOX = { str: 11, dex: 18, con: 19, int: 20, wis: 21, cha: 22 };
const ABIL_FIELD = { str: ["STR", "STRmod"], dex: ["DEX", "DEXmod "], con: ["CON", "CONmod"], int: ["INT", "INTmod"], wis: ["WIS", "WISmod"], cha: ["CHA", "CHamod"] };
const SAVE_FIELD = { str: "ST Strength", dex: "ST Dexterity", con: "ST Constitution", int: "ST Intelligence", wis: "ST Wisdom", cha: "ST Charisma" };
// Skill text field and proficiency checkbox, in the sheet's printed order.
const SKILL_FIELD = {
  Acrobatics: ["Acrobatics", 23], "Animal Handling": ["Animal", 24], Arcana: ["Arcana", 25], Athletics: ["Athletics", 26], Deception: ["Deception ", 27], History: ["History ", 28],
  Insight: ["Insight", 29], Intimidation: ["Intimidation", 30], Investigation: ["Investigation ", 31], Medicine: ["Medicine", 32], Nature: ["Nature", 33], Perception: ["Perception ", 34],
  Performance: ["Performance", 35], Persuasion: ["Persuasion", 36], Religion: ["Religion", 37], "Sleight of Hand": ["SleightofHand", 38], Stealth: ["Stealth ", 39], Survival: ["Survival", 40],
};
const WEAPON_FIELDS = [["Wpn Name", "Wpn1 AtkBonus", "Wpn1 Damage"], ["Wpn Name 2", "Wpn2 AtkBonus ", "Wpn2 Damage "], ["Wpn Name 3", "Wpn3 AtkBonus  ", "Wpn3 Damage "]];
// Page 3 rows, top to bottom, as [text field, prepared checkbox]. Indexed by spell level; cantrips have no box.
const CANTRIP_ROWS = ["Spells 1014", "Spells 1016", "Spells 1017", "Spells 1018", "Spells 1019", "Spells 1020", "Spells 1021", "Spells 1022"];
const SPELL_ROWS = {
  1: [[1015, 251], [1023, 309], [1024, 3010], [1025, 3011], [1026, 3012], [1027, 3013], [1028, 3014], [1029, 3015], [1030, 3016], [1031, 3017], [1032, 3018], [1033, 3019]],
  2: [[1046, 313], [1034, 310], [1035, 3020], [1036, 3021], [1037, 3022], [1038, 3023], [1039, 3024], [1040, 3025], [1041, 3026], [1042, 3027], [1043, 3028], [1044, 3029], [1045, 3030]],
  3: [[1048, 315], [1047, 314], [1049, 3031], [1050, 3032], [1051, 3033], [1052, 3034], [1053, 3035], [1054, 3036], [1055, 3037], [1056, 3038], [1057, 3039], [1058, 3040], [1059, 3041]],
  4: [[1061, 317], [1060, 316], [1062, 3042], [1063, 3043], [1064, 3044], [1065, 3045], [1066, 3046], [1067, 3047], [1068, 3048], [1069, 3049], [1070, 3050], [1071, 3051], [1072, 3052]],
  5: [[1074, 319], [1073, 318], [1075, 3053], [1076, 3054], [1077, 3055], [1078, 3056], [1079, 3057], [1080, 3058], [1081, 3059]],
  6: [[1083, 321], [1082, 320], [1084, 3060], [1085, 3061], [1086, 3062], [1087, 3063], [1088, 3064], [1089, 3065], [1090, 3066]],
  7: [[1092, 323], [1091, 322], [1093, 3067], [1094, 3068], [1095, 3069], [1096, 3070], [1097, 3071], [1098, 3072], [1099, 3073]],
  8: [[10101, 325], [10100, 324], [10102, 3074], [10103, 3075], [10104, 3076], [10105, 3077], [10106, 3078]],
  9: [[10108, 327], [10107, 326], [10109, 3079], [101010, 3080], [101011, 3081], [101012, 3082], [101013, 3083]],
};
const SLOT_FIELDS = { 1: 19, 2: 20, 3: 21, 4: 22, 5: 23, 6: 24, 7: 25, 8: 26, 9: 27 };

// The template's fonts are WinAnsi; anything else would throw at fill time.
const ascii = (s) => String(s ?? "").replace(/[★◆◇✦✓]/g, "").replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\n]/g, "").replace(/[ \t]+\n/g, "\n").trim();

// pdf-lib's auto-size grows text to fill the box; short lists would come out enormous. Cap it.
function fitSize(font, text, width, height, max, multiline) {
  const lines = text.split("\n");
  let size = 4;
  while (size <= max) {
    let used = 0;
    for (const line of lines) {
      let left = width;
      used += 1;
      for (const w of line.split(" ")) {
        const ww = font.widthOfTextAtSize(w + " ", size);
        left -= ww;
        if (left <= 0) { used += 1; left = width - ww; }
      }
    }
    if (!multiline && used > lines.length) return Math.max(4, size - 1);
    if (font.heightAtSize(size) * (multiline ? 1.2 : 1) * used > height) return Math.max(4, size - 1);
    size += 1;
  }
  return max;
}

async function portraitPng(ch) {
  const url = ch.portrait?.id ? await assetUrl(ch.portrait.id).catch(() => null) : null;
  const src = url || ch.photo;
  if (!src) return null;
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  if (url && ch.portrait) { const { sx, sy, side } = frameRect(ch.portrait); ctx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512); }
  else ctx.drawImage(img, 0, 0, 512, 512);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

// Everything the sheet prints, computed once so the fill step is pure plumbing.
export function characterSheetFacts(storedCh, customs) {
  const gearAbilities = effectiveAbilities(storedCh, customs);
  const ch = { ...storedCh, abilities: gearAbilities.abilities };
  const lvl = totalLevel(ch);
  const pb = profBonus(lvl);
  const fx = fxMods(ch);
  const gear = gearMods(ch, customs);
  fx.save.push(...gear.save);
  fx.atk.push(...gear.spellAtk);
  const feats = rollFeatures(ch);
  const fEff = featEffects(ch, customs);
  const saveProf = (a) => CLASSES[ch.classes[0].name].saves.includes(a) || feats.diamondSoul || ((feats.slipperyMind || feats.ironMind) && a === "wis") || fEff.saves.some((s) => s.abil === a);
  const halfProf = (a) => Math.max(["str", "dex", "con"].includes(a) ? feats.athlete : 0, feats.jack);
  const sum = (parts) => parts.reduce((s, p) => s + p.value, 0);
  const inScope = (b, scope, abil, props) => (b.scope === "all" || b.scope === scope || (b.scope === "weapon" && scope !== "spell")) && (!b.abil || b.abil === abil) && (!b.prop || (props || []).includes(b.prop));
  const fxAtk = (scope, abil, props) => sum(fx.atk.filter((b) => inScope(b, scope, abil, props)));
  const fxDmg = (scope, abil, props) => sum(fx.dmg.filter((b) => inScope(b, scope, abil, props)));

  const saves = Object.fromEntries(ABILITIES.map((a) => [a, { prof: saveProf(a), value: mod(ch.abilities[a]) + (saveProf(a) ? pb : 0) + feats.aura + sum(fx.save) }]));
  const skills = Object.fromEntries(ALL_SKILLS.map((sk) => {
    const a = SKILL_ABIL[sk], prof = ch.skills.includes(sk), exp = (ch.expertise || []).includes(sk);
    return [sk, { prof, value: mod(ch.abilities[a]) + (prof ? pb * (exp ? 2 : 1) : halfProf(a)) }];
  }));
  const initiative = mod(ch.abilities.dex) + halfProf("dex") + (fEff.init?.value || 0) + (hasSub(ch, "Gloom Stalker") ? mod(ch.abilities.wis) : 0);

  const shill = (it) => fx.shillelagh && /\b(club|quarterstaff)\b/i.test(it.name);
  const weapons = equippedOf(ch).map((r) => findItem(r.name, customs)).filter((it) => it && isWeaponType(it.type)).map((it) => {
    const props = (it.property || "").split(",").map((x) => x.trim());
    const abil = shill(it) ? fx.shillelagh.abil : it.type === "R" ? "dex" : props.includes("F") && mod(ch.abilities.dex) > mod(ch.abilities.str) ? "dex" : "str";
    const scope = it.type === "R" ? "ranged" : "melee";
    const magic = gear.weapon[it.name] || 0;
    const atk = mod(ch.abilities[abil]) + (canEquip(it, ch, customs) ? pb : 0) + magic + (it.type === "R" ? feats.archery : 0) + fxAtk(scope, abil, props);
    const dueling = hasStyle(ch, "Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0;
    const dmgBonus = mod(ch.abilities[abil]) + dueling + magic + fxDmg(scope, abil, props);
    const die = shill(it) ? "1d8" : it.dmg1 || "1d4";
    return { name: it.name, atk, damage: `${die}${dmgBonus ? fmtMod(dmgBonus) : ""} ${DMG_TYPES[it.dmgType] || ""}`.trim() };
  });

  const casters = ch.classes.filter((c) => CLASSES[c.name].caster && SPELL_ABILITY[c.name]);
  const casting = casters.map((c) => {
    const a = SPELL_ABILITY[c.name];
    return { cls: c.name, abil: ABIL_NAMES[a], dc: 8 + pb + mod(ch.abilities[a]) + gear.spellDc, atk: pb + mod(ch.abilities[a]) + fxAtk("spell", a) };
  });
  const attackLines = [
    `Melee ${fmtMod(mod(ch.abilities.str) + pb + fxAtk("melee", "str"))} · Ranged/Finesse ${fmtMod(mod(ch.abilities.dex) + pb + feats.archery + fxAtk("ranged", "dex"))}`,
    ...casting.map((c) => `${c.cls} spells: ${fmtMod(c.atk)} to hit, DC ${c.dc}`),
  ];

  const pool = customs?.spells || [];
  const levelOf = (name) => pool.find((s) => s.name === name)?.level;
  const byLevel = Array.from({ length: 10 }, () => []);
  const seen = new Set();
  const addSpell = (name, level) => {
    if (seen.has(name) || level == null || level > 9) return;
    seen.add(name);
    byLevel[level].push(name);
  };
  allKnownCantrips(ch, customs).forEach((n) => addSpell(n, 0));
  Object.values(ch.spells || {}).forEach((b) => {
    (b.spells || []).forEach((n) => addSpell(n, levelOf(n)));
    Object.entries(b.arcanum || {}).forEach(([l, n]) => addSpell(n, +l));
  });
  (ch.boasRituals || []).forEach((n) => addSpell(n, levelOf(n)));
  spellGrantsOf(ch, customs).forEach((g) => addSpell(g.spell, levelOf(g.spell)));

  const slots = spellSlots(ch.classes) || [];
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const pact = wl ? PACT(wl.level) : null;
  const usedSlots = ch.usedSlots || [];

  // Proficiency rows live in their own box; long feature details are trimmed so the names stay the point.
  const buckets = featureBuckets(ch, customs).map((b) => ({ ...b, items: b.items.filter((it) => !/^Proficiencies\b/.test(it.name)) }));
  const clip = (s) => (s.length > 90 ? `${s.slice(0, 88).trimEnd()}…` : s);
  const bucketText = (b) => [b.title, ...b.items.map((it) => `  ${it.name}${it.detail ? ` — ${clip(it.detail)}` : ""}`)].join("\n");
  const core = buckets.filter((b) => b.key === "race" || b.key.startsWith("class:") || b.key.startsWith("sub:"));
  const extra = buckets.filter((b) => !core.includes(b) && b.items.length);

  const profLines = [
    ...ch.classes.map((c, i) => `${c.name}: ${i === 0 ? PROF_TEXT[c.name] : MC_PROFS[c.name]}`),
    ...bonusProfsOf(ch, customs).map((p) => `${p.source}: ${profSummary(p)}`),
    ch.languages?.length ? `Languages: ${ch.languages.join(", ")}` : null,
  ].filter(Boolean);

  const treasureTypes = new Set(["W", "RG", "WD", "ST", "RD", "SC", "P"]);
  const inventory = (ch.inventory || []).map((r) => ({ r, it: findItem(r.name, customs) }));
  const line = ({ r }) => `${r.name}${(r.qty || 1) > 1 ? ` ×${r.qty}` : ""}${r.equipped ? " (equipped)" : ""}${r.attuned ? " (attuned)" : ""}`;

  return {
    ch, lvl, pb, saves, skills, initiative, weapons, casting, attackLines, byLevel, slots, pact, usedSlots,
    ac: armorClass(ch, customs, fx).ac,
    speed: speedOf(ch, customs, fx).v,
    maxHp: effMaxHp(ch, fx),
    passive: 10 + mod(ch.abilities.wis) + (ch.skills.includes("Perception") ? pb : 0),
    hitDice: ch.classes.map((c) => `${c.level}d${CLASSES[c.name].die}`).join(" + "),
    classLine: ch.classes.map((c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ""} ${c.level}`).join(" / "),
    features: core.map(bucketText).join("\n\n"),
    extraFeatures: extra.map(bucketText).join("\n\n"),
    profs: profLines.join("\n"),
    equipment: inventory.filter((x) => !treasureTypes.has(x.it?.type)).map(line).join("\n"),
    treasure: inventory.filter((x) => treasureTypes.has(x.it?.type)).map(line).join("\n"),
  };
}

// Returns the filled PDF bytes plus notes about anything that did not fit the paper.
export async function buildCharacterPdf(storedCh, customs) {
  const [{ PDFDocument, StandardFonts }, res] = await Promise.all([import("pdf-lib"), fetch(TEMPLATE)]);
  if (!res.ok) throw new Error("The blank sheet could not be fetched.");
  const doc = await PDFDocument.load(await res.arrayBuffer());
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const notes = [];
  const f = characterSheetFacts(storedCh, customs);
  const ch = f.ch;

  const text = (name, value, max = 12) => {
    const field = form.getTextField(name);
    const s = ascii(value);
    field.setText(s);
    if (!s) return;
    const { width, height } = field.acroField.getWidgets()[0].getRectangle();
    // Most template fields carry no /DA; write one so the size sticks and the text is black.
    const multi = field.isMultiline();
    field.acroField.setDefaultAppearance(`/Helv ${fitSize(font, s, width - 4, height - (multi ? 4 : 1), max, multi)} Tf 0 g`);
    field.markAsDirty();
  };
  const check = (n, on) => { const box = form.getCheckBox(`Check Box ${n}`); if (on) box.check(); else box.uncheck(); };

  text("CharacterName", ch.name, 16);
  text("CharacterName 2", ch.name, 16);
  text("ClassLevel", f.classLine);
  text("Background", ch.background);
  text("Race ", ch.race);
  text("Alignment", ch.alignment);
  text("ProfBonus", fmtMod(f.pb), 14);
  ABILITIES.forEach((a) => {
    text(ABIL_FIELD[a][0], String(ch.abilities[a]), 20);
    text(ABIL_FIELD[a][1], fmtMod(mod(ch.abilities[a])), 10);
    text(SAVE_FIELD[a], fmtMod(f.saves[a].value), 8);
    check(SAVE_BOX[a], f.saves[a].prof);
  });
  ALL_SKILLS.forEach((sk) => {
    text(SKILL_FIELD[sk][0], fmtMod(f.skills[sk].value), 8);
    check(SKILL_FIELD[sk][1], f.skills[sk].prof);
  });
  text("Passive", String(f.passive), 14);
  text("AC", String(f.ac), 18);
  text("Initiative", fmtMod(f.initiative), 18);
  text("Speed", String(f.speed), 18);
  text("HPMax", String(f.maxHp), 9);
  text("HPCurrent", String(Math.max(0, f.maxHp - Math.max(0, ch.dmg || 0))), 20);
  text("HPTemp", ch.tempHp ? String(ch.tempHp) : "", 20);
  text("HDTotal", f.hitDice, 8);
  text("HD", f.hitDice, 12);
  text("GP", String(Math.floor(ch.gold ?? 0)), 12);

  f.weapons.slice(0, 3).forEach((w, i) => {
    text(WEAPON_FIELDS[i][0], w.name, 9);
    text(WEAPON_FIELDS[i][1], fmtMod(w.atk), 9);
    text(WEAPON_FIELDS[i][2], w.damage, 9);
  });
  const moreWeapons = f.weapons.slice(3).map((w) => `${w.name} ${fmtMod(w.atk)}, ${w.damage}`);
  if (moreWeapons.length) notes.push(`${moreWeapons.length} equipped weapon${moreWeapons.length > 1 ? "s" : ""} beyond the third listed under Attacks & Spellcasting.`);

  // Spells: fill rows per level; whatever overflows goes to the attacks box with a note.
  const overflow = [];
  const rowSets = { 0: CANTRIP_ROWS.map((n) => [n, null]), ...Object.fromEntries(Object.entries(SPELL_ROWS).map(([l, rows]) => [l, rows.map(([t, c]) => [`Spells ${t}`, c])])) };
  f.byLevel.forEach((list, level) => {
    const rows = rowSets[level];
    list.forEach((name, i) => {
      if (i >= rows.length) { overflow.push(`${name} (${level ? `L${level}` : "cantrip"})`); return; }
      text(rows[i][0], name, 9);
      if (rows[i][1]) check(rows[i][1], true);
    });
  });
  if (overflow.length) notes.push(`${overflow.length} spell${overflow.length > 1 ? "s" : ""} did not fit the spell pages; listed under Attacks & Spellcasting.`);
  for (let l = 1; l <= 9; l++) {
    const std = f.slots[l - 1] || 0;
    const pactHere = f.pact?.lvl === l ? f.pact.n : 0;
    if (!std && !pactHere) continue;
    const total = std && pactHere ? `${std} + ${pactHere} pact` : pactHere ? `${pactHere} pact` : String(std);
    const used = Math.min(f.usedSlots[l - 1] || 0, std) + (pactHere ? Math.min(ch.usedPact || 0, pactHere) : 0);
    text(`SlotsTotal ${SLOT_FIELDS[l]}`, total, 14);
    text(`SlotsRemaining ${SLOT_FIELDS[l]}`, used ? String(used) : "", 14);
  }
  text("Spellcasting Class 2", f.casting.map((c) => c.cls).join(" / "), 16);
  text("SpellcastingAbility 2", [...new Set(f.casting.map((c) => c.abil))].join(" / "), 14);
  text("SpellSaveDC  2", [...new Set(f.casting.map((c) => c.dc))].join(" / "), 18);
  text("SpellAtkBonus 2", [...new Set(f.casting.map((c) => fmtMod(c.atk)))].join(" / "), 18);

  text("AttacksSpellcasting", [
    ...f.attackLines,
    moreWeapons.length ? `Also wielding: ${moreWeapons.join("; ")}` : null,
    f.pact ? `Pact Magic: ${f.pact.n} slot${f.pact.n > 1 ? "s" : ""} of level ${f.pact.lvl}, back on a short rest.` : null,
    overflow.length ? `More spells: ${overflow.join(", ")}` : null,
  ].filter(Boolean).join("\n"), 9);
  text("ProficienciesLang", f.profs, 9);
  text("Equipment", f.equipment, 9);
  text("Features and Traits", f.features, 9);
  text("Feat+Traits", f.extraFeatures, 9);
  text("Treasure", f.treasure, 9);
  text("Backstory", ch.notes || "", 9);

  try {
    const png = await portraitPng(ch);
    if (png) form.getButton("CHARACTER IMAGE").setImage(await doc.embedPng(png));
  } catch { notes.push("The portrait could not be placed on page 2."); }

  form.updateFieldAppearances(font);
  return { bytes: await doc.save(), notes };
}

export async function downloadCharacterPdf(ch, customs) {
  const { bytes, notes } = await buildCharacterPdf(ch, customs);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ch.name || "character").replace(/[^\w -]/g, "").trim() || "character"} — character sheet.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return notes;
}
