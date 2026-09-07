// src/roll20-export.js
// Versioned export engine for Adventurer's Ledger -> Roll20 Jumpgate / Classic OGL 5e

import {
  ABILITIES,
  ABIL_NAMES,
  ALL_SKILLS,
  CLASSES,
  RACES,
  PACT
} from "./data.js";

import {
  mod,
  profBonus,
  totalLevel,
  spellSlots,
  effectiveAbilities,
  armorClass,
  speedOf,
  effMaxHp,
  featureBuckets,
  featureBody,
  allKnownCantrips,
  spellGrantsOf,
  findItem,
  isWeaponType,
  schoolName,
  featEffects,
  hasFeat,
  bonusProfsOf
} from "./rules.js";

const ROLL20_ABILITIES = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma"
};

const NORM = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

function parseSpellStats(sp) {
  const text = sp.text || sp.desc || "";
  let save = "";
  const saveMatch = text.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
  if (saveMatch) {
    save = saveMatch[1].charAt(0).toUpperCase() + saveMatch[1].slice(1).toLowerCase();
  }
  let saveSuccess = "";
  if (save) {
    if (/half as much damage/i.test(text)) saveSuccess = "Half damage";
    else if (/takes no damage|no effect/i.test(text)) saveSuccess = "None";
  }
  let damage = "";
  let damageType = "";
  const dmgMatch = text.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage/i);
  if (dmgMatch) {
    damage = dmgMatch[1].replace(/\s+/g, "");
    damageType = dmgMatch[2].charAt(0).toUpperCase() + dmgMatch[2].slice(1).toLowerCase();
  }
  let healing = "";
  const healMatch = text.match(/regains?\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+hit points/i);
  if (healMatch) {
    healing = healMatch[1].replace(/\s+/g, "");
  }
  let higher = "";
  const higherMatch = text.match(/(?:At Higher Levels|Higher Spell Slot|Using a Higher-Level Slot)[.:\s]+([\s\S]+?)(?:Source:|$)/i);
  if (higherMatch) {
    higher = higherMatch[1].trim();
  }
  return { save, saveSuccess, damage, damageType, healing, higher };
}

export function buildRoll20Transfer(storedCh, customs, prevCh = null) {
  if (!storedCh) throw new Error("No character provided to buildRoll20Transfer");

  const warnings = [];
  const gearAbilities = effectiveAbilities(storedCh, customs);
  const ch = { ...storedCh, abilities: gearAbilities.abilities };
  const lvl = totalLevel(ch);
  const pb = profBonus(lvl);
  const fEff = featEffects(ch, customs);
  const feats = {
    diamondSoul: hasFeat(ch, "Diamond Soul"),
    slipperyMind: hasFeat(ch, "Slippery Mind"),
    ironMind: hasFeat(ch, "Iron Mind")
  };
  const featSave = (a) => fEff.saves.find((s) => s.abil === a);
  const saveProfFor = (a, targetChar = ch) =>
    (CLASSES[targetChar.classes[0]?.name]?.saves || []).includes(a) ||
    feats.diamondSoul ||
    ((feats.slipperyMind || feats.ironMind) && a === "wis") ||
    !!featSave(a);

  const operations = [];
  const choices = [];
  const levelUpOpIds = [];

  const addOp = (op, choiceGroup = null, choiceLabel = null) => {
    operations.push(op);
    if (choiceGroup && choiceLabel) {
      choices.push({
        id: op.id,
        group: choiceGroup,
        label: choiceLabel,
        operationIds: [op.id]
      });
    }
  };

  // Precompute previous spell names and traits if leveling up
  const prevSpellNames = new Set();
  const prevTraitNames = new Set();
  if (prevCh) {
    (allKnownCantrips(prevCh, customs) || []).forEach((n) => prevSpellNames.add(NORM(n)));
    Object.values(prevCh.spells || {}).forEach((b) => {
      (b.cantrips || []).forEach((n) => prevSpellNames.add(NORM(n)));
      (b.spells || []).forEach((n) => prevSpellNames.add(NORM(n)));
      Object.values(b.arcanum || {}).forEach((n) => prevSpellNames.add(NORM(n)));
    });
    (prevCh.tomeCantrips || []).forEach((n) => prevSpellNames.add(NORM(n)));
    (prevCh.boasRituals || []).forEach((n) => prevSpellNames.add(NORM(n)));
    if (prevCh.racialChoices?.cantrip) prevSpellNames.add(NORM(prevCh.racialChoices.cantrip));
    spellGrantsOf(prevCh, customs).forEach((g) => prevSpellNames.add(NORM(g.spell)));

    featureBuckets(prevCh, customs).forEach((b) => {
      b.items.forEach((it) => prevTraitNames.add(NORM(it.name)));
    });
    (RACES[prevCh.race]?.traits || []).forEach((t) => prevTraitNames.add(NORM(t)));
  }

  // -------------------------------------------------------------
  // 1. Identity & Multiclassing
  // -------------------------------------------------------------
  const baseClass = ch.classes[0] || { name: "Fighter", level: 1 };
  const identityValues = {
    character_name: { current: ch.name || "Adventurer" },
    race: { current: ch.race || "" },
    background: { current: ch.background || "" },
    alignment: { current: ch.alignment || "" },
    class: { current: baseClass.name || "" },
    subclass: { current: baseClass.subclass || "" },
    base_level: { current: String(baseClass.level || 1) },
    level: { current: String(lvl) }
  };

  for (let i = 1; i <= 3; i++) {
    const mc = ch.classes[i];
    identityValues[`multiclass${i}`] = { current: mc ? mc.name : "" };
    identityValues[`multiclass${i}_subclass`] = { current: mc?.subclass ? mc.subclass : "" };
    identityValues[`multiclass${i}_lvl`] = { current: mc ? String(mc.level) : "" };
    identityValues[`multiclass${i}_flag`] = { current: mc ? "1" : "0" };
  }

  if (ch.classes.length > 4) {
    warnings.push(`Roll20 OGL 5e supports up to 4 classes. Only the first 4 were transferred; classes beyond 4th (${ch.classes.slice(4).map((c) => c.name).join(", ")}) are noted in Bio.`);
  }

  if (prevCh) {
    const levelChanged = totalLevel(ch) !== totalLevel(prevCh);
    const classChanged = ch.classes.some((c, i) => !prevCh.classes?.[i] || prevCh.classes[i].level !== c.level || prevCh.classes[i].name !== c.name || prevCh.classes[i].subclass !== c.subclass);
    if (levelChanged || classChanged) levelUpOpIds.push("attr:identity");
  }

  addOp(
    {
      id: "attr:identity",
      group: "Base Stats & Vitals",
      label: "Character Identity & Classes",
      kind: "attributes",
      values: identityValues
    },
    "Base Stats & Vitals",
    "Identity & Classes"
  );

  // -------------------------------------------------------------
  // 2. Ability Scores (Whole group + 6 individual choices)
  // -------------------------------------------------------------
  const allAbilValues = {};
  const abilOpIds = [];
  ABILITIES.forEach((a) => {
    const roll20Name = ROLL20_ABILITIES[a];
    const baseScore = storedCh.abilities?.[a] ?? 10;
    const effScore = ch.abilities[a];
    const bonus = effScore - baseScore;
    const opId = `attr:ability:${a}`;
    abilOpIds.push(opId);

    const values = {
      [`${roll20Name}_base`]: { current: String(baseScore) }
    };
    if (bonus !== 0) {
      values[`${roll20Name}_bonus`] = { current: String(bonus) };
    }
    Object.assign(allAbilValues, values);

    if (prevCh && ch.abilities[a] !== prevCh.abilities?.[a]) {
      levelUpOpIds.push(opId);
    }

    addOp(
      {
        id: opId,
        group: "Ability Scores",
        label: `${ABIL_NAMES[a]} (${effScore})`,
        kind: "attributes",
        values
      },
      "Ability Scores",
      `${ABIL_NAMES[a]} (${effScore})`
    );
  });

  choices.push({
    id: "group:abilities",
    group: "Ability Scores",
    label: `All Ability Scores (${abilOpIds.length})`,
    operationIds: abilOpIds,
    isCategory: true
  });

  // -------------------------------------------------------------
  // 3. Saving Throws (Individual + Group)
  // -------------------------------------------------------------
  const saveOpIds = [];
  ABILITIES.forEach((a) => {
    const roll20Name = ROLL20_ABILITIES[a];
    const isProf = saveProfFor(a);
    const opId = `attr:save:${a}`;
    saveOpIds.push(opId);

    const values = {
      [`${roll20Name}_save_prof`]: { current: isProf ? "(@{pb})" : "0" }
    };

    if (prevCh && isProf !== saveProfFor(a, prevCh)) {
      levelUpOpIds.push(opId);
    }

    addOp(
      {
        id: opId,
        group: "Saving Throws",
        label: `${ABIL_NAMES[a]} Save (${isProf ? "Proficient" : "Untrained"})`,
        kind: "attributes",
        values
      },
      "Saving Throws",
      `${ABIL_NAMES[a]} Save (${isProf ? "Proficient" : "Untrained"})`
    );
  });

  choices.push({
    id: "group:saves",
    group: "Saving Throws",
    label: `All Saving Throws (${saveOpIds.length})`,
    operationIds: saveOpIds,
    isCategory: true
  });

  // -------------------------------------------------------------
  // 4. Skills & Expertise (Individual + Group)
  // -------------------------------------------------------------
  const skillOpIds = [];
  ALL_SKILLS.forEach((skillName) => {
    const skillKey = skillName.toLowerCase().replace(/[\s-]+/g, "_");
    const isProf = (ch.skills || []).includes(skillName);
    const isExp = Array.isArray(ch.expertise) && ch.expertise.includes(skillName);
    const opId = `attr:skill:${skillKey}`;
    skillOpIds.push(opId);

    const values = {
      [`${skillKey}_prof`]: {
        current: isProf || isExp ? `(@{pb}*@{${skillKey}_type})` : "0"
      },
      [`${skillKey}_type`]: {
        current: isExp ? "2" : "1"
      }
    };

    if (prevCh) {
      const prevProf = (prevCh.skills || []).includes(skillName);
      const prevExp = Array.isArray(prevCh.expertise) && prevCh.expertise.includes(skillName);
      if (isProf !== prevProf || isExp !== prevExp) {
        levelUpOpIds.push(opId);
      }
    }

    const statusLabel = isExp ? "Expertise" : isProf ? "Proficient" : "Untrained";

    addOp(
      {
        id: opId,
        group: "Skills & Expertise",
        label: `${skillName} (${statusLabel})`,
        kind: "attributes",
        values
      },
      "Skills & Expertise",
      `${skillName} (${statusLabel})`
    );
  });

  choices.push({
    id: "group:skills",
    group: "Skills & Expertise",
    label: `All Skills & Expertise (${skillOpIds.length})`,
    operationIds: skillOpIds,
    isCategory: true
  });

  // -------------------------------------------------------------
  // 5. Combat & Vitals (HP, Hit Dice, AC, Speed, Initiative)
  // -------------------------------------------------------------
  const maxHp = effMaxHp(ch);
  const curHp = Math.max(0, maxHp - Math.max(0, ch.dmg || 0));
  const spd = speedOf(ch, customs);
  const acData = armorClass(ch, customs);
  const slots = spellSlots(ch.classes) || {};
  const dexMod = mod(ch.abilities.dex);
  const initBonus = dexMod;

  const vitalsValues = {
    hp: { current: String(curHp), max: String(maxHp) },
    hp_temp: { current: String(ch.tempHp || 0) },
    speed: { current: String(spd.walk || 30) },
    ac: { current: String(acData.ac) },
    initiative_bonus: { current: String(initBonus) },
    hit_dice: { current: String(lvl), max: String(lvl) }
  };

  // Standard spell slots
  for (let l = 1; l <= 9; l++) {
    const totalSlots = slots[l] || 0;
    if (totalSlots > 0) {
      vitalsValues[`lvl${l}_slots_total`] = { current: String(totalSlots) };
      vitalsValues[`lvl${l}_slots_expended`] = { current: String(totalSlots) };
    }
  }

  // Warlock Pact Magic slots
  const wlClass = ch.classes.find((c) => c.name === "Warlock");
  if (wlClass) {
    const pact = PACT(wlClass.level);
    vitalsValues["pact_magic_slots_total"] = { current: String(pact.n) };
    vitalsValues["pact_magic_slots_expended"] = { current: String(pact.n) };
  }

  // Currency
  if (typeof ch.gold === "number") {
    vitalsValues.gp = { current: String(Math.floor(ch.gold)) };
  }

  if (prevCh) {
    const hpChanged = effMaxHp(ch) !== effMaxHp(prevCh);
    const slotsChanged = JSON.stringify(spellSlots(ch.classes)) !== JSON.stringify(spellSlots(prevCh.classes));
    const pactChanged = JSON.stringify(ch.classes.find((c) => c.name === "Warlock")) !== JSON.stringify(prevCh.classes.find((c) => c.name === "Warlock"));
    if (hpChanged || slotsChanged || pactChanged) {
      levelUpOpIds.push("attr:vitals");
    }
  }

  addOp(
    {
      id: "attr:vitals",
      group: "Base Stats & Vitals",
      label: `Vitals & Combat (HP ${curHp}/${maxHp}, AC ${acData.ac}, Speed ${spd.walk || 30}ft)`,
      kind: "attributes",
      values: vitalsValues
    },
    "Base Stats & Vitals",
    "HP, AC, Speed & Resources"
  );

  choices.push({
    id: "group:vitals",
    group: "Base Stats & Vitals",
    label: "All Base Stats, Identity & Vitals",
    operationIds: ["attr:identity", "attr:vitals"],
    isCategory: true
  });

  // -------------------------------------------------------------
  // 6. Spells (Individual + Group)
  // -------------------------------------------------------------
  const spellPool = customs?.spells || [];
  const allSpellsMap = new Map();
  (allKnownCantrips(ch, customs) || []).forEach((name) => allSpellsMap.set(name, { name, cantrip: true }));

  Object.entries(ch.spells || {}).forEach(([cls, b]) => {
    (b.cantrips || []).forEach((name) => allSpellsMap.set(name, { name, cantrip: true, cls }));
    (b.spells || []).forEach((name) => allSpellsMap.set(name, { name, cantrip: false, cls }));
    Object.entries(b.arcanum || {}).forEach(([lvlNum, name]) => allSpellsMap.set(name, { name, level: +lvlNum, cls }));
  });

  (ch.tomeCantrips || []).forEach((name) => allSpellsMap.set(name, { name, cantrip: true, source: "Tome" }));
  (ch.boasRituals || []).forEach((name) => allSpellsMap.set(name, { name, cantrip: false, source: "Book of Ancient Secrets" }));
  if (ch.racialChoices?.cantrip) allSpellsMap.set(ch.racialChoices.cantrip, { name: ch.racialChoices.cantrip, cantrip: true, source: "Racial" });
  spellGrantsOf(ch, customs).forEach((g) => allSpellsMap.set(g.spell, { name: g.spell, source: g.source }));

  const spellOpIds = [];
  for (const [spellName, meta] of allSpellsMap.entries()) {
    const rawSp = spellPool.find((s) => NORM(s.name) === NORM(spellName)) || null;
    const stats = rawSp ? parseSpellStats(rawSp) : { save: "", saveSuccess: "", damage: "", damageType: "", healing: "", higher: "" };

    const spellLevel = meta.cantrip ? 0 : meta.level ?? rawSp?.level ?? 1;
    const school = rawSp?.school ? schoolName(rawSp.school) : "Evocation";
    const opId = `spell:${NORM(spellName)}`;
    spellOpIds.push(opId);

    if (prevCh && !prevSpellNames.has(NORM(spellName))) {
      levelUpOpIds.push(opId);
    }

    const spellPayload = {
      Category: "Spells",
      Name: spellName,
      Level: spellLevel,
      School: school,
      "Casting Time": rawSp?.time || "1 action",
      Range: rawSp?.range || "Self",
      Duration: rawSp?.duration || "Instantaneous",
      Components: rawSp?.components || "V, S",
      Concentration: (rawSp?.duration || "").toLowerCase().includes("concentration") ? "Yes" : "",
      Ritual: rawSp?.ritual ? "{{ritual=1}}" : "",
      Save: stats.save,
      "Save Success": stats.saveSuccess,
      Damage: stats.damage,
      "Damage Type": stats.damageType,
      Healing: stats.healing,
      "Higher Spell Slot Desc": stats.higher,
      "data-description": rawSp?.text || rawSp?.desc || `Cast ${spellName}.`,
      "Spellcasting Ability": "Charisma"
    };

    addOp(
      {
        id: opId,
        group: "Spells",
        label: `${spellName} (${spellLevel === 0 ? "Cantrip" : `Level ${spellLevel}`})`,
        kind: "spell",
        name: spellName,
        data: spellPayload,
        content: rawSp?.text || rawSp?.desc || ""
      },
      "Spells",
      `${spellName} (${spellLevel === 0 ? "Cantrip" : `Level ${spellLevel}`})`
    );
  }

  if (spellOpIds.length > 0) {
    choices.push({
      id: "group:spells",
      group: "Spells",
      label: `All Spells (${spellOpIds.length} spells)`,
      operationIds: spellOpIds,
      isCategory: true
    });
  }

  // -------------------------------------------------------------
  // 7. Features & Traits (Individual + Group)
  // -------------------------------------------------------------
  const traitOpIds = [];
  const buckets = featureBuckets(ch, customs);

  buckets.forEach((bucket) => {
    const groupName = bucket.title || bucket.label || "Features & Traits";
    bucket.items.forEach((it) => {
      const featName = it.name;
      const opId = `trait:${NORM(featName)}`;
      traitOpIds.push(opId);

      if (prevCh && !prevTraitNames.has(NORM(featName))) {
        levelUpOpIds.push(opId);
      }

      const desc = it.body || it.detail || featureBody(featName, it.cls, customs, it.sub) || "";
      let sourceCategory = "Class";
      if (bucket.key === "feats") sourceCategory = "Feat";
      else if (bucket.key === "boons") sourceCategory = "Other";
      else if (bucket.key === "racial") sourceCategory = "Racial";

      addOp(
        {
          id: opId,
          group: "Features & Traits",
          label: `${featName} (${groupName})`,
          kind: "row",
          section: "traits",
          nameField: "name",
          values: {
            name: featName,
            source: sourceCategory,
            source_type: groupName,
            description: desc
          }
        },
        "Features & Traits",
        featName
      );
    });
  });

  // Racial traits if not in buckets
  const raceTraits = RACES[ch.race]?.traits || [];
  raceTraits.forEach((tName) => {
    const opId = `trait:${NORM(tName)}`;
    if (!traitOpIds.includes(opId)) {
      traitOpIds.push(opId);
      if (prevCh && !prevTraitNames.has(NORM(tName))) {
        levelUpOpIds.push(opId);
      }
      addOp(
        {
          id: opId,
          group: "Features & Traits",
          label: `${tName} (Racial)`,
          kind: "row",
          section: "traits",
          nameField: "name",
          values: {
            name: tName,
            source: "Racial",
            source_type: ch.race,
            description: `Racial trait granted by ${ch.race}.`
          }
        },
        "Features & Traits",
        `${tName} (Racial)`
      );
    }
  });

  if (traitOpIds.length > 0) {
    choices.push({
      id: "group:traits",
      group: "Features & Traits",
      label: `All Features & Traits (${traitOpIds.length} features)`,
      operationIds: traitOpIds,
      isCategory: true
    });
  }

  // -------------------------------------------------------------
  // 8. Inventory Items & Weapons (Individual + Group)
  // -------------------------------------------------------------
  const invOpIds = [];
  const atkOpIds = [];
  (ch.inventory || []).forEach((row) => {
    const it = findItem(row.name, customs);
    const opId = `item:${NORM(row.name)}`;
    invOpIds.push(opId);

    const isWeapon = it && isWeaponType(it.type);
    const itemValues = {
      itemname: row.name,
      itemcount: String(row.qty || 1),
      itemweight: it?.weight ? String(it.weight) : "0",
      equipped: row.equipped ? "1" : "0",
      itemproperties: it?.property || "",
      itemcontent: it?.text || ""
    };

    addOp(
      {
        id: opId,
        group: "Equipment & Inventory",
        label: `${row.name} (×${row.qty || 1}${row.equipped ? ", equipped" : ""})`,
        kind: "row",
        section: "inventory",
        nameField: "itemname",
        values: itemValues
      },
      "Equipment & Inventory",
      row.name
    );

    // If equipped weapon, also export an attack card for immediate rollability
    if (isWeapon && row.equipped) {
      const atkOpId = `attack:${NORM(row.name)}`;
      atkOpIds.push(atkOpId);
      const isFinesse = (it?.property || "").toLowerCase().includes("finesse");
      const useDex = isFinesse && ch.abilities.dex > ch.abilities.str;
      const attrBase = useDex ? "@{dexterity_mod}" : "@{strength_mod}";

      addOp(
        {
          id: atkOpId,
          group: "Attacks",
          label: `Weapon Attack: ${row.name}`,
          kind: "row",
          section: "attack",
          nameField: "atkname",
          values: {
            atkname: row.name,
            atkflag: "{{attack=1}}",
            atkprofflag: "(@{pb})",
            atkattr_base: attrBase,
            dmgflag: "{{damage=1}}",
            dmgbase: it?.dmg1 || "1d6",
            dmgattr: attrBase,
            dmgtype: it?.dmgType || "slashing",
            atkrange: it?.range || "5 ft"
          }
        },
        "Attacks",
        `Attack: ${row.name}`
      );
    }
  });

  if (invOpIds.length > 0) {
    choices.push({
      id: "group:inventory",
      group: "Equipment & Inventory",
      label: `All Equipment & Inventory (${invOpIds.length} items)`,
      operationIds: invOpIds,
      isCategory: true
    });
  }

  if (atkOpIds.length > 0) {
    choices.push({
      id: "group:attacks",
      group: "Attacks",
      label: `All Attacks & Weapons (${atkOpIds.length} attacks)`,
      operationIds: atkOpIds,
      isCategory: true
    });
  }

  // -------------------------------------------------------------
  // 9. Proficiencies & Languages (Individual + Group)
  // -------------------------------------------------------------
  const profOpIds = [];
  (ch.languages || []).forEach((lang) => {
    const opId = `prof:lang:${NORM(lang)}`;
    profOpIds.push(opId);
    addOp(
      {
        id: opId,
        group: "Proficiencies & Languages",
        label: `Language: ${lang}`,
        kind: "row",
        section: "proficiencies",
        nameField: "name",
        values: {
          name: lang,
          prof_type: "LANGUAGE"
        }
      },
      "Proficiencies & Languages",
      `Language: ${lang}`
    );
  });

  bonusProfsOf(ch, customs).forEach((bp) => {
    const opId = `prof:bonus:${NORM(bp.name || bp.source)}`;
    profOpIds.push(opId);
    addOp(
      {
        id: opId,
        group: "Proficiencies & Languages",
        label: `Proficiency: ${bp.name || bp.source}`,
        kind: "row",
        section: "proficiencies",
        nameField: "name",
        values: {
          name: bp.name || bp.source,
          prof_type: "OTHER"
        }
      },
      "Proficiencies & Languages",
      bp.name || bp.source
    );
  });

  if (profOpIds.length > 0) {
    choices.push({
      id: "group:proficiencies",
      group: "Proficiencies & Languages",
      label: `All Proficiencies & Languages (${profOpIds.length})`,
      operationIds: profOpIds,
      isCategory: true
    });
  }

  // -------------------------------------------------------------
  // 10. Bio & Narrative Notes
  // -------------------------------------------------------------
  if (ch.notes && ch.notes.trim()) {
    addOp(
      {
        id: "bio:notes",
        group: "Bio & Narrative",
        label: "Character Backstory / Notes",
        kind: "bio",
        field: "character_backstory",
        text: ch.notes.trim()
      },
      "Bio & Narrative",
      "Character Backstory"
    );

    choices.push({
      id: "group:bio",
      group: "Bio & Narrative",
      label: "Bio, Backstory & Notes",
      operationIds: ["bio:notes"],
      isCategory: true
    });
  }

  // If level-up occurred, add Level Up choice at the VERY TOP
  if (levelUpOpIds.length > 0) {
    choices.unshift({
      id: "levelup",
      group: "Level Up",
      label: `🚀 Level Up Changes (Level ${lvl}) — ${levelUpOpIds.length} updates`,
      operationIds: levelUpOpIds,
      isCategory: true
    });
  }

  // Full character choice includes everything
  choices.push({
    id: "full",
    group: "Full Character Sheet",
    label: `Full Character Sheet (${ch.name})`,
    operationIds: operations.map((op) => op.id)
  });

  return {
    payload: {
      format: "adventurers-ledger/roll20",
      version: 1,
      character: {
        id: ch.id || "character",
        name: ch.name || "Adventurer"
      },
      label: `Full character: ${ch.name}`,
      operations,
      warnings
    },
    choices
  };
}
