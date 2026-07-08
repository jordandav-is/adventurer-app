import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============ SRD 5.1 DATA (CC-BY-4.0) ============ */

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const mod = (s) => Math.floor((s - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);
const profBonus = (lvl) => Math.ceil(lvl / 4) + 1;

const RACES = {
  "Hill Dwarf": { bonus: { con: 2, wis: 1 }, speed: 25, traits: ["Darkvision 60 ft", "Dwarven Resilience (adv. vs poison)", "Dwarven Toughness (+1 HP/level)", "Stonecunning"] },
  "High Elf": { bonus: { dex: 2, int: 1 }, speed: 30, traits: ["Darkvision 60 ft", "Fey Ancestry", "Trance", "Keen Senses (Perception)", "One wizard cantrip"] },
  "Lightfoot Halfling": { bonus: { dex: 2, cha: 1 }, speed: 25, traits: ["Lucky (reroll 1s)", "Brave", "Halfling Nimbleness", "Naturally Stealthy"] },
  "Human": { bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, traits: ["+1 to all ability scores"] },
  "Dragonborn": { bonus: { str: 2, cha: 1 }, speed: 30, traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance (ancestry type)"] },
  "Rock Gnome": { bonus: { int: 2, con: 1 }, speed: 25, traits: ["Darkvision 60 ft", "Gnome Cunning (adv. on Int/Wis/Cha saves vs magic)", "Artificer's Lore", "Tinker"] },
  "Half-Elf": { bonus: { cha: 2 }, choose: 2, speed: 30, traits: ["Darkvision 60 ft", "Fey Ancestry", "Two extra skills", "+1 to two abilities of your choice"] },
  "Half-Orc": { bonus: { str: 2, con: 1 }, speed: 30, traits: ["Darkvision 60 ft", "Relentless Endurance", "Savage Attacks", "Menacing (Intimidation)"] },
  "Tiefling": { bonus: { cha: 2, int: 1 }, speed: 30, traits: ["Darkvision 60 ft", "Hellish Resistance (fire)", "Infernal Legacy (thaumaturgy)"] },
};

const LANGS = ["Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orc","Abyssal","Celestial","Deep Speech","Draconic","Infernal","Primordial","Sylvan","Undercommon"];
const RACE_LANGS = {
  "Hill Dwarf": { fixed: ["Common", "Dwarvish"], choose: 0 }, "High Elf": { fixed: ["Common", "Elvish"], choose: 1 },
  "Lightfoot Halfling": { fixed: ["Common", "Halfling"], choose: 0 }, "Human": { fixed: ["Common"], choose: 1 },
  "Dragonborn": { fixed: ["Common", "Draconic"], choose: 0 }, "Rock Gnome": { fixed: ["Common", "Gnomish"], choose: 0 },
  "Half-Elf": { fixed: ["Common", "Elvish"], choose: 1 }, "Half-Orc": { fixed: ["Common", "Orc"], choose: 0 },
  "Tiefling": { fixed: ["Common", "Infernal"], choose: 0 },
};
const ANCESTRIES = { Black: "Acid", Blue: "Lightning", Brass: "Fire", Bronze: "Lightning", Copper: "Acid", Gold: "Fire", Green: "Poison", Red: "Fire", Silver: "Cold", White: "Cold" };
const ALL_SKILLS = ["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"];

const ALIGNMENTS = ["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil"];
const FIGHTING_STYLES = {
  Fighter: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"],
  Paladin: ["Defense", "Dueling", "Great Weapon Fighting", "Protection"],
  Ranger: ["Archery", "Defense", "Dueling", "Two-Weapon Fighting"],
};
const STYLE_DESC = { Archery: "+2 ranged attack rolls", Defense: "+1 AC in armor", Dueling: "+2 dmg one-handed melee", "Great Weapon Fighting": "reroll 1-2 on two-handed dmg", Protection: "reaction: impose disadv. on attack vs ally (shield)", "Two-Weapon Fighting": "add ability mod to off-hand dmg" };
const PROF_TEXT = {
  Barbarian: "Light & medium armor, shields, simple & martial weapons",
  Bard: "Light armor, simple weapons, hand crossbows, longswords, rapiers, shortswords, three instruments",
  Cleric: "Light & medium armor, shields, simple weapons",
  Druid: "Light & medium armor and shields (nonmetal), clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears, herbalism kit",
  Fighter: "All armor, shields, simple & martial weapons",
  Monk: "Simple weapons, shortswords, one artisan's tools or instrument",
  Paladin: "All armor, shields, simple & martial weapons",
  Ranger: "Light & medium armor, shields, simple & martial weapons",
  Rogue: "Light armor, simple weapons, hand crossbows, longswords, rapiers, shortswords, thieves' tools",
  Sorcerer: "Daggers, darts, slings, quarterstaffs, light crossbows",
  Warlock: "Light armor, simple weapons",
  Wizard: "Daggers, darts, slings, quarterstaffs, light crossbows",
};
const START_GOLD = { Barbarian: [2, 10], Bard: [5, 10], Cleric: [5, 10], Druid: [2, 10], Fighter: [5, 10], Monk: [5, 1], Paladin: [5, 10], Ranger: [5, 10], Rogue: [4, 10], Sorcerer: [3, 10], Warlock: [4, 10], Wizard: [4, 10] }; // [n]d4 × mult

/* PHB starting equipment. Each slot is an either/or choice; `pick` options open
   a weapon/focus picker from the named list, choosing `n` of them. `fixed` gear
   always comes along. */
const GEAR_LISTS = {
  simpleMelee: ["Club", "Dagger", "Greatclub", "Handaxe", "Javelin", "Light Hammer", "Mace", "Quarterstaff", "Sickle", "Spear"],
  simpleRanged: ["Light Crossbow", "Dart", "Shortbow", "Sling"],
  martialMelee: ["Battleaxe", "Flail", "Glaive", "Greataxe", "Greatsword", "Halberd", "Lance", "Longsword", "Maul", "Morningstar", "Pike", "Rapier", "Scimitar", "Shortsword", "Trident", "War Pick", "Warhammer", "Whip"],
  martialRanged: ["Blowgun", "Hand Crossbow", "Heavy Crossbow", "Longbow", "Net"],
  instrument: ["Bagpipes", "Drum", "Dulcimer", "Flute", "Horn", "Lute", "Lyre", "Pan Flute", "Viol"],
  arcaneFocus: ["Crystal", "Orb", "Rod", "Staff", "Wand"],
  holySymbol: ["Amulet", "Emblem", "Reliquary"],
  druidFocus: ["Sprig of Mistletoe", "Totem", "Wooden Staff", "Yew Wand"],
};
GEAR_LISTS.simple = [...GEAR_LISTS.simpleMelee, ...GEAR_LISTS.simpleRanged];
GEAR_LISTS.martial = [...GEAR_LISTS.martialMelee, ...GEAR_LISTS.martialRanged];
const STARTING_GEAR = {
  Barbarian: {
    fixed: [["Explorer's Pack", 1], ["Javelin", 4]],
    slots: [
      { name: "Weapon", options: [{ label: "Greataxe", items: [["Greataxe", 1]] }, { label: "Any martial melee weapon", pick: "martialMelee", n: 1 }] },
      { name: "Backup", options: [{ label: "Two handaxes", items: [["Handaxe", 2]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
    ],
  },
  Bard: {
    fixed: [["Leather Armor", 1], ["Dagger", 1]],
    slots: [
      { name: "Weapon", options: [{ label: "Rapier", items: [["Rapier", 1]] }, { label: "Longsword", items: [["Longsword", 1]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
      { name: "Pack", options: [{ label: "Diplomat's Pack", items: [["Diplomat's Pack", 1]] }, { label: "Entertainer's Pack", items: [["Entertainer's Pack", 1]] }] },
      { name: "Instrument", options: [{ label: "Lute", items: [["Lute", 1]] }, { label: "Any other instrument", pick: "instrument", n: 1 }] },
    ],
  },
  Cleric: {
    fixed: [["Shield", 1]],
    slots: [
      { name: "Weapon", options: [{ label: "Mace", items: [["Mace", 1]] }, { label: "Warhammer (if proficient)", items: [["Warhammer", 1]] }] },
      { name: "Armor", options: [{ label: "Scale Mail", items: [["Scale Mail", 1]] }, { label: "Leather Armor", items: [["Leather Armor", 1]] }, { label: "Chain Mail (if proficient)", items: [["Chain Mail", 1]] }] },
      { name: "Ranged", options: [{ label: "Light crossbow + 20 bolts", items: [["Light Crossbow", 1], ["Crossbow Bolts", 20]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
      { name: "Pack", options: [{ label: "Priest's Pack", items: [["Priest's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
      { name: "Holy symbol", options: [{ label: "A holy symbol", pick: "holySymbol", n: 1 }] },
    ],
  },
  Druid: {
    fixed: [["Leather Armor", 1], ["Explorer's Pack", 1]],
    slots: [
      { name: "Off hand", options: [{ label: "Wooden shield", items: [["Shield", 1]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
      { name: "Weapon", options: [{ label: "Scimitar", items: [["Scimitar", 1]] }, { label: "Any simple melee weapon", pick: "simpleMelee", n: 1 }] },
      { name: "Druidic focus", options: [{ label: "A druidic focus", pick: "druidFocus", n: 1 }] },
    ],
  },
  Fighter: {
    fixed: [],
    slots: [
      { name: "Armor", options: [{ label: "Chain Mail", items: [["Chain Mail", 1]] }, { label: "Leather + longbow + 20 arrows", items: [["Leather Armor", 1], ["Longbow", 1], ["Arrows", 20]] }] },
      { name: "Weapons", options: [{ label: "Martial weapon + shield", pick: "martial", n: 1, extra: [["Shield", 1]] }, { label: "Two martial weapons", pick: "martial", n: 2 }] },
      { name: "Ranged", options: [{ label: "Light crossbow + 20 bolts", items: [["Light Crossbow", 1], ["Crossbow Bolts", 20]] }, { label: "Two handaxes", items: [["Handaxe", 2]] }] },
      { name: "Pack", options: [{ label: "Dungeoneer's Pack", items: [["Dungeoneer's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
    ],
  },
  Monk: {
    fixed: [["Dart", 10]],
    slots: [
      { name: "Weapon", options: [{ label: "Shortsword", items: [["Shortsword", 1]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
      { name: "Pack", options: [{ label: "Dungeoneer's Pack", items: [["Dungeoneer's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
    ],
  },
  Paladin: {
    fixed: [["Chain Mail", 1]],
    slots: [
      { name: "Weapons", options: [{ label: "Martial weapon + shield", pick: "martial", n: 1, extra: [["Shield", 1]] }, { label: "Two martial weapons", pick: "martial", n: 2 }] },
      { name: "Backup", options: [{ label: "Five javelins", items: [["Javelin", 5]] }, { label: "Any simple melee weapon", pick: "simpleMelee", n: 1 }] },
      { name: "Pack", options: [{ label: "Priest's Pack", items: [["Priest's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
      { name: "Holy symbol", options: [{ label: "A holy symbol", pick: "holySymbol", n: 1 }] },
    ],
  },
  Ranger: {
    fixed: [["Longbow", 1], ["Arrows", 20]],
    slots: [
      { name: "Armor", options: [{ label: "Scale Mail", items: [["Scale Mail", 1]] }, { label: "Leather Armor", items: [["Leather Armor", 1]] }] },
      { name: "Weapons", options: [{ label: "Two shortswords", items: [["Shortsword", 2]] }, { label: "Two simple melee weapons", pick: "simpleMelee", n: 2 }] },
      { name: "Pack", options: [{ label: "Dungeoneer's Pack", items: [["Dungeoneer's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
    ],
  },
  Rogue: {
    fixed: [["Leather Armor", 1], ["Dagger", 2], ["Thieves' Tools", 1]],
    slots: [
      { name: "Weapon", options: [{ label: "Rapier", items: [["Rapier", 1]] }, { label: "Shortsword", items: [["Shortsword", 1]] }] },
      { name: "Ranged", options: [{ label: "Shortbow + 20 arrows", items: [["Shortbow", 1], ["Arrows", 20]] }, { label: "Shortsword", items: [["Shortsword", 1]] }] },
      { name: "Pack", options: [{ label: "Burglar's Pack", items: [["Burglar's Pack", 1]] }, { label: "Dungeoneer's Pack", items: [["Dungeoneer's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
    ],
  },
  Sorcerer: {
    fixed: [["Dagger", 2]],
    slots: [
      { name: "Weapon", options: [{ label: "Light crossbow + 20 bolts", items: [["Light Crossbow", 1], ["Crossbow Bolts", 20]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
      { name: "Focus", options: [{ label: "Component Pouch", items: [["Component Pouch", 1]] }, { label: "An arcane focus", pick: "arcaneFocus", n: 1 }] },
      { name: "Pack", options: [{ label: "Dungeoneer's Pack", items: [["Dungeoneer's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
    ],
  },
  Warlock: {
    fixed: [["Leather Armor", 1], ["Dagger", 2]],
    slots: [
      { name: "Weapon", options: [{ label: "Light crossbow + 20 bolts", items: [["Light Crossbow", 1], ["Crossbow Bolts", 20]] }, { label: "Any simple weapon", pick: "simple", n: 1 }] },
      { name: "Focus", options: [{ label: "Component Pouch", items: [["Component Pouch", 1]] }, { label: "An arcane focus", pick: "arcaneFocus", n: 1 }] },
      { name: "Pack", options: [{ label: "Scholar's Pack", items: [["Scholar's Pack", 1]] }, { label: "Dungeoneer's Pack", items: [["Dungeoneer's Pack", 1]] }] },
      { name: "Backup", options: [{ label: "Any simple weapon", pick: "simple", n: 1 }] },
    ],
  },
  Wizard: {
    fixed: [["Spellbook", 1]],
    slots: [
      { name: "Weapon", options: [{ label: "Quarterstaff", items: [["Quarterstaff", 1]] }, { label: "Dagger", items: [["Dagger", 1]] }] },
      { name: "Focus", options: [{ label: "Component Pouch", items: [["Component Pouch", 1]] }, { label: "An arcane focus", pick: "arcaneFocus", n: 1 }] },
      { name: "Pack", options: [{ label: "Scholar's Pack", items: [["Scholar's Pack", 1]] }, { label: "Explorer's Pack", items: [["Explorer's Pack", 1]] }] },
    ],
  },
};

/* Subclass-granted spells (SRD). type: granted = always prepared, free; expanded = added to class list options. Keys are class level. */
const LAND_TERRAINS = {
  Arctic: { 3: ["Hold Person", "Spike Growth"], 5: ["Sleet Storm", "Slow"], 7: ["Freedom of Movement", "Ice Storm"], 9: ["Commune with Nature", "Cone of Cold"] },
  Coast: { 3: ["Mirror Image", "Misty Step"], 5: ["Water Breathing", "Water Walk"], 7: ["Control Water", "Freedom of Movement"], 9: ["Conjure Elemental", "Scrying"] },
  Desert: { 3: ["Blur", "Silence"], 5: ["Create Food and Water", "Protection from Energy"], 7: ["Blight", "Hallucinatory Terrain"], 9: ["Insect Plague", "Wall of Stone"] },
  Forest: { 3: ["Barkskin", "Spider Climb"], 5: ["Call Lightning", "Plant Growth"], 7: ["Divination", "Freedom of Movement"], 9: ["Commune with Nature", "Tree Stride"] },
  Grassland: { 3: ["Invisibility", "Pass without Trace"], 5: ["Daylight", "Haste"], 7: ["Divination", "Freedom of Movement"], 9: ["Dream", "Insect Plague"] },
  Mountain: { 3: ["Spider Climb", "Spike Growth"], 5: ["Lightning Bolt", "Meld into Stone"], 7: ["Stone Shape", "Stoneskin"], 9: ["Passwall", "Wall of Stone"] },
  Swamp: { 3: ["Darkness", "Acid Arrow"], 5: ["Water Walk", "Stinking Cloud"], 7: ["Freedom of Movement", "Locate Creature"], 9: ["Insect Plague", "Scrying"] },
  Underdark: { 3: ["Spider Climb", "Web"], 5: ["Gaseous Form", "Stinking Cloud"], 7: ["Greater Invisibility", "Stone Shape"], 9: ["Cloudkill", "Insect Plague"] },
};
const SUB_SPELLS = {
  "Life Domain": { type: "granted", label: "Domain spells (always prepared)", spells: { 1: ["Bless", "Cure Wounds"], 3: ["Lesser Restoration", "Spiritual Weapon"], 5: ["Beacon of Hope", "Revivify"], 7: ["Death Ward", "Guardian of Faith"], 9: ["Mass Cure Wounds", "Raise Dead"] } },
  "Oath of Devotion": { type: "granted", label: "Oath spells (always prepared)", spells: { 3: ["Protection from Evil and Good", "Sanctuary"], 5: ["Lesser Restoration", "Zone of Truth"], 9: ["Beacon of Hope", "Dispel Magic"], 13: ["Freedom of Movement", "Guardian of Faith"], 17: ["Commune", "Flame Strike"] } },
  "The Fiend": { type: "expanded", label: "Expanded spell list (added to your Warlock options)", spells: { 1: ["Burning Hands", "Command"], 3: ["Blindness/Deafness", "Scorching Ray"], 5: ["Fireball", "Stinking Cloud"], 7: ["Fire Shield", "Wall of Fire"], 9: ["Flame Strike", "Hallow"] } },
};
const baseSubName = (sub) => (sub || "").replace(/\s*\([^)]*\)$/, "");
/* Canonical form for subclass names so "The Archfey", "(Archfey)", "Life Domain" and "(Life)" all line up */
const normSub = (s) => {
  let x = (s || "").toLowerCase().trim();
  const prefix = /^(the|college of|circle of|oath of|way of|path of|school of)\s+/;
  while (prefix.test(x)) x = x.replace(prefix, "");
  return x.replace(/\s+domain$/, "").trim();
};
/* Tokens a character's subclass answers to: base name plus any parenthetical (e.g. Land circle terrain) */
const subTokens = (subclass) => {
  const toks = [normSub(baseSubName(subclass))];
  const m = (subclass || "").match(/\(([^)]+)\)$/);
  if (m) toks.push(normSub(m[1]));
  return toks;
};
/* Classes whose subclass spells are always prepared rather than added to the pickable list */
const GRANTED_SUB_CLASSES = { Cleric: "Domain spells", Paladin: "Oath spells", Druid: "Circle spells" };
function subSpellData(subclass, clsName, customs) {
  if (!subclass) return null;
  const base = baseSubName(subclass);
  if (base === "Circle of the Land") {
    const m = subclass.match(/\(([^)]+)\)/);
    const terr = m && LAND_TERRAINS[m[1]];
    return terr ? { type: "granted", label: `Circle spells — ${m[1]} (always prepared)`, spells: terr } : null;
  }
  if (SUB_SPELLS[base]) return SUB_SPELLS[base];
  /* Derive the list from imported compendium spells tagged "Class (Subclass)" */
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
    let at = 1; // class level at which this spell's level unlocks
    while (at < 20 && maxSpellLevel(clsName, at) < sp.level) at++;
    (spells[at] = spells[at] || []).push(sp.name);
  });
  Object.values(spells).forEach((arr) => arr.sort());
  return grantedLabel
    ? { type: "granted", label: `${grantedLabel} — ${base} (always prepared)`, spells }
    : { type: "expanded", label: `Expanded spell list — ${base} (added to your ${clsName} options)`, spells };
}
const SPELL_LVL_HINT = { "Burning Hands": 1, "Command": 1, "Blindness/Deafness": 2, "Scorching Ray": 2, "Fireball": 3, "Stinking Cloud": 3, "Fire Shield": 4, "Wall of Fire": 4, "Flame Strike": 5, "Hallow": 5 };

const SKILL_ABIL = { Acrobatics: "dex", "Animal Handling": "wis", Arcana: "int", Athletics: "str", Deception: "cha", History: "int", Insight: "wis", Intimidation: "cha", Investigation: "int", Medicine: "wis", Nature: "int", Perception: "wis", Performance: "cha", Persuasion: "cha", Religion: "int", "Sleight of Hand": "dex", Stealth: "dex", Survival: "wis" };
const METAMAGIC = ["Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell", "Quickened Spell", "Subtle Spell", "Twinned Spell"];
const PACT_BOONS = ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"];
const FAVORED_ENEMIES = ["Aberrations", "Beasts", "Celestials", "Constructs", "Dragons", "Elementals", "Fey", "Fiends", "Giants", "Monstrosities", "Oozes", "Plants", "Undead", "Two humanoid races"];
const NE_TERRAINS = ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp"];
/* SRD Eldritch Invocations: [name, min warlock level, other requirement] */
const INVOCATION_DATA = [
  ["Agonizing Blast", 0, "eldritch blast cantrip"], ["Armor of Shadows", 0, ""], ["Ascendant Step", 9, ""],
  ["Beast Speech", 0, ""], ["Beguiling Influence", 0, ""], ["Bewitching Whispers", 7, ""],
  ["Book of Ancient Secrets", 0, "Pact of the Tome"], ["Chains of Carceri", 15, "Pact of the Chain"],
  ["Devil's Sight", 0, ""], ["Dreadful Word", 7, ""], ["Eldritch Sight", 0, ""],
  ["Eldritch Spear", 0, "eldritch blast cantrip"], ["Eyes of the Rune Keeper", 0, ""], ["Fiendish Vigor", 0, ""],
  ["Gaze of Two Minds", 0, ""], ["Lifedrinker", 12, "Pact of the Blade"], ["Mask of Many Faces", 0, ""],
  ["Master of Myriad Forms", 15, ""], ["Minions of Chaos", 9, ""], ["Mire the Mind", 5, ""],
  ["Misty Visions", 0, ""], ["One with Shadows", 5, ""], ["Otherworldly Leap", 9, ""],
  ["Repelling Blast", 0, "eldritch blast cantrip"], ["Sculptor of Flesh", 7, ""], ["Sign of Ill Omen", 5, ""],
  ["Thief of Five Fates", 0, ""], ["Thirsting Blade", 5, "Pact of the Blade"], ["Visions of Distant Realms", 15, ""],
  ["Voice of the Chain Master", 0, "Pact of the Chain"], ["Whispers of the Grave", 9, ""], ["Witch Sight", 15, ""],
];

const MC_PREREQ = {
  Barbarian: [{ str: 13 }], Bard: [{ cha: 13 }], Cleric: [{ wis: 13 }], Druid: [{ wis: 13 }],
  Fighter: [{ str: 13 }, { dex: 13 }], Monk: [{ dex: 13, wis: 13 }], Paladin: [{ str: 13, cha: 13 }],
  Ranger: [{ dex: 13, wis: 13 }], Rogue: [{ dex: 13 }], Sorcerer: [{ cha: 13 }], Warlock: [{ cha: 13 }], Wizard: [{ int: 13 }],
};
const meetsPrereq = (cls, ab) => MC_PREREQ[cls].some((req) => Object.entries(req).every(([k, v]) => ab[k] >= v));

const MC_PROFS = {
  Barbarian: "Shields, simple & martial weapons", Bard: "Light armor, one skill, one instrument",
  Cleric: "Light & medium armor, shields", Druid: "Light & medium armor, shields (nonmetal)",
  Fighter: "Light & medium armor, shields, simple & martial weapons", Monk: "Simple weapons, shortswords",
  Paladin: "Light & medium armor, shields, simple & martial weapons",
  Ranger: "Light & medium armor, shields, simple & martial weapons, one skill",
  Rogue: "Light armor, one skill, thieves' tools", Sorcerer: "None", Warlock: "Light armor, simple weapons", Wizard: "None",
};
const MC_SKILL_GRANT = { Bard: 1, Ranger: 1, Rogue: 1 };

const ASI = "Ability Score Improvement";
const CLASSES = {
  Barbarian: { die: 12, saves: ["str", "con"], caster: null, subLvl: 3, subName: "Primal Path", subs: ["Path of the Berserker"],
    skills: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Rage", "Unarmored Defense"], 2: ["Reckless Attack", "Danger Sense"], 3: ["Primal Path"], 5: ["Extra Attack", "Fast Movement"], 6: ["Path feature"], 7: ["Feral Instinct"], 9: ["Brutal Critical (1 die)"], 10: ["Path feature"], 11: ["Relentless Rage"], 13: ["Brutal Critical (2 dice)"], 14: ["Path feature"], 15: ["Persistent Rage"], 17: ["Brutal Critical (3 dice)"], 18: ["Indomitable Might"], 20: ["Primal Champion"] } },
  Bard: { die: 8, saves: ["dex", "cha"], caster: "full", subLvl: 3, subName: "Bard College", subs: ["College of Lore"],
    skills: ["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"], nSkills: 3,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Spellcasting", "Bardic Inspiration (d6)"], 2: ["Jack of All Trades", "Song of Rest (d6)"], 3: ["Bard College", "Expertise"], 5: ["Bardic Inspiration (d8)", "Font of Inspiration"], 6: ["Countercharm", "College feature"], 9: ["Song of Rest (d8)"], 10: ["Bardic Inspiration (d10)", "Expertise", "Magical Secrets"], 13: ["Song of Rest (d10)"], 14: ["Magical Secrets", "College feature"], 15: ["Bardic Inspiration (d12)"], 17: ["Song of Rest (d12)"], 18: ["Magical Secrets"], 20: ["Superior Inspiration"] } },
  Cleric: { die: 8, saves: ["wis", "cha"], caster: "full", subLvl: 1, subName: "Divine Domain", subs: ["Life Domain"],
    skills: ["History", "Insight", "Medicine", "Persuasion", "Religion"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Spellcasting", "Divine Domain"], 2: ["Channel Divinity (1/rest)", "Domain feature"], 5: ["Destroy Undead (CR 1/2)"], 6: ["Channel Divinity (2/rest)", "Domain feature"], 8: ["Destroy Undead (CR 1)", "Domain feature"], 10: ["Divine Intervention"], 11: ["Destroy Undead (CR 2)"], 14: ["Destroy Undead (CR 3)"], 17: ["Destroy Undead (CR 4)", "Domain feature"], 18: ["Channel Divinity (3/rest)"], 20: ["Divine Intervention Improvement"] } },
  Druid: { die: 8, saves: ["int", "wis"], caster: "full", subLvl: 2, subName: "Druid Circle", subs: ["Circle of the Land"],
    skills: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Druidic", "Spellcasting"], 2: ["Wild Shape", "Druid Circle"], 4: ["Wild Shape improvement"], 6: ["Circle feature"], 8: ["Wild Shape improvement"], 10: ["Circle feature"], 14: ["Circle feature"], 18: ["Timeless Body", "Beast Spells"], 20: ["Archdruid"] } },
  Fighter: { die: 10, saves: ["str", "con"], caster: null, subLvl: 3, subName: "Martial Archetype", subs: ["Champion"],
    skills: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"], nSkills: 2,
    asi: [4, 6, 8, 12, 14, 16, 19],
    feats: { 1: ["Fighting Style", "Second Wind"], 2: ["Action Surge"], 3: ["Martial Archetype"], 5: ["Extra Attack"], 7: ["Archetype feature"], 9: ["Indomitable"], 10: ["Archetype feature"], 11: ["Extra Attack (2)"], 13: ["Indomitable (2 uses)"], 15: ["Archetype feature"], 17: ["Action Surge (2 uses)", "Indomitable (3 uses)"], 18: ["Archetype feature"], 20: ["Extra Attack (3)"] } },
  Monk: { die: 8, saves: ["str", "dex"], caster: null, subLvl: 3, subName: "Monastic Tradition", subs: ["Way of the Open Hand"],
    skills: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Unarmored Defense", "Martial Arts"], 2: ["Ki", "Unarmored Movement"], 3: ["Monastic Tradition", "Deflect Missiles"], 4: ["Slow Fall"], 5: ["Extra Attack", "Stunning Strike"], 6: ["Ki-Empowered Strikes", "Tradition feature"], 7: ["Evasion", "Stillness of Mind"], 9: ["Unarmored Movement improvement"], 10: ["Purity of Body"], 11: ["Tradition feature"], 13: ["Tongue of the Sun and Moon"], 14: ["Diamond Soul"], 15: ["Timeless Body"], 17: ["Tradition feature"], 18: ["Empty Body"], 20: ["Perfect Self"] } },
  Paladin: { die: 10, saves: ["wis", "cha"], caster: "half", subLvl: 3, subName: "Sacred Oath", subs: ["Oath of Devotion"],
    skills: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Divine Sense", "Lay on Hands"], 2: ["Fighting Style", "Spellcasting", "Divine Smite"], 3: ["Divine Health", "Sacred Oath"], 5: ["Extra Attack"], 6: ["Aura of Protection"], 7: ["Oath feature"], 10: ["Aura of Courage"], 11: ["Improved Divine Smite"], 14: ["Cleansing Touch"], 15: ["Oath feature"], 18: ["Aura improvements"], 20: ["Oath feature"] } },
  Ranger: { die: 10, saves: ["str", "dex"], caster: "half", subLvl: 3, subName: "Ranger Archetype", subs: ["Hunter"],
    skills: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"], nSkills: 3,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Favored Enemy", "Natural Explorer"], 2: ["Fighting Style", "Spellcasting"], 3: ["Ranger Archetype", "Primeval Awareness"], 5: ["Extra Attack"], 6: ["Favored Enemy & Natural Explorer improvements"], 7: ["Archetype feature"], 8: ["Land's Stride"], 10: ["Natural Explorer improvement", "Hide in Plain Sight"], 11: ["Archetype feature"], 14: ["Favored Enemy improvement", "Vanish"], 15: ["Archetype feature"], 18: ["Feral Senses"], 20: ["Foe Slayer"] } },
  Rogue: { die: 8, saves: ["dex", "int"], caster: null, subLvl: 3, subName: "Roguish Archetype", subs: ["Thief"],
    skills: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"], nSkills: 4,
    asi: [4, 8, 10, 12, 16, 19],
    feats: { 1: ["Expertise", "Sneak Attack (1d6)", "Thieves' Cant"], 2: ["Cunning Action"], 3: ["Roguish Archetype"], 5: ["Uncanny Dodge"], 6: ["Expertise"], 7: ["Evasion"], 9: ["Archetype feature"], 11: ["Reliable Talent"], 13: ["Archetype feature"], 14: ["Blindsense"], 15: ["Slippery Mind"], 17: ["Archetype feature"], 18: ["Elusive"], 20: ["Stroke of Luck"] } },
  Sorcerer: { die: 6, saves: ["con", "cha"], caster: "full", subLvl: 1, subName: "Sorcerous Origin", subs: ["Draconic Bloodline"],
    skills: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Spellcasting", "Sorcerous Origin"], 2: ["Font of Magic"], 3: ["Metamagic"], 6: ["Origin feature"], 10: ["Metamagic"], 14: ["Origin feature"], 17: ["Metamagic"], 18: ["Origin feature"], 20: ["Sorcerous Restoration"] } },
  Warlock: { die: 8, saves: ["wis", "cha"], caster: "pact", subLvl: 1, subName: "Otherworldly Patron", subs: ["The Fiend"],
    skills: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Otherworldly Patron", "Pact Magic"], 2: ["Eldritch Invocations"], 3: ["Pact Boon"], 6: ["Patron feature"], 10: ["Patron feature"], 11: ["Mystic Arcanum (6th)"], 13: ["Mystic Arcanum (7th)"], 14: ["Patron feature"], 15: ["Mystic Arcanum (8th)"], 17: ["Mystic Arcanum (9th)"], 20: ["Eldritch Master"] } },
  Wizard: { die: 6, saves: ["int", "wis"], caster: "full", subLvl: 2, subName: "Arcane Tradition", subs: ["School of Evocation"],
    skills: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"], nSkills: 2,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Spellcasting", "Arcane Recovery"], 2: ["Arcane Tradition"], 6: ["Tradition feature"], 10: ["Tradition feature"], 14: ["Tradition feature"], 18: ["Spell Mastery"], 20: ["Signature Spells"] } },
};

/* Subclass features by subclass level (SRD 5.1) */
const SUB_FEATS = {
  "Path of the Berserker": { 3: ["Frenzy"], 6: ["Mindless Rage"], 10: ["Intimidating Presence"], 14: ["Retaliation"] },
  "College of Lore": { 3: ["Bonus Proficiencies", "Cutting Words"], 6: ["Additional Magical Secrets"], 14: ["Peerless Skill"] },
  "Life Domain": { 1: ["Bonus Proficiency (heavy armor)", "Disciple of Life"], 2: ["Channel Divinity: Preserve Life"], 6: ["Blessed Healer"], 8: ["Divine Strike (1d8)"], 14: ["Divine Strike (2d8)"], 17: ["Supreme Healing"] },
  "Circle of the Land": { 2: ["Bonus Cantrip", "Natural Recovery"], 3: ["Circle Spells"], 6: ["Land's Stride"], 10: ["Nature's Ward"], 14: ["Nature's Sanctuary"] },
  "Champion": { 3: ["Improved Critical (19–20)"], 7: ["Remarkable Athlete"], 10: ["Additional Fighting Style"], 15: ["Superior Critical (18–20)"], 18: ["Survivor"] },
  "Way of the Open Hand": { 3: ["Open Hand Technique"], 6: ["Wholeness of Body"], 11: ["Tranquility"], 17: ["Quivering Palm"] },
  "Oath of Devotion": { 3: ["Oath Spells", "Channel Divinity: Sacred Weapon / Turn the Unholy"], 7: ["Aura of Devotion"], 15: ["Purity of Spirit"], 20: ["Holy Nimbus"] },
  "Hunter": { 3: ["Hunter's Prey"], 7: ["Defensive Tactics"], 11: ["Multiattack"], 15: ["Superior Hunter's Defense"] },
  "Thief": { 3: ["Fast Hands", "Second-Story Work"], 9: ["Supreme Sneak"], 13: ["Use Magic Device"], 17: ["Thief's Reflexes"] },
  "Draconic Bloodline": { 1: ["Dragon Ancestor", "Draconic Resilience"], 6: ["Elemental Affinity"], 14: ["Dragon Wings"], 18: ["Draconic Presence"] },
  "The Fiend": { 1: ["Dark One's Blessing"], 6: ["Dark One's Own Luck"], 10: ["Fiendish Resilience"], 14: ["Hurl Through Hell"] },
  "School of Evocation": { 2: ["Evocation Savant", "Sculpt Spells"], 6: ["Potent Cantrip"], 10: ["Empowered Evocation"], 14: ["Overchannel"] },
};
const subFeatsFor = (subclass, level) => (subclass && SUB_FEATS[baseSubName(subclass)]?.[level]) || [];

/* ============ FULL RULES TEXT (SRD 5.1, CC-BY-4.0) ============ */
/* So a choice can be read in full BEFORE it's made — and long-pressed afterward. */
const SRD_FOOT = "Source: SRD 5.1 (CC-BY 4.0)";

const CLASS_BLURB = {
  Barbarian: "A fierce warrior who channels primal fury into devastating melee power and unstoppable endurance.",
  Bard: "An inspiring magician whose music and words weave magic, bolster allies, and unravel foes.",
  Cleric: "A priestly champion who wields divine magic in service of a higher power.",
  Druid: "A priest of the Old Faith, wielding the powers of nature and taking the shapes of beasts.",
  Fighter: "A master of martial combat, skilled with a wide variety of weapons and armor.",
  Monk: "A master of martial arts, harnessing the power of ki for speed, precision, and striking power.",
  Paladin: "A holy warrior bound by a sacred oath, mixing martial prowess with divine magic.",
  Ranger: "A warrior of the wilderness — tracker, hunter, and scourge of its monsters.",
  Rogue: "A scoundrel who uses stealth, cunning, and precision strikes to overcome any obstacle.",
  Sorcerer: "A spellcaster who draws on inborn magic — raw, instinctive, and dangerous.",
  Warlock: "A wielder of magic derived from a bargain struck with an extraplanar patron.",
  Wizard: "A scholarly magic-user who bends reality through long study of the arcane.",
};

/* Class feature rules text, keyed by feature name stripped of any parenthetical.
   "Class:Name" keys disambiguate features that differ between classes. */
const FEATURE_TEXT = {
  /* markers for the subclass choice itself */
  "Primal Path": "Choose the Primal Path that shapes the nature of your rage. It grants features at 3rd, 6th, 10th, and 14th level.",
  "Bard College": "Choose a Bard College reflecting how you honed your craft. It grants features at 3rd, 6th, and 14th level.",
  "Divine Domain": "Choose a domain related to your deity. It grants domain spells and features at 1st level, and again at 2nd, 6th, 8th, and 17th level.",
  "Druid Circle": "Choose the circle whose mysteries you were initiated into. It grants features at 2nd, 6th, 10th, and 14th level.",
  "Martial Archetype": "Choose the archetype you strive to emulate in combat. It grants features at 3rd, 7th, 10th, 15th, and 18th level.",
  "Monastic Tradition": "Commit to a monastic tradition. It grants features at 3rd, 6th, 11th, and 17th level.",
  "Sacred Oath": "Swear the oath that binds you as a paladin forever. It grants oath spells and features at 3rd, 7th, 15th, and 20th level.",
  "Ranger Archetype": "Choose the archetype you emulate. It grants features at 3rd, 7th, 11th, and 15th level.",
  "Roguish Archetype": "Choose the archetype your talents mirror. It grants features at 3rd, 9th, 13th, and 17th level.",
  "Sorcerous Origin": "Choose the origin of your innate magic. It grants features at 1st, 6th, 14th, and 18th level.",
  "Otherworldly Patron": "You have struck a bargain with an otherworldly being. Your choice of patron grants features at 1st, 6th, 10th, and 14th level, and expands your spell options.",
  "Arcane Tradition": "Choose a school of magic to specialize in. It grants features at 2nd, 6th, 10th, and 14th level.",
  /* Barbarian */
  "Rage": "On your turn, enter a rage as a bonus action. While raging you have advantage on Strength checks and Strength saving throws, deal bonus damage with Strength-based melee attacks (+2, rising to +3 at 9th and +4 at 16th level), and have resistance to bludgeoning, piercing, and slashing damage. You can't cast or concentrate on spells while raging, and heavy armor blocks these benefits. The rage lasts 1 minute, ending early if you fall unconscious or your turn ends without you attacking or taking damage since your last turn. You start with 2 rages per long rest, gaining more as you level (unlimited at 20th).",
  "Barbarian:Unarmored Defense": "While not wearing armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.",
  "Reckless Attack": "When you make your first attack on your turn, you can attack recklessly: you have advantage on melee weapon attack rolls using Strength this turn, but attack rolls against you have advantage until your next turn.",
  "Danger Sense": "You have advantage on Dexterity saving throws against effects you can see, such as traps and spells. You can't be blinded, deafened, or incapacitated to benefit.",
  "Fast Movement": "Your speed increases by 10 feet while you aren't wearing heavy armor.",
  "Feral Instinct": "You have advantage on initiative rolls. Additionally, if you are surprised at the start of combat and aren't incapacitated, you can act normally on your first turn if you enter your rage first.",
  "Brutal Critical": "You roll one additional weapon damage die (two at 13th level, three at 17th) when determining the extra damage of a critical hit with a melee attack.",
  "Relentless Rage": "If you drop to 0 hit points while raging and don't die outright, you can make a DC 10 Constitution saving throw to drop to 1 hit point instead. The DC rises by 5 each time you use this before finishing a short or long rest.",
  "Persistent Rage": "Your rage ends early only if you fall unconscious or choose to end it.",
  "Indomitable Might": "If your total for a Strength check is less than your Strength score, you can use that score in place of the total.",
  "Primal Champion": "Your Strength and Constitution scores increase by 4, and your maximum for those scores is now 24.",
  /* Bard */
  "Bardic Inspiration": "As a bonus action, give one creature other than yourself within 60 feet an inspiration die (d6; d8 at 5th, d10 at 10th, d12 at 15th level). Once within the next 10 minutes, that creature can add the die to one ability check, attack roll, or saving throw after rolling the d20. You have uses equal to your Charisma modifier, regained on a long rest (short rest too, once you have Font of Inspiration).",
  "Jack of All Trades": "Add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus.",
  "Song of Rest": "If you or friendly creatures who can hear your performance regain hit points during a short rest by spending Hit Dice, each regains an extra 1d6 (d8 at 9th, d10 at 13th, d12 at 17th level).",
  "Expertise": "Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check that uses either of them.",
  "Font of Inspiration": "You regain all expended uses of Bardic Inspiration when you finish a short or long rest.",
  "Countercharm": "As an action, begin a performance lasting until the end of your next turn: you and friendly creatures within 30 feet who can hear you have advantage on saving throws against being frightened or charmed.",
  "Magical Secrets": "Choose two spells from ANY class's spell list — cantrips or spells of a level you can cast. They count as bard spells for you and don't count against your spells known.",
  "Superior Inspiration": "When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.",
  /* Cleric */
  "Channel Divinity": "Channel divine energy to fuel magical effects, once per short or long rest (twice at 6th, three times at 18th level). All clerics gain Turn Undead: as an action, each undead within 30 feet that can see or hear you must make a Wisdom save or spend 1 minute fleeing you. Your domain or oath grants further options.",
  "Destroy Undead": "When an undead of the listed challenge rating or lower fails its saving throw against your Turn Undead, it is instantly destroyed.",
  "Divine Intervention": "As an action, implore your deity to intervene: roll percentile dice, and if the roll is equal to or lower than your cleric level, the deity acts (the GM chooses the form). On a success you can't use this again for 7 days; on a failure, after a long rest.",
  "Divine Intervention Improvement": "Your call for divine intervention succeeds automatically — no roll required.",
  /* Druid */
  "Druidic": "You know Druidic, the secret language of druids, and can use it to leave hidden messages. Those who know Druidic spot them automatically; others need a DC 15 Wisdom (Perception) check and can't decipher them without magic.",
  "Wild Shape": "As an action, magically assume the shape of a beast you have seen before, twice per short or long rest, for hours equal to half your druid level. At 2nd level: max CR 1/4, no flying or swimming speed. At 4th: CR 1/2, no flying. At 8th: CR 1. You keep your mental ability scores and personality, use the beast's physical stats, and can't cast spells while transformed.",
  "Wild Shape improvement": "Your Wild Shape improves — at 4th level you can take forms up to CR 1/2 (swimming allowed); at 8th level, CR 1 with no movement restrictions.",
  "Druid:Timeless Body": "The primal magic you wield slows your aging: for every 10 years that pass, your body ages only 1 year.",
  "Beast Spells": "You can perform the somatic and verbal components of druid spells while in a beast shape (but can't provide material components).",
  "Archdruid": "You can use Wild Shape an unlimited number of times, and you can ignore verbal and somatic components of your druid spells, as well as material components that lack a cost and aren't consumed.",
  /* Fighter */
  "Fighting Style": "Adopt a particular style of fighting as your specialty. Choose one option — you can't take the same Fighting Style more than once.",
  "Second Wind": "On your turn, use a bonus action to regain hit points equal to 1d10 + your fighter level. Once per short or long rest.",
  "Action Surge": "On your turn, take one additional action on top of your regular action and possible bonus action. Once per short or long rest (twice per rest at 17th level, but only once per turn).",
  "Indomitable": "Reroll a saving throw that you fail; you must use the new roll. Once per long rest (twice at 13th, three times at 17th level).",
  /* Monk */
  "Monk:Unarmored Defense": "While wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.",
  "Unarmored Defense": "Barbarian: while not wearing armor, AC = 10 + Dex modifier + Con modifier (a shield is allowed). Monk: while wearing no armor and no shield, AC = 10 + Dex modifier + Wis modifier.",
  "Martial Arts": "While unarmed or wielding only monk weapons and wearing no armor or shield: you can use Dexterity for attack and damage rolls, roll a d4 in place of normal damage (rising with level to d10), and make one unarmed strike as a bonus action when you take the Attack action.",
  "Ki": "You have ki points equal to your monk level, regained on a short or long rest. Spend them on: Flurry of Blows (1 ki — two unarmed strikes as a bonus action after Attacking), Patient Defense (1 ki — Dodge as a bonus action), and Step of the Wind (1 ki — Disengage or Dash as a bonus action, jump distance doubled). Your ki save DC = 8 + proficiency bonus + Wisdom modifier.",
  "Unarmored Movement": "Your speed increases by 10 feet while you wear no armor and wield no shield. The bonus rises with level, up to +30 feet at 18th.",
  "Unarmored Movement improvement": "You can move along vertical surfaces and across liquids on your turn without falling during the move.",
  "Deflect Missiles": "Use your reaction when hit by a ranged weapon attack to reduce the damage by 1d10 + your Dexterity modifier + your monk level. If you reduce it to 0, you can catch the missile and spend 1 ki to throw it back as a monk weapon attack.",
  "Slow Fall": "Use your reaction when you fall to reduce any falling damage you take by five times your monk level.",
  "Stunning Strike": "When you hit another creature with a melee weapon attack, spend 1 ki to attempt a stunning strike: the target must succeed on a Constitution saving throw or be stunned until the end of your next turn.",
  "Ki-Empowered Strikes": "Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.",
  "Evasion": "When you make a Dexterity saving throw against an effect that deals half damage on a success, you instead take no damage on a success and only half damage on a failure.",
  "Stillness of Mind": "Use your action to end one effect on yourself that is causing you to be charmed or frightened.",
  "Purity of Body": "Your mastery of ki makes you immune to disease and poison.",
  "Tongue of the Sun and Moon": "You understand all spoken languages, and any creature that can understand a language understands what you say.",
  "Diamond Soul": "You gain proficiency in all saving throws. Additionally, when you fail a saving throw, you can spend 1 ki point to reroll it and take the second result.",
  "Monk:Timeless Body": "Your ki sustains you: you suffer none of the frailty of old age, can't be aged magically, and need no food or water.",
  "Timeless Body": "Monk: you suffer none of the frailty of old age, can't be aged magically, and need no food or water. Druid: for every 10 years that pass, your body ages only 1 year.",
  "Empty Body": "Spend 4 ki as an action to become invisible for 1 minute, with resistance to all damage but force damage. Or spend 8 ki to cast the astral projection spell (yourself only).",
  "Perfect Self": "When you roll initiative and have no ki points remaining, you regain 4 ki points.",
  /* Paladin */
  "Divine Sense": "As an action, until the end of your next turn you know the location of any celestial, fiend, or undead within 60 feet that isn't behind total cover, and you detect consecrated or desecrated places and objects. Uses: 1 + your Charisma modifier per long rest.",
  "Lay on Hands": "You have a pool of healing power equal to 5 × your paladin level, restored on a long rest. As an action, touch a creature to restore any number of remaining points, or expend 5 points to cure one disease or neutralize one poison.",
  "Divine Smite": "When you hit a creature with a melee weapon attack, you can expend one spell slot to deal an extra 2d8 radiant damage, +1d8 per slot level above 1st (max 5d8), and +1d8 against undead or fiends.",
  "Divine Health": "The divine magic flowing through you makes you immune to disease.",
  "Aura of Protection": "Whenever you or a friendly creature within 10 feet of you (30 feet at 18th level) must make a saving throw, the creature gains a bonus equal to your Charisma modifier (minimum +1). You must be conscious.",
  "Aura of Courage": "You and friendly creatures within 10 feet of you (30 feet at 18th level) can't be frightened while you are conscious.",
  "Improved Divine Smite": "Whenever you hit a creature with a melee weapon, it takes an extra 1d8 radiant damage.",
  "Cleansing Touch": "As an action, end one spell on yourself or on one willing creature you touch. Uses equal to your Charisma modifier (minimum 1) per long rest.",
  "Aura improvements": "Your Aura of Protection and Aura of Courage now extend 30 feet from you.",
  /* Ranger */
  "Favored Enemy": "Choose a type of favored enemy. You have advantage on Wisdom (Survival) checks to track your favored enemies and on Intelligence checks to recall information about them, and you learn one language spoken by them.",
  "Favored Enemy improvement": "Choose an additional favored enemy type (and an associated language).",
  "Natural Explorer": "Choose a favored terrain. There, doubled proficiency on related Intelligence and Wisdom checks, difficult terrain doesn't slow your group, you can't become lost except by magic, you stay alert while doing other activities, you can stealth alone at a normal pace, you find twice as much food foraging, and tracking reveals exact numbers, sizes, and how long ago they passed.",
  "Natural Explorer improvement": "Choose an additional favored terrain.",
  "Favored Enemy & Natural Explorer improvements": "Choose one additional favored enemy (with a language) and one additional favored terrain.",
  "Primeval Awareness": "As an action, expend a spell slot to sense for 1 minute per slot level whether any aberrations, celestials, dragons, elementals, fey, fiends, or undead are present within 1 mile (6 miles in favored terrain) — but not their number or location.",
  "Land's Stride": "Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed or harmed by them. You also have advantage on saving throws against magically created or manipulated plants that impede movement.",
  "Hide in Plain Sight": "Spend 1 minute creating camouflage and press yourself against a solid surface: while you remain there without moving or acting, you gain +10 to Dexterity (Stealth) checks.",
  "Vanish": "You can use the Hide action as a bonus action, and you can't be tracked by nonmagical means unless you choose to leave a trail.",
  "Feral Senses": "You can attack creatures you can't see without disadvantage, and you are aware of the location of any invisible creature within 30 feet (if it isn't hidden and you aren't blinded or deafened).",
  "Foe Slayer": "Once on each of your turns, add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies.",
  /* Rogue */
  "Sneak Attack": "Once per turn, deal extra damage (1d6, +1d6 every two rogue levels) to one creature you hit with a finesse or ranged weapon attack if you have advantage on the roll — or if another enemy of the target is within 5 feet of it and you don't have disadvantage.",
  "Thieves' Cant": "A secret mix of dialect, jargon, and code that hides messages in seemingly normal conversation (conveying one takes four times longer). You also understand secret thieves' signs and symbols.",
  "Cunning Action": "Take a bonus action on each of your turns to Dash, Disengage, or Hide.",
  "Uncanny Dodge": "When an attacker you can see hits you with an attack, use your reaction to halve the attack's damage against you.",
  "Reliable Talent": "Whenever you make an ability check that lets you add your proficiency bonus, treat a d20 roll of 9 or lower as a 10.",
  "Blindsense": "If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.",
  "Slippery Mind": "Your mental strength grants you proficiency in Wisdom saving throws.",
  "Elusive": "No attack roll has advantage against you while you aren't incapacitated.",
  "Stroke of Luck": "Turn a missed attack into a hit, or treat a failed ability check as a natural 20. Once per short or long rest.",
  /* Sorcerer */
  "Font of Magic": "You gain sorcery points equal to your sorcerer level, regained on a long rest. As a bonus action, convert points into a spell slot (2 → 1st, 3 → 2nd, 5 → 3rd, 6 → 4th, 7 → 5th) or break down a spell slot into points equal to its level.",
  "Metamagic": "Twist your spells with Metamagic options, fueled by sorcery points. You learn two options at 3rd level and one more at 10th and 17th. Only one option can apply to a spell (Empowered Spell excepted).",
  "Sorcerous Restoration": "You regain 4 expended sorcery points whenever you finish a short rest.",
  /* Warlock */
  "Eldritch Master": "Spend 1 minute entreating your patron to regain all your expended Pact Magic spell slots. Once per long rest.",
  /* Wizard */
  "Arcane Recovery": "Once per day when you finish a short rest, recover expended spell slots with a combined level up to half your wizard level (rounded up), none of them 6th level or higher.",
  "Spell Mastery": "Choose a 1st-level and a 2nd-level wizard spell from your spellbook: while you have them prepared, cast them at their lowest level without expending a slot. You may swap them after 8 hours of study.",
  "Signature Spells": "Choose two 3rd-level spells from your spellbook: they are always prepared (not counting against your total), and you can cast each once at 3rd level without a slot per short or long rest.",
};

/* Subclass flavor and full feature text, keyed by base subclass name. cls binds it to its class. */
const SUB_LORE = {
  "Path of the Berserker": { cls: "Barbarian",
    flavor: "For some barbarians, rage is a means to an end — that end being violence. The Path of the Berserker is a path of untrammeled fury, slick with blood. As you enter the berserker's rage, you thrill in the chaos of battle, heedless of your own health or well-being.",
    features: {
      3: [{ n: "Frenzy", t: "You can go into a frenzy when you rage: for its duration, you can make a single melee weapon attack as a bonus action on each of your turns. When the rage ends, you suffer one level of exhaustion." }],
      6: [{ n: "Mindless Rage", t: "You can't be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration." }],
      10: [{ n: "Intimidating Presence", t: "As an action, frighten one creature within 30 feet that can see or hear you: it must succeed on a Wisdom saving throw (DC 8 + your proficiency bonus + your Charisma modifier) or be frightened of you until the end of your next turn. You can extend the effect on later turns by using your action." }],
      14: [{ n: "Retaliation", t: "When you take damage from a creature within 5 feet of you, use your reaction to make a melee weapon attack against that creature." }],
    } },
  "College of Lore": { cls: "Bard",
    flavor: "Bards of the College of Lore know something about most things, collecting bits of knowledge from scholarly tomes to peasant tales. Their loyalty lies in the pursuit of beauty and truth, and their cutting wit can deflate the pretensions of the powerful.",
    features: {
      3: [
        { n: "Bonus Proficiencies", t: "You gain proficiency with three skills of your choice." },
        { n: "Cutting Words", t: "When a creature you can see within 60 feet makes an attack roll, ability check, or damage roll, use your reaction to expend one Bardic Inspiration die and subtract its roll from the creature's (after it rolls, before the outcome is known). No effect if the creature can't hear you or is immune to being charmed." },
      ],
      6: [{ n: "Additional Magical Secrets", t: "Learn two spells of your choice from any class's list — cantrips or spells of a level you can cast. They count as bard spells and don't count against your spells known." }],
      14: [{ n: "Peerless Skill", t: "When you make an ability check, you can expend one Bardic Inspiration die and add it to the roll (after rolling, before the outcome is known)." }],
    } },
  "Life Domain": { cls: "Cleric",
    flavor: "The Life domain focuses on the vibrant positive energy that sustains all life. Gods of life promote vitality and health — healing the sick and wounded, caring for those in need, and driving away the forces of death and undeath.",
    features: {
      1: [
        { n: "Bonus Proficiency (heavy armor)", t: "You gain proficiency with heavy armor." },
        { n: "Disciple of Life", t: "Your healing spells are more effective: whenever you use a spell of 1st level or higher to restore hit points, the creature regains additional hit points equal to 2 + the spell's level." },
      ],
      2: [{ n: "Channel Divinity: Preserve Life", t: "As an action, present your holy symbol and evoke healing energy that restores hit points equal to five times your cleric level, divided as you choose among creatures within 30 feet — none above half its hit point maximum. Cannot affect undead or constructs." }],
      6: [{ n: "Blessed Healer", t: "When you cast a spell of 1st level or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell's level." }],
      8: [{ n: "Divine Strike", t: "Once on each of your turns when you hit a creature with a weapon attack, deal an extra 1d8 radiant damage (2d8 at 14th level)." }],
      17: [{ n: "Supreme Healing", t: "When you would normally roll dice to restore hit points with a spell, instead use the highest possible number for each die." }],
    } },
  "Circle of the Land": { cls: "Druid",
    flavor: "The Circle of the Land is made up of mystics and sages who safeguard ancient knowledge and rites through a vast oral tradition. Your magic is influenced by the land where you were initiated into the circle's mysteries.",
    features: {
      2: [
        { n: "Bonus Cantrip", t: "You learn one additional druid cantrip of your choice." },
        { n: "Natural Recovery", t: "Once per day during a short rest, recover expended spell slots with a combined level up to half your druid level (rounded up), none of them 6th level or higher." },
      ],
      3: [{ n: "Circle Spells", t: "Your mystical connection to the land grants spells tied to the terrain where you became a druid. They are always prepared and don't count against your prepared total. Choose your land: arctic, coast, desert, forest, grassland, mountain, swamp, or Underdark." }],
      6: [{ n: "Land's Stride", t: "Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed or harmed. You have advantage on saves against magically created or manipulated plants that impede movement." }],
      10: [{ n: "Nature's Ward", t: "You can't be charmed or frightened by elementals or fey, and you are immune to poison and disease." }],
      14: [{ n: "Nature's Sanctuary", t: "When a beast or plant creature attacks you, it must first make a Wisdom saving throw against your druid spell save DC; on a failure it must choose a different target, or the attack automatically misses." }],
    } },
  "Champion": { cls: "Fighter",
    flavor: "The archetypal Champion focuses on the development of raw physical power honed to deadly perfection, combining rigorous training with physical excellence to deal devastating blows.",
    features: {
      3: [{ n: "Improved Critical", t: "Your weapon attacks score a critical hit on a roll of 19 or 20." }],
      7: [{ n: "Remarkable Athlete", t: "Add half your proficiency bonus (rounded up) to any Strength, Dexterity, or Constitution check that doesn't already use your proficiency bonus. Your running long jump distance also increases by feet equal to your Strength modifier." }],
      10: [{ n: "Additional Fighting Style", t: "You choose a second option from the Fighting Style class feature." }],
      15: [{ n: "Superior Critical", t: "Your weapon attacks score a critical hit on a roll of 18–20." }],
      18: [{ n: "Survivor", t: "At the start of each of your turns, you regain 5 + your Constitution modifier hit points if you have no more than half your hit points left (doesn't function at 0 hit points)." }],
    } },
  "Way of the Open Hand": { cls: "Monk",
    flavor: "Monks of the Way of the Open Hand are the ultimate masters of martial arts combat, whether armed or unarmed. They learn to push and trip opponents, manipulate ki to heal themselves, and practice advanced techniques that can kill with a touch.",
    features: {
      3: [{ n: "Open Hand Technique", t: "Whenever you hit a creature with one of the attacks granted by Flurry of Blows, you can impose one effect: it must succeed on a Dexterity save or be knocked prone; it must succeed on a Strength save or be pushed 15 feet away; or it can't take reactions until the end of your next turn." }],
      6: [{ n: "Wholeness of Body", t: "As an action, regain hit points equal to three times your monk level. Once per long rest." }],
      11: [{ n: "Tranquility", t: "At the end of a long rest, you gain the effect of a sanctuary spell (save DC 8 + your proficiency bonus + your Wisdom modifier) that lasts until your next long rest, or until you attack or cast a spell affecting an enemy." }],
      17: [{ n: "Quivering Palm", t: "When you hit a creature with an unarmed strike, spend 3 ki to start imperceptible lethal vibrations lasting days equal to your monk level. As an action, you can end them: the creature must make a Constitution saving throw — reduced to 0 hit points on a failure, 10d10 necrotic damage on a success." }],
    } },
  "Oath of Devotion": { cls: "Paladin",
    flavor: "The Oath of Devotion binds a paladin to the loftiest ideals of justice, virtue, and order. These white knights hold themselves to the tenets of honesty, courage, compassion, honor, and duty — the ideal of the knight in shining armor.",
    features: {
      3: [
        { n: "Oath Spells", t: "Your oath grants you spells at the listed paladin levels. They are always prepared and don't count against the number of spells you can prepare each day." },
        { n: "Channel Divinity: Sacred Weapon / Turn the Unholy", t: "Sacred Weapon: as an action, imbue one weapon you hold — for 1 minute, add your Charisma modifier (minimum +1) to attack rolls with it, and it sheds bright light in a 20-foot radius. Turn the Unholy: as an action, each fiend or undead within 30 feet that can see or hear you must make a Wisdom save or be turned (flees, can only Dash) for 1 minute." },
      ],
      7: [{ n: "Aura of Devotion", t: "You and friendly creatures within 10 feet of you (30 feet at 18th level) can't be charmed while you are conscious." }],
      15: [{ n: "Purity of Spirit", t: "You are always under the effects of a protection from evil and good spell." }],
      20: [{ n: "Holy Nimbus", t: "As an action, emanate an aura of sunlight for 1 minute: bright light in a 30-foot radius, enemies that start their turn in it take 10 radiant damage, and you have advantage on saving throws against spells cast by fiends and undead. Once per long rest." }],
    } },
  "Hunter": { cls: "Ranger",
    flavor: "Emulating the Hunter archetype means accepting your place as a bulwark between civilization and the terrors of the wilderness, honing techniques against threats from rampaging ogres and hordes of orcs to towering giants and terrifying dragons.",
    features: {
      3: [{ n: "Hunter's Prey", t: "Choose one: Colossus Slayer — once per turn, your weapon attack deals an extra 1d8 to a creature below its hit point maximum. Giant Killer — when a Large or larger creature within 5 feet hits or misses you, use your reaction to attack it. Horde Breaker — once per turn when you attack, make another attack with the same weapon against a different creature within 5 feet of the original target and in range." }],
      7: [{ n: "Defensive Tactics", t: "Choose one: Escape the Horde — opportunity attacks against you have disadvantage. Multiattack Defense — after a creature hits you, its other attacks this turn take −4 (you gain +4 AC against them). Steel Will — advantage on saving throws against being frightened." }],
      11: [{ n: "Multiattack", t: "Choose one: Volley — as an action, make a ranged attack against any number of creatures within 10 feet of a point you can see in range (ammunition and a separate roll for each). Whirlwind Attack — as an action, make a melee attack against any number of creatures within 5 feet of you (a separate roll for each)." }],
      15: [{ n: "Superior Hunter's Defense", t: "Choose one: Evasion — a Dex save for half damage becomes no damage on a success, half on a failure. Stand Against the Tide — when a creature misses you with a melee attack, use your reaction to force it to repeat the attack against another creature of your choice. Uncanny Dodge — use your reaction to halve an attack's damage against you." }],
    } },
  "Thief": { cls: "Rogue",
    flavor: "Burglars, bandits, cutpurses, and treasure seekers — thieves hone their skills in the larcenous arts, adding unmatched agility and a deep bag of tricks to the rogue's stealth and cunning.",
    features: {
      3: [
        { n: "Fast Hands", t: "Your Cunning Action bonus action can also be used to make a Dexterity (Sleight of Hand) check, use thieves' tools to disarm a trap or open a lock, or take the Use an Object action." },
        { n: "Second-Story Work", t: "Climbing no longer costs you extra movement, and your running jump distance increases by a number of feet equal to your Dexterity modifier." },
      ],
      9: [{ n: "Supreme Sneak", t: "You have advantage on Dexterity (Stealth) checks if you move no more than half your speed on the same turn." }],
      13: [{ n: "Use Magic Device", t: "You ignore all class, race, and level requirements on the use of magic items." }],
      17: [{ n: "Thief's Reflexes", t: "You can take two turns during the first round of any combat — the first at your normal initiative, the second at your initiative minus 10. (Not while surprised.)" }],
    } },
  "Draconic Bloodline": { cls: "Sorcerer",
    flavor: "Your innate magic comes from draconic magic mingled with your blood — perhaps an ancient bargain, or a dragon somewhere in your ancestry whose power still echoes in you.",
    features: {
      1: [
        { n: "Dragon Ancestor", t: "Choose a type of dragon as your ancestor; its associated damage type powers your later features. You can speak, read, and write Draconic, and whenever you make a Charisma check when interacting with dragons, your proficiency bonus is doubled if it applies." },
        { n: "Draconic Resilience", t: "Your hit point maximum increases by 1 per sorcerer level. While you aren't wearing armor, dragonlike scales give you AC equal to 13 + your Dexterity modifier." },
      ],
      6: [{ n: "Elemental Affinity", t: "When you cast a spell that deals your ancestry's damage type, add your Charisma modifier to one damage roll of that spell. You can also spend 1 sorcery point to gain resistance to that damage type for 1 hour." }],
      14: [{ n: "Dragon Wings", t: "As a bonus action, sprout dragon wings from your back, gaining a flying speed equal to your current speed (not while wearing armor unless it's made to accommodate them)." }],
      18: [{ n: "Draconic Presence", t: "As an action, spend 5 sorcery points to exude an aura of awe or fear (your choice) to 60 feet for 1 minute: each hostile creature that starts its turn in the aura must succeed on a Wisdom save or be charmed (awe) or frightened (fear) until the aura ends." }],
    } },
  "The Fiend": { cls: "Warlock",
    flavor: "You have made a pact with a fiend from the lower planes of existence — a being whose aims are evil, even if you strive against those aims. Such beings desire the corruption or destruction of all things, ultimately including you.",
    features: {
      1: [{ n: "Dark One's Blessing", t: "When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum of 1)." }],
      6: [{ n: "Dark One's Own Luck", t: "When you make an ability check or a saving throw, add a d10 to the roll (after rolling, before any effects occur). Once per short or long rest." }],
      10: [{ n: "Fiendish Resilience", t: "Choose one damage type when you finish a short or long rest: you have resistance to it until you choose another. Damage from magical or silvered weapons ignores this resistance." }],
      14: [{ n: "Hurl Through Hell", t: "When you hit a creature with an attack, you can instantly transport it through the lower planes: it disappears and hurtles through a nightmare landscape, returning to the space it left at the end of your next turn and taking 10d10 psychic damage (unless it is a fiend). Once per long rest." }],
    } },
  "School of Evocation": { cls: "Wizard",
    flavor: "You focus your study on magic that creates powerful elemental effects — bitter cold, searing flame, rolling thunder, crackling lightning, and burning acid. Evokers who serve in armies are feared as war mages.",
    features: {
      2: [
        { n: "Evocation Savant", t: "The gold and time you must spend to copy an evocation spell into your spellbook is halved." },
        { n: "Sculpt Spells", t: "When you cast an evocation spell that affects creatures you can see, choose up to 1 + the spell's level of them: they automatically succeed on their saving throws against it, and take no damage if they would normally take half on a success." },
      ],
      6: [{ n: "Potent Cantrip", t: "When a creature succeeds on a saving throw against your cantrip, it still takes half the cantrip's damage (but suffers no additional effect)." }],
      10: [{ n: "Empowered Evocation", t: "Add your Intelligence modifier to one damage roll of any wizard evocation spell you cast." }],
      14: [{ n: "Overchannel", t: "When you cast a wizard spell of 1st–5th level that deals damage, you can deal maximum damage with it. The first use is safe; each further use before a long rest deals you 2d12 necrotic damage per level of the spell (increasing by 1d12 each time), which can't be prevented or reduced in any way." }],
    } },
};
/* Index subclass feature texts by stripped name so long-press works anywhere a feature is shown */
Object.values(SUB_LORE).forEach((s) => Object.values(s.features).forEach((fx) => fx.forEach((f) => {
  const k = baseSubName(f.n);
  if (!FEATURE_TEXT[k]) FEATURE_TEXT[k] = f.t;
})));

/* Best-available rules text for a feature name: imported compendium text wins, then SRD text
   (class-specific first), then the core fallbacks. */
function featureBody(rawName, cls, customs) {
  const name = String(rawName || "").trim();
  const strip = baseSubName(name);
  const ft = customs?.featureTexts || {};
  return ft[name] || ft[strip]
    || (cls && (FEATURE_TEXT[`${cls}:${name}`] || FEATURE_TEXT[`${cls}:${strip}`]))
    || FEATURE_TEXT[name] || FEATURE_TEXT[strip]
    || CORE_FEATURE_INFO[strip]
    || (/\bfeature\b$/i.test(strip) ? "Granted by your subclass at this level — read its entry for the details." : null);
}

/* Feats available under CC-BY (SRD 5.1 + SRD 5.2 origin & fighting style feats) */
const FEATS = [
  { name: "Grappler", desc: "Adv. on attacks vs creatures you grapple; grapple as part of Attack" },
  { name: "Alert", desc: "Add proficiency bonus to initiative; swap initiative with a willing ally" },
  { name: "Magic Initiate", desc: "Two cantrips and one 1st-level spell from a class list" },
  { name: "Savage Attacker", desc: "Once per turn, roll melee weapon damage twice and take either" },
  { name: "Skilled", desc: "Proficiency in any three skills or tools" },
  { name: "Fighting Style: Archery", desc: "+2 to ranged weapon attack rolls" },
  { name: "Fighting Style: Defense", desc: "+1 AC while wearing armor" },
  { name: "Fighting Style: Dueling", desc: "+2 damage with a one-handed melee weapon" },
  { name: "Fighting Style: Great Weapon Fighting", desc: "Reroll 1s and 2s on two-handed weapon damage" },
];

/* Warlock invocations known by class level */
const INVOCATIONS = (l) => (l >= 18 ? 8 : l >= 15 ? 7 : l >= 12 ? 6 : l >= 9 ? 5 : l >= 7 ? 4 : l >= 5 ? 3 : l >= 2 ? 2 : 0);

/* ==== Spell selection rules (SRD) ==== */
const CANTRIPS_KNOWN = {
  Bard: (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2), Cleric: (l) => (l >= 10 ? 5 : l >= 4 ? 4 : 3),
  Druid: (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2), Sorcerer: (l) => (l >= 10 ? 6 : l >= 4 ? 5 : 4),
  Warlock: (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2), Wizard: (l) => (l >= 10 ? 5 : l >= 4 ? 4 : 3),
};
const SPELLS_KNOWN = {
  Bard: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22],
  Sorcerer: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],
  Warlock: [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
  Ranger: [0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11],
};
const SPELL_ABILITY = { Bard: "cha", Cleric: "wis", Druid: "wis", Paladin: "cha", Ranger: "wis", Sorcerer: "cha", Warlock: "cha", Wizard: "int" };
function spellCapacity(clsName, clsLevel, abilities) {
  const m = mod(abilities[SPELL_ABILITY[clsName]]);
  switch (clsName) {
    case "Bard": case "Sorcerer": case "Warlock": case "Ranger":
      return { n: SPELLS_KNOWN[clsName][clsLevel - 1], label: "spells known" };
    case "Cleric": case "Druid":
      return { n: Math.max(1, m + clsLevel), label: "spells prepared (ability mod + level; full class list available)" };
    case "Paladin":
      return { n: clsLevel < 2 ? 0 : Math.max(1, m + Math.floor(clsLevel / 2)), label: "spells prepared (Cha mod + half level)" };
    case "Wizard":
      return { n: 6 + 2 * (clsLevel - 1), label: `spellbook spells (prepare Int mod + level = ${Math.max(1, m + clsLevel)}/day)` };
    default: return { n: 0, label: "" };
  }
}
function maxSpellLevel(clsName, clsLevel) {
  const c = CLASSES[clsName].caster;
  if (c === "full") return clsLevel >= 1 ? Math.min(9, Math.ceil(clsLevel / 2)) : 0;
  if (c === "half") return clsLevel >= 2 ? Math.min(5, Math.ceil(clsLevel / 4)) : 0;
  if (c === "pact") return PACT(clsLevel).lvl;
  return 0;
}
/* A spell's classes string lists entries like "Bard, Cleric (Arcana), Warlock (Archfey)".
   A plain class entry fits any member of that class; a parenthesized entry fits only a matching subclass. */
const spellFitsClass = (sp, clsName, subclass) => {
  const want = clsName.toLowerCase();
  const toks = subclass ? subTokens(subclass) : [];
  return (sp.classes || "").split(",").some((entry) => {
    const m = entry.trim().match(/^(.+?)(?:\s*\(([^)]*)\))?$/);
    if (!m || m[1].trim().toLowerCase() !== want) return false;
    return !m[2] || toks.includes(normSub(m[2]));
  });
};

/* Multiclass spell slot table — index = combined caster level - 1 */
const MC_SLOTS = [
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
/* Native single-class half-caster table (Paladin/Ranger), index = class level - 1 */
const HALF_SLOTS = [
  [],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],
  [4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3],[4,3,3,3],[4,3,3,3,1],[4,3,3,3,2],
];
const PACT = (l) => (l >= 17 ? { n: 4, lvl: 5 } : l >= 11 ? { n: 3, lvl: 5 } : l >= 9 ? { n: 2, lvl: 5 } : l >= 7 ? { n: 2, lvl: 4 } : l >= 5 ? { n: 2, lvl: 3 } : l >= 3 ? { n: 2, lvl: 2 } : l >= 2 ? { n: 2, lvl: 1 } : { n: 1, lvl: 1 });

function spellSlots(classes) {
  const casters = classes.filter((c) => CLASSES[c.name].caster === "full" || CLASSES[c.name].caster === "half");
  if (!casters.length) return null;
  if (casters.length === 1 && CLASSES[casters[0].name].caster === "half") return HALF_SLOTS[casters[0].level - 1];
  const cl = casters.reduce((s, c) => s + (CLASSES[c.name].caster === "full" ? c.level : Math.floor(c.level / 2)), 0);
  return cl > 0 ? MC_SLOTS[Math.min(cl, 20) - 1] : null;
}

const totalLevel = (ch) => ch.classes.reduce((s, c) => s + c.level, 0);
const uid = () => Math.random().toString(36).slice(2, 10);

/* ============ THEME ============ */
const T = {
  bg: "#161219", panel: "#221c26", panel2: "#2b2330", ink: "#e8dfd0", dim: "#a2937f",
  gold: "#c9a44c", blood: "#8e3b46", edge: "#3a3040", green: "#7da05f",
};
const card = { background: T.panel, border: `1px solid ${T.edge}`, borderRadius: 10 };
const btn = (primary) => ({
  padding: "11px 18px", borderRadius: 12, cursor: "pointer", fontWeight: 700, letterSpacing: 0.5,
  minHeight: 44, WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontSize: 15,
  background: primary ? T.blood : "transparent", color: primary ? T.ink : T.gold,
  border: primary ? `1px solid ${T.blood}` : `1px solid ${T.gold}`, fontFamily: "Georgia, serif",
});

/* ============ ICONS (inline SVG, stroke = currentColor) ============ */
const ICON_PATHS = {
  d20: <><path d="M12 2 3.34 7v10L12 22l8.66-5V7L12 2Z" /><path d="M12 22v-8.5" /><path d="M3.34 7 12 13.5 20.66 7" /><path d="m7.5 4.6 4.5 8.9 4.5-8.9" /></>,
  sword: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></>,
  bow: <><path d="M17 3h4v4" /><path d="M21 3 8.5 15.5" /><path d="M5 8c-1.5 2.5-2 5.5-1 9 3.5 1 6.5.5 9-1" /><path d="M4 20l3.5-3.5" /></>,
  sparkles: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  hammer: <><path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" /><path d="M17.64 15 22 10.64" /><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" /></>,
  up: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  down: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  moon: <><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></>,
  axe: <><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" /><path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  holy: <><path d="M12 2v20" /><path d="M5 8h14" /><path d="M7.5 21h9" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  swords: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /><path d="M9.5 6.5 21 18v3h-3L6.5 9.5" /></>,
  zen: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
  dagger: <><path d="M3 21l5-5" /><path d="m8 16 9.5-9.5a2.83 2.83 0 0 0-4-4L4 12l4 4Z" /><path d="M14 4l6 6" /></>,
  flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
};
const Icon = ({ name, size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 6, ...style }}>
    {ICON_PATHS[name]}
  </svg>
);

/* Every class wears its own colors and sigil, everywhere it appears */
const CLASS_THEMES = {
  Barbarian: { color: "#d1603d", icon: "axe" },
  Bard: { color: "#c77dca", icon: "music" },
  Cleric: { color: "#e8d27c", icon: "holy" },
  Druid: { color: "#7fb069", icon: "leaf" },
  Fighter: { color: "#a8b8c8", icon: "swords" },
  Monk: { color: "#5eb1bf", icon: "zen" },
  Paladin: { color: "#ffd166", icon: "shield" },
  Ranger: { color: "#588157", icon: "bow" },
  Rogue: { color: "#8d99ae", icon: "dagger" },
  Sorcerer: { color: "#f4845f", icon: "flame" },
  Warlock: { color: "#b48ead", icon: "eye" },
  Wizard: { color: "#6c91e0", icon: "book" },
};
const ClassTag = ({ name, size = 14, dim, children }) => {
  const t = CLASS_THEMES[name] || { color: T.ink, icon: "d20" };
  return (
    <span style={{ color: dim ? undefined : t.color, whiteSpace: "nowrap" }}>
      <Icon name={t.icon} size={size} style={{ marginRight: 4, color: t.color }} />{children ?? name}
    </span>
  );
};

/* ============ ANIMATED 3D DICE ============ */
/* Real polyhedra — tetrahedron, cube, octahedron, pentagonal trapezohedron,
   dodecahedron, icosahedron — built from vertex hulls and rendered as CSS
   matrix3d faces. The inner wrapper statically orients the rolled face toward
   the viewer with its number upright; the outer wrapper's tumble animation
   ends at identity, so the die spins wildly and lands exactly on the roll. */
const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; },
};

function dieVertices(sides) {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const v = [];
  if (sides === 4) return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  if (sides === 6) { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]); return v; }
  if (sides === 8) return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  if (sides === 10) {
    // Pentagonal trapezohedron: two interleaved rings of 5, apexes set by kite planarity
    const h = 0.15, rad = (d) => (d * Math.PI) / 180;
    for (let k = 0; k < 5; k++) {
      v.push([Math.cos(rad(k * 72)), Math.sin(rad(k * 72)), h]);
      v.push([Math.cos(rad(k * 72 + 36)), Math.sin(rad(k * 72 + 36)), -h]);
    }
    const [a, b, c] = [v[0], v[2], v[1]]; // ring neighbors A0, A1 and B0 between them
    const n = V3.cross(V3.sub(b, a), V3.sub(c, a));
    const za = Math.abs(V3.dot(n, a) / n[2]); // where the kite's plane crosses the z-axis
    v.push([0, 0, za], [0, 0, -za]);
    return v;
  }
  if (sides === 12) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]); }
    return v;
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]); } // icosahedron
  return v;
}

/* Convex hull by supporting planes: every triplet whose plane has all other
   vertices on one side is a face plane; coplanar vertices are merged. */
function hullFaces(verts) {
  const faces = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) for (let k = j + 1; k < verts.length; k++) {
    let n = V3.cross(V3.sub(verts[j], verts[i]), V3.sub(verts[k], verts[i]));
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) continue;
    n = V3.scale(n, 1 / l);
    let d = V3.dot(n, verts[i]);
    if (d < 0) { n = V3.scale(n, -1); d = -d; }
    const dots = verts.map((p) => V3.dot(n, p));
    if (dots.some((x) => x > d + 1e-4)) continue;
    if (faces.some((f) => V3.dot(f.n, n) > 1 - 1e-4)) continue;
    faces.push({ n, idx: dots.map((x, m) => [x, m]).filter(([x]) => x > d - 1e-4).map(([, m]) => m) });
  }
  return faces.sort((a, b) => b.n[2] - a.n[2] || Math.atan2(a.n[1], a.n[0]) - Math.atan2(b.n[1], b.n[0]));
}

const DIE_CACHE = {};
function buildDie(sides, size) {
  const key = sides + ":" + size;
  if (DIE_CACHE[key]) return DIE_CACHE[key];
  const raw = dieVertices(sides);
  const R = Math.max(...raw.map((p) => Math.hypot(p[0], p[1], p[2])));
  const verts = raw.map((p) => V3.scale(p, (size * 0.5) / R));
  const fmt = (a) => a.map((x) => x.toFixed(4)).join(",");
  const faces = hullFaces(verts).map(({ n, idx }) => {
    let c = [0, 0, 0];
    idx.forEach((m) => { c = [c[0] + verts[m][0], c[1] + verts[m][1], c[2] + verts[m][2]]; });
    c = V3.scale(c, 1 / idx.length);
    const w0 = V3.norm(V3.sub(verts[idx[0]], c));
    const u0 = V3.norm(V3.cross(n, w0));
    const pts = idx.map((m) => verts[m])
      .sort((p, q) => Math.atan2(V3.dot(V3.sub(p, c), w0), V3.dot(V3.sub(p, c), u0)) - Math.atan2(V3.dot(V3.sub(q, c), w0), V3.dot(V3.sub(q, c), u0)));
    // face-local "up": a vertex for triangles/pentagons (classic dice look), the kite's apex
    // for the d10, and an edge midpoint for the cube so squares land flat, not diamond
    let up = pts[0];
    if (sides === 6) up = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, (pts[0][2] + pts[1][2]) / 2];
    if (sides === 10) up = pts.reduce((best, p) => (Math.hypot(...V3.sub(p, c)) > Math.hypot(...V3.sub(best, c)) ? p : best), pts[0]);
    const w = V3.norm(V3.sub(up, c));
    const u = V3.norm(V3.cross(n, w));
    const flat = pts.map((p) => [V3.dot(V3.sub(p, c), u), -V3.dot(V3.sub(p, c), w)]);
    const rmax = Math.max(...flat.map(([x, y]) => Math.hypot(x, y)));
    const clip = "polygon(" + flat.map(([x, y]) => `${(50 + (x / rmax) * 49).toFixed(2)}% ${(50 + (y / rmax) * 49).toFixed(2)}%`).join(", ") + ")";
    const k = rmax / (size * 0.49); // model px per element px, so the outline spans the element
    const place = `matrix3d(${fmt([u[0] * k, u[1] * k, u[2] * k, 0, -w[0] * k, -w[1] * k, -w[2] * k, 0, n[0], n[1], n[2], 0, c[0], c[1], c[2], 1])})`;
    const land = `matrix3d(${fmt([u[0], -w[0], n[0], 0, u[1], -w[1], n[1], 0, u[2], -w[2], n[2], 0, 0, 0, 0, 1])})`;
    return { clip, place, land, n };
  });
  DIE_CACHE[key] = faces;
  return faces;
}

function Die3D({ sides, final, delay, size = 68 }) {
  const faces = buildDie(sides, size);
  const targetIdx = (final - 1) % faces.length;
  const target = faces[targetIdx];
  const fontK = { 4: 0.26, 6: 0.4, 8: 0.3, 10: 0.26, 12: 0.3, 20: 0.22 }[sides] || 0.3;
  // the rolled face lands flat to the camera, so its number can run much larger
  const bigK = { 4: 0.32, 6: 0.5, 8: 0.4, 10: 0.36, 12: 0.4, 20: 0.33 }[sides] || 0.4;
  const dur = (1.15 + delay / 1000).toFixed(2);
  const tumble = (final + sides) % 2 ? "diceTumbleA" : "diceTumbleB";
  // no spoilers: every face looks identical until the tumble ends, THEN the rolled
  // number swells and the grazing faces' numbers fade
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    setLanded(false);
    const t = setTimeout(() => setLanded(true), 1200 + 2 * delay);
    return () => clearTimeout(t);
  }, [sides, final, delay]);
  return (
    // the drop-shadow lives outside the 3D chain: `filter` is a grouping property that
    // would force transform-style back to flat and crush the polyhedron
    <div style={{ filter: "drop-shadow(0 10px 12px #00000073)", animation: `diceDrop 1.3s cubic-bezier(.22,1.6,.36,1) ${delay}ms both` }}>
      <div style={{ width: size, height: size, perspective: 700 }}>
        <div style={{ width: size, height: size, transformStyle: "preserve-3d", animation: `${tumble} ${dur}s cubic-bezier(.18,.8,.24,1.02) ${delay}ms both` }}>
          <div style={{ width: size, height: size, position: "relative", transformStyle: "preserve-3d", transform: target.land }}>
          {faces.map((f, i) => {
            // numbers on faces tilted away from the landing face fade out, so grazing
            // faces read as metal edges instead of ink smears
            const tilt = Math.max(0, V3.dot(target.n, f.n));
            return (
              // clip-path lives on a child, not the 3D-transformed element itself —
              // Chromium misculls clipped faces at steep angles (black wedge artifacts)
              <div key={i} style={{ position: "absolute", inset: 0, transform: f.place, backfaceVisibility: "hidden" }}>
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  clipPath: f.clip, background: `linear-gradient(${135 + (i % 5) * 22}deg, #e0bd66, #a8842f)`,
                  color: "#241a10", fontWeight: 800, fontFamily: "Georgia, serif",
                  fontSize: size * (landed && i === targetIdx ? bigK : fontK), transition: "font-size 250ms ease",
                }}>
                  <span style={{ opacity: landed ? 0.15 + 0.85 * tilt * tilt : 1, transition: "opacity 350ms ease", ...(sides === 4 ? { marginTop: size * 0.14 } : {}) }}>
                    {i + 1}{sides >= 10 && (i + 1 === 6 || i + 1 === 9) ? "." : ""}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}

const Die = ({ sides, final, delay, size = 68 }) => <Die3D sides={sides} final={final} delay={delay} size={size} />;

function DiceTray({ title, dice, dropLowest, onAccept, onReroll, acceptLabel = "Accept", note, tally, rollId = 0, bonus = 0, bonusLabel = "" }) {
  // dice: [{sides, value}] — values pre-rolled; tray animates the reveal
  const [revealDone, setRevealDone] = useState(false);
  useEffect(() => {
    setRevealDone(false);
    const t = setTimeout(() => setRevealDone(true), 1300 + dice.length * 150);
    return () => clearTimeout(t);
  }, [dice]);
  const values = dice.map((d) => d.value);
  const lowIdx = dropLowest ? values.indexOf(Math.min(...values)) : -1;
  const total = values.reduce((s, v, i) => s + (i === lowIdx ? 0 : v), 0) + bonus;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ ...card, padding: 28, textAlign: "center", minWidth: 320, maxWidth: "92vw" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold, marginBottom: 6 }}>{title}</div>
        {note && <div style={{ color: T.dim, fontSize: 13, marginBottom: 10 }}>{note}</div>}
        {tally && tally.length > 0 && (
          <div style={{ color: T.dim, fontSize: 13 }}>Kept so far: <span style={{ color: T.gold, fontWeight: 700 }}>{tally.join(" · ")}</span></div>
        )}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", padding: "18px 0" }}>
          {dice.map((d, i) => (
            // key includes rollId so a fresh batch remounts the dice and re-tumbles
            <div key={`${rollId}-${i}`} style={{ opacity: revealDone && i === lowIdx ? 0.3 : 1, transition: "opacity 400ms", position: "relative" }}>
              <Die sides={d.sides} final={d.value} delay={i * 150} />
              {revealDone && i === lowIdx && <div style={{ position: "absolute", top: -10, right: -6, color: T.blood, fontSize: 11, fontWeight: 700 }}>dropped</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 34, fontFamily: "Georgia, serif", color: revealDone ? T.ink : T.dim, minHeight: 44, transition: "color 300ms" }}>
          {revealDone ? total : "…"}
        </div>
        {revealDone && bonus !== 0 && <div style={{ color: T.dim, fontSize: 13 }}>{values.join(" + ")} {fmtMod(bonus)}{bonusLabel ? ` ${bonusLabel}` : ""}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
          {onReroll && <button style={btn(false)} onClick={onReroll}>Roll Again</button>}
          <button style={{ ...btn(true), opacity: revealDone ? 1 : 0.4 }} disabled={!revealDone} onClick={() => onAccept(total, values)}>{acceptLabel}</button>
        </div>
      </div>
    </div>
  );
}
const roll = (sides) => 1 + Math.floor(Math.random() * sides);

/* ============ D20 ROLL ENGINE ============ */
/* Static features that bend d20 rolls, computed from the character */
function rollFeatures(ch) {
  const lvl = totalLevel(ch);
  const pb = profBonus(lvl);
  const clsLv = (name) => classLevel(ch, name);
  const champLvl = ch.classes.find((c) => baseSubName(c.subclass || "") === "Champion")?.level || 0;
  return {
    pb,
    lucky: ch.race === "Lightfoot Halfling",
    jack: clsLv("Bard") >= 2 ? Math.floor(pb / 2) : 0,                       // Jack of All Trades
    athlete: champLvl >= 7 ? Math.ceil(pb / 2) : 0,                          // Remarkable Athlete (Str/Dex/Con)
    reliable: clsLv("Rogue") >= 11,                                          // Reliable Talent
    aura: clsLv("Paladin") >= 6 ? Math.max(1, mod(ch.abilities.cha)) : 0,    // Aura of Protection
    diamondSoul: clsLv("Monk") >= 14,                                        // proficiency in all saves
    slipperyMind: clsLv("Rogue") >= 15,                                      // WIS save proficiency
    critRange: champLvl >= 15 ? 18 : champLvl >= 3 ? 19 : 20,                // Improved/Superior Critical
    archery: (ch.styles || []).includes("Archery") ? 2 : 0,
    barbarian: clsLv("Barbarian"),
    savageAttacks: ch.race === "Half-Orc",
  };
}

/* Situational reminders the dice can't decide for you */
function rollNotes(ch, kind, abil) {
  const f = rollFeatures(ch);
  const n = [];
  if (kind === "save") {
    if (ch.race === "Hill Dwarf" && abil === "con") n.push("Dwarven Resilience: advantage vs. poison");
    if (ch.race === "Lightfoot Halfling" && abil === "wis") n.push("Brave: advantage vs. being frightened");
    if (ch.race === "Rock Gnome" && ["int", "wis", "cha"].includes(abil)) n.push("Gnome Cunning: advantage vs. magic");
    if (f.barbarian >= 1 && abil === "str" && !hasEffect(ch, "rage")) n.push("Rage: advantage on Strength saves while raging");
    if (f.barbarian >= 2 && abil === "dex") n.push("Danger Sense: advantage vs. effects you can see");
  }
  if (kind === "check" || kind === "skill") {
    if (f.barbarian >= 1 && abil === "str" && !hasEffect(ch, "rage")) n.push("Rage: advantage on Strength checks while raging");
  }
  if (kind === "attack") {
    if (f.barbarian >= 2 && abil === "str" && !hasEffect(ch, "reckless-attack")) n.push("Reckless Attack: take advantage now, grant it until your next turn");
    if (f.savageAttacks) n.push("Savage Attacks: one extra damage die on a melee crit");
  }
  const fx = fxMods(ch);
  /* Effect notes are plain strings, or { t, abil } scoped to the ability being rolled */
  (fx.notes[kind === "skill" ? "check" : kind] || []).forEach((note) => {
    if (typeof note === "string") n.push(note);
    else if (!note.abil || !abil || [].concat(note.abil).includes(abil)) n.push(note.t);
  });
  return n;
}

function RollTray({ title, mode, parts, kind, abil, proficient, ch, onClose }) {
  const f = rollFeatures(ch);
  // roll once, in the state initializer — re-renders must not re-throw the bones
  const [res] = useState(() => {
    const dice = [{ v: roll(20) }];
    if (mode !== "normal") dice.push({ v: roll(20) });
    const notes = [];
    if (f.lucky) dice.forEach((d) => { if (d.v === 1) { const nv = roll(20); notes.push(`Lucky: rerolled the natural 1 → ${nv}`); d.v = nv; } });
    let kept = 0;
    if (dice.length === 2) kept = mode === "adv" ? (dice[0].v >= dice[1].v ? 0 : 1) : (dice[0].v <= dice[1].v ? 0 : 1);
    let die = dice[kept].v, floored = false;
    if (kind === "skill" && proficient && f.reliable && die < 10) { floored = true; notes.push(`Reliable Talent: treated the ${die} as a 10`); die = 10; }
    return { dice, kept, die, floored, notes };
  });
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1350 + res.dice.length * 150);
    return () => clearTimeout(t);
  }, [res]);
  const modTotal = parts.reduce((s, p) => s + p.value, 0);
  const total = res.die + modTotal;
  const nat = res.dice[res.kept].v;
  const crit = kind === "attack" && nat >= f.critRange;
  const fumble = nat === 1 && !res.floored;
  const notes = [...res.notes, ...rollNotes(ch, kind, abil)];
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={onClose}>
      <div style={{ ...card, padding: 28, textAlign: "center", minWidth: 320, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold }}>{title}</div>
        {mode !== "normal" && <div style={{ color: mode === "adv" ? T.green : T.blood, fontSize: 13, marginTop: 2 }}>{mode === "adv" ? "Advantage — keep the higher" : "Disadvantage — keep the lower"}</div>}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", padding: "18px 0" }}>
          {res.dice.map((d, i) => (
            <div key={i} style={{ opacity: done && i !== res.kept ? 0.3 : 1, transition: "opacity 400ms", position: "relative" }}>
              <Die sides={20} final={d.v} delay={i * 150} size={res.dice.length > 1 ? 104 : 128} />
              {done && i !== res.kept && <div style={{ position: "absolute", top: -10, right: -6, color: T.blood, fontSize: 11, fontWeight: 700 }}>dropped</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 34, fontFamily: "Georgia, serif", color: done ? (crit ? T.gold : fumble ? T.blood : T.ink) : T.dim, minHeight: 44, transition: "color 300ms" }}>
          {done ? total : "…"}
        </div>
        {done && (
          <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>
            d20 {res.floored ? `${nat}→10` : nat}{parts.filter((p) => p.value).map((p) => ` ${fmtMod(p.value)} ${p.label}`).join("")}
          </div>
        )}
        {done && crit && <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginTop: 6 }}><Icon name="sword" /> CRITICAL HIT{f.critRange < 20 ? ` (crits on ${f.critRange}–20)` : ""}!</div>}
        {done && !crit && nat === 20 && <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15, marginTop: 6 }}>Natural 20</div>}
        {done && fumble && <div style={{ color: T.blood, fontFamily: "Georgia, serif", fontSize: 15, marginTop: 6 }}>Natural 1 — the bones are cruel</div>}
        {done && notes.length > 0 && (
          <div style={{ color: "#b48ead", fontSize: 12, marginTop: 8, lineHeight: 1.7 }}>
            {notes.map((x, i) => <div key={i}>{x}</div>)}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <button style={{ ...btn(true), opacity: done ? 1 : 0.4 }} disabled={!done} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ============ FEATURE CHOICE GROUPS ============ */
/* Some subclass options ride in the compendium as pseudo-spells (maneuvers, elemental
   disciplines, arcane shots, trick shots) — tagged for a non-casting class, they're
   techniques, not spells, and must stay out of real spell pickers. */
const CASTING_CLASSES = new Set(["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard", "Artificer"]);
const isTechnique = (sp) => !(sp.classes || "").split(",").some((e) => {
  const m = e.trim().match(/^(.+?)(?:\s*\(([^)]*)\))?$/);
  return m && CASTING_CLASSES.has(m[1].trim()) && (m[2] || "").trim().toLowerCase() !== "no spells";
});

const KENSEI_WEAPONS = ["Battleaxe", "Club", "Dagger", "Flail", "Glaive", "Greataxe", "Greatclub", "Greatsword", "Halberd", "Handaxe", "Javelin", "Light Hammer", "Longbow", "Longsword", "Mace", "Maul", "Morningstar", "Pike", "Quarterstaff", "Rapier", "Scimitar", "Shortbow", "Shortsword", "Sickle", "Spear", "Trident", "War Pick", "Warhammer", "Whip"];

/* Choice-granting features: what you pick, where the options live, and how many you
   hold at each class level (cumulative — missed picks are offered as catch-up). */
const CHOICE_GROUPS = [
  { key: "Maneuvers", cls: "Fighter", sub: "Battle Master", source: { spellTag: true }, counts: { 3: 3, 7: 2, 10: 2, 15: 2 } },
  { key: "Arcane Shot Options", cls: "Fighter", sub: "Arcane Archer", source: { spellTag: true }, counts: { 3: 2, 7: 1, 10: 1, 15: 1, 18: 1 } },
  { key: "Trick Shots", cls: "Fighter", sub: "Gunslinger", source: { spellTag: true }, counts: { 3: 2, 7: 1, 10: 1, 15: 1, 18: 1 } },
  { key: "Runes", cls: "Fighter", sub: "Rune Knight", source: { featurePrefix: "Rune" }, counts: { 3: 2, 7: 1, 10: 1, 15: 1 } },
  { key: "Elemental Disciplines", cls: "Monk", sub: "Way of the Four Elements", source: { spellTag: true }, counts: { 3: 1, 6: 1, 11: 1, 17: 1 }, grant: { 3: ["Elemental Attunement"] } },
  { key: "Kensei Weapons", cls: "Monk", sub: "Way of the Kensei", source: { list: KENSEI_WEAPONS }, counts: { 3: 2, 6: 1, 11: 1, 17: 1 } },
  { key: "Totem Spirit", cls: "Barbarian", sub: "Path of the Totem Warrior", source: { featurePrefix: "Totem Spirit" }, counts: { 3: 1 } },
  { key: "Aspect of the Beast", cls: "Barbarian", sub: "Path of the Totem Warrior", source: { featurePrefix: "Aspect of the Beast" }, counts: { 6: 1 } },
  { key: "Totemic Attunement", cls: "Barbarian", sub: "Path of the Totem Warrior", source: { featurePrefix: "Totemic Attunement" }, counts: { 14: 1 } },
  { key: "Storm Aura", cls: "Barbarian", sub: "Path of the Storm Herald", source: { list: ["Storm Aura: Desert", "Storm Aura: Sea", "Storm Aura: Tundra"] }, counts: { 3: 1 } },
  { key: "Hunter's Prey", cls: "Ranger", sub: "Hunter", source: { featurePrefix: "Hunter's Prey" }, counts: { 3: 1 } },
  { key: "Defensive Tactics", cls: "Ranger", sub: "Hunter", source: { featurePrefix: "Defensive Tactics" }, counts: { 7: 1 } },
  { key: "Multiattack Option", cls: "Ranger", sub: "Hunter", source: { featurePrefix: "Multiattack" }, counts: { 11: 1 } },
  { key: "Superior Hunter's Defense", cls: "Ranger", sub: "Hunter", source: { featurePrefix: "Superior Hunter's Defense" }, counts: { 15: 1 } },
  { key: "Dragon Ancestor", cls: "Sorcerer", sub: "Draconic Bloodline", source: { featureSuffix: "Dragon Ancestor" }, counts: { 1: 1 } },
];
const CHOICE_KEYS = new Set(CHOICE_GROUPS.map((g) => g.key));

const choiceCum = (g, level) => Object.entries(g.counts).reduce((s, [l, n]) => s + (level >= +l ? n : 0), 0);
const groupMatches = (g, clsName, subclass) => g.cls === clsName && (!g.sub || (subclass && subTokens(subclass).includes(normSub(g.sub))));
function choiceOptionsFor(g, customs) {
  if (g.source.list) return g.source.list.map((n) => ({ name: n }));
  if (g.source.spellTag) {
    return (customs?.spells || []).filter((sp) => isTechnique(sp) && spellFitsClass(sp, g.cls, g.sub))
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
/* All groups relevant to a character, with current holdings and caps */
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

/* ============ GEAR: types, sources, armor class ============ */
const ITEM_TYPES = { LA: "Light armor", MA: "Medium armor", HA: "Heavy armor", S: "Shield", M: "Melee weapon", R: "Ranged weapon", A: "Ammunition", G: "Adventuring gear", W: "Wondrous item", P: "Potion", RG: "Ring", WD: "Wand", ST: "Staff", SC: "Scroll", RD: "Rod", "$": "Currency" };
const DMG_TYPES = { S: "slashing", P: "piercing", B: "bludgeoning", R: "radiant", N: "necrotic", F: "fire", C: "cold", L: "lightning", T: "thunder", A: "acid", PS: "poison", PSY: "psychic", FC: "force" };
const WEAPON_PROPS = { A: "ammunition", F: "finesse", H: "heavy", L: "light", LD: "loading", R: "reach", S: "special", T: "thrown", "2H": "two-handed", V: "versatile", M: "martial" };
const SOURCE_ABBR = [
  ["Player's Handbook", "PHB"], ["Xanathar's Guide", "XGtE"], ["Sword Coast Adventurer's Guide", "SCAG"], ["Tasha's Cauldron", "TCoE"],
  ["Dungeon Master's Guide", "DMG"], ["Monster Manual", "MM"], ["Volo's Guide", "VGtM"], ["Mordenkainen's Tome", "MToF"],
  ["Elemental Evil", "EEPC"], ["Guildmasters' Guide", "GGtR"], ["Eberron", "ERLW"], ["Explorer's Guide to Wildemount", "EGtW"],
  ["Acquisitions Incorporated", "AI"], ["Curse of Strahd", "CoS"], ["Princes of the Apocalypse", "PotA"], ["Unearthed Arcana", "UA"], ["Wayfinder's Guide", "WGtE"],
];
/* Pull "Source: Player's Handbook, p. 73" out of stored rules text, abbreviated */
function sourceOf(text) {
  const m = (text || "").match(/Source:\s*([^\n]+)/);
  if (!m) return null;
  const first = m[1].split(/[;·]/)[0].trim();
  for (const [long, abbr] of SOURCE_ABBR) if (first.includes(long)) { const p = first.match(/p\.?\s*(\d+)/); return abbr + (p ? ` p.${p[1]}` : ""); }
  return first.length > 28 ? first.slice(0, 28) + "…" : first;
}
const findItem = (name, customs) => (customs?.items || []).find((x) => x.name === name);
const isArmorType = (t) => ["LA", "MA", "HA"].includes(t);
const isWeaponType = (t) => ["M", "R"].includes(t);
const equippedOf = (ch) => (ch.inventory || []).filter((r) => r.equipped);

/* ---- who may wield what: structured armor & weapon proficiencies ---- */
/* First class grants its full training; classes added by multiclassing grant the reduced multiclass set. */
const CLASS_GEAR_PROFS = {
  Barbarian: { armor: ["LA", "MA", "S"], weapons: { martial: true } },
  Bard: { armor: ["LA"], weapons: { simple: true, named: ["Hand Crossbow", "Longsword", "Rapier", "Shortsword"] } },
  Cleric: { armor: ["LA", "MA", "S"], weapons: { simple: true } },
  Druid: { armor: ["LA", "MA", "S"], weapons: { named: ["Club", "Dagger", "Dart", "Javelin", "Mace", "Quarterstaff", "Scimitar", "Sickle", "Sling", "Spear"] } },
  Fighter: { armor: ["LA", "MA", "HA", "S"], weapons: { martial: true } },
  Monk: { armor: [], weapons: { simple: true, named: ["Shortsword"] } },
  Paladin: { armor: ["LA", "MA", "HA", "S"], weapons: { martial: true } },
  Ranger: { armor: ["LA", "MA", "S"], weapons: { martial: true } },
  Rogue: { armor: ["LA"], weapons: { simple: true, named: ["Hand Crossbow", "Longsword", "Rapier", "Shortsword"] } },
  Sorcerer: { armor: [], weapons: { named: ["Dagger", "Dart", "Sling", "Quarterstaff", "Light Crossbow"] } },
  Warlock: { armor: ["LA"], weapons: { simple: true } },
  Wizard: { armor: [], weapons: { named: ["Dagger", "Dart", "Sling", "Quarterstaff", "Light Crossbow"] } },
};
const MC_GEAR_PROFS = {
  Barbarian: { armor: ["S"], weapons: { martial: true } },
  Bard: { armor: ["LA"], weapons: {} },
  Cleric: { armor: ["LA", "MA", "S"], weapons: {} },
  Druid: { armor: ["LA", "MA", "S"], weapons: {} },
  Fighter: { armor: ["LA", "MA", "S"], weapons: { martial: true } },
  Monk: { armor: [], weapons: { simple: true, named: ["Shortsword"] } },
  Paladin: { armor: ["LA", "MA", "S"], weapons: { martial: true } },
  Ranger: { armor: ["LA", "MA", "S"], weapons: { martial: true } },
  Rogue: { armor: ["LA"], weapons: {} },
  Sorcerer: { armor: [], weapons: {} },
  Warlock: { armor: ["LA"], weapons: { simple: true } },
  Wizard: { armor: [], weapons: {} },
};
const isMartial = (it) => (it.property || "").split(",").map((x) => x.trim()).includes("M");
const nameMatchesAny = (itemName, names) => {
  const hay = itemName.toLowerCase();
  return names.some((n) => n.toLowerCase().split(/[\s,]+/).every((w) => hay.includes(w)));
};
/* Can this character legitimately equip this item, per their training? */
function canEquip(item, ch) {
  if (!item) return true; // freeform items: the player's call
  const profs = ch.classes.map((c, i) => (i === 0 ? CLASS_GEAR_PROFS[c.name] : MC_GEAR_PROFS[c.name])).filter(Boolean);
  if (isArmorType(item.type) || item.type === "S") {
    const want = item.type === "S" ? "S" : item.type;
    return profs.some((p) => p.armor.includes(want));
  }
  if (isWeaponType(item.type)) {
    return profs.some((p) => {
      const w = p.weapons || {};
      if (w.martial) return true; // martial training includes simple weapons
      if (w.simple && !isMartial(item)) return true;
      return w.named ? nameMatchesAny(item.name, w.named) : false;
    });
  }
  return true;
}

/* The armor and shield actually on the character's body right now */
function equippedGear(ch, customs) {
  const inv = equippedOf(ch).map((r) => findItem(r.name, customs)).filter(Boolean);
  return { armor: inv.find((x) => isArmorType(x.type)), shield: inv.find((x) => x.type === "S") };
}

/* Armor Class from equipped gear + class features + active effects, with a readable breakdown */
function armorClass(ch, customs, fx = fxMods(ch)) {
  const dex = mod(ch.abilities.dex);
  const { armor, shield } = equippedGear(ch, customs);
  const parts = [];
  let ac;
  if (armor) {
    if (armor.type === "HA") { ac = armor.ac; parts.push(`${armor.name} ${armor.ac}`); }
    else if (armor.type === "MA") { ac = armor.ac + Math.min(2, dex); parts.push(`${armor.name} ${armor.ac}`, `Dex ${fmtMod(Math.min(2, dex))} (max +2)`); }
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
  if (!armor && fx.acBase && fx.acBase.value + dex > ac) { ac = fx.acBase.value + dex; parts.splice(0, parts.length, `${fx.acBase.label} ${fx.acBase.value}`, `Dex ${fmtMod(dex)}`); }
  if (shield) { ac += shield.ac || 2; parts.push(`${shield.name} +${shield.ac || 2}`); }
  if (armor && (ch.styles || []).includes("Defense")) { ac += 1; parts.push("Defense style +1"); }
  fx.ac.forEach((b) => { ac += b.value; parts.push(`${b.label} ${fmtMod(b.value)}`); });
  if (fx.acFloor && ac < fx.acFloor.value) { ac = fx.acFloor.value; parts.push(`${fx.acFloor.label} (AC can't drop below ${fx.acFloor.value})`); }
  return { ac, parts, armor, shield };
}

/* ============ ACTIVE EFFECTS — buffs, boons, curses, and the state of being on fire ============ */
/* Every trackable spell, feature, feat toggle, and condition. Mechanics the sheet can compute
   are structured (AC, speed, max HP, attack/save/damage bonuses); everything the dice can't
   decide for you becomes a reminder note on the relevant roll.
   mods(val, ch, inst) → { ac:[{label,value}], acBase:{label,value}, acFloor:{label,value}, maxHp,
   halveMaxHp, speedAdd:[{label,value}], speedMult, speedZero, atk/dmg:[{label,value,scope,abil?,prop?}],
   save:[{label,value}], shillelagh, notes:{attack,save,check,dmg} } — scope: "melee" | "ranged" |
   "weapon" | "spell" | "all"; notes entries are strings or { t, abil } scoped to the rolled ability */
const classLevel = (ch, name) => ch.classes.find((c) => c.name === name)?.level || 0;
const hasSub = (ch, name) => ch.classes.some((c) => c.subclass && subTokens(c.subclass).includes(normSub(name)));
const hasFeat = (ch, name) => (ch.feats || []).includes(name);
/* Imported ledgers aren't validated field-by-field — never trust ch.effects to be an array */
const effectsOf = (ch) => (Array.isArray(ch.effects) ? ch.effects : []);
/* Spells the character can actually cast: their picks plus always-prepared subclass grants */
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

const EFFECT_LIB = [
  /* ---- Spells: the caster's wardrobe ---- */
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
  E("Spell", "Shillelagh", { dur: "1 minute", ends: "short", brief: "Your club or quarterstaff attacks use Wisdom and deal 1d8 damage", mods: () => ({ shillelagh: true }) }),
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

  /* ---- Class features & actions in play ---- */
  E("Feature", "Rage", { dur: "1 minute (keep attacking or taking damage to sustain it)", ends: "short", brief: "Resistance to bludgeoning/piercing/slashing; bonus damage on Str melee hits; advantage on Str checks & saves; no spellcasting or concentration", mine: (ch) => classLevel(ch, "Barbarian") >= 1,
    mods: (v, ch) => { const l = classLevel(ch, "Barbarian"); const b = l >= 16 ? 4 : l >= 9 ? 3 : 2; return { dmg: [{ label: "Rage", value: b, scope: "melee", abil: "str" }], notes: { save: [{ t: "Rage: advantage on Strength saves · resistance to bludgeoning, piercing, slashing", abil: "str" }], check: [{ t: "Rage: advantage on Strength checks", abil: "str" }], attack: [{ t: `Rage: +${b} damage on Strength-based melee hits`, abil: "str" }] } }; } }),
  E("Feature", "Reckless Attack", { dur: "until your next turn", ends: "short", brief: "Advantage on Strength melee attacks this turn — and every attack against you has advantage too", mine: (ch) => classLevel(ch, "Barbarian") >= 2, mods: () => ({ notes: { attack: [{ t: "Reckless Attack: advantage on Strength-based melee attacks; enemies have advantage against you", abil: "str" }] } }) }),
  E("Feature", "Frenzy", { dur: "while raging", ends: "short", brief: "Bonus-action melee attack each turn; one level of exhaustion when the rage ends", mine: (ch) => hasSub(ch, "Path of the Berserker") }),
  E("Feature", "Wild Shape", { dur: "up to half your druid level in hours", ends: "short", brief: "You are the beast: use its physical stats and HP, keep your Int/Wis/Cha, saves, and skill proficiencies; at 0 beast HP you revert and excess damage carries over", desc: "Track the beast's hit points in the Temp HP counter if you like — when the form's pool empties, remove this effect and take any leftover damage on your true body.", mine: (ch) => classLevel(ch, "Druid") >= 2 }),
  E("Feature", "Bardic Inspiration (received)", { dur: "10 minutes or until spent", ends: "short", brief: "Add the inspiration die to one attack roll, ability check, or saving throw — after you see the d20", mods: () => ({ notes: { attack: ["Bardic Inspiration: you may add the die after seeing the roll"], save: ["Bardic Inspiration: you may add the die after seeing the roll"], check: ["Bardic Inspiration: you may add the die after seeing the roll"] } }) }),
  E("Feature", "Sacred Weapon", { dur: "1 minute", ends: "short", brief: "Add your Charisma modifier to attack rolls with the blessed weapon (shown on every weapon — honor it on the blessed one); it sheds bright light", mine: (ch) => hasSub(ch, "Oath of Devotion"), mods: (v, ch) => ({ atk: [{ label: "Sacred Weapon", value: Math.max(1, mod(ch.abilities.cha)), scope: "weapon" }] }) }),
  E("Feature", "Empty Body", { dur: "1 minute", ends: "short", brief: "Invisible, and resistant to all damage except force", mine: (ch) => classLevel(ch, "Monk") >= 18, mods: () => ({ notes: { attack: ["Empty Body: your attack rolls have advantage (invisible)"] } }) }),
  E("Action", "Dodge", { dur: "until the start of your next turn", ends: "short", brief: "Attackers you can see have disadvantage; you have advantage on Dexterity saves", mods: () => ({ notes: { save: [{ t: "Dodge: advantage on Dexterity saves", abil: "dex" }] } }) }),
  E("Action", "Patient Defense", { dur: "until the start of your next turn", ends: "short", brief: "Dodge as a bonus action (1 ki): attackers have disadvantage; advantage on Dex saves", mine: (ch) => classLevel(ch, "Monk") >= 2, mods: () => ({ notes: { save: [{ t: "Patient Defense: advantage on Dexterity saves", abil: "dex" }] } }) }),
  E("Action", "Help (received)", { dur: "your next roll", ends: "short", brief: "Advantage on your next ability check, or on your first attack against the distracted target", mods: () => ({ notes: { attack: ["Help: advantage on your first attack against the target"], check: ["Help: advantage on the assisted check"] } }) }),
  E("Action", "Hidden", { dur: "until you're found, move into view, or attack", ends: "short", brief: "Attack with advantage from hiding — attacking reveals you", mods: () => ({ notes: { attack: ["Hidden: attack with advantage — and give away your position"] } }) }),

  /* ---- Feat toggles (SRD sheets import these from the compendium) ---- */
  E("Feat", "Great Weapon Master", { dur: "declared before each attack", ends: "short", brief: "Take −5 to hit with a heavy melee weapon for +10 damage", mine: (ch) => hasFeat(ch, "Great Weapon Master"), mods: () => ({ atk: [{ label: "Great Weapon Master", value: -5, scope: "melee", prop: "H" }], dmg: [{ label: "Great Weapon Master", value: 10, scope: "melee", prop: "H" }] }) }),
  E("Feat", "Sharpshooter", { dur: "declared before each attack", ends: "short", brief: "Take −5 to hit with a ranged weapon for +10 damage; ignore cover and long range", mine: (ch) => hasFeat(ch, "Sharpshooter"), mods: () => ({ atk: [{ label: "Sharpshooter", value: -5, scope: "ranged" }], dmg: [{ label: "Sharpshooter", value: 10, scope: "ranged" }] }) }),
  E("Feat", "Defensive Duelist", { dur: "until the start of your next turn", ends: "short", brief: "Reaction while wielding a finesse weapon: add your proficiency bonus to AC against one melee hit", mine: (ch) => hasFeat(ch, "Defensive Duelist"), mods: (v, ch) => ({ ac: [{ label: "Defensive Duelist", value: profBonus(totalLevel(ch)) }] }) }),

  /* ---- Conditions: the 5e catalogue of misery ---- */
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
/* A concentration-flagged effect an ally cast on you (inst.ally) doesn't hold YOUR concentration */
const isConcDef = (e) => (e.key === "custom" ? !!e.conc : !!effDefOf(e)?.conc);
const isConcInst = (e) => !e.ally && isConcDef(e);
const effEnds = (e) => (e.key === "custom" ? e.ends || "manual" : effDefOf(e)?.ends || "manual");
/* How much max HP an effect instance grants — needed again when it ends (5e: current HP
   only drops to the new maximum, so the grant is refunded from recorded damage) */
const instMaxHp = (e, ch) => {
  if (e.key === "custom") return (e.mods || {}).maxHp || 0;
  const def = effDefOf(e);
  return (def?.mods ? def.mods(e.val, ch, e).maxHp : 0) || 0;
};

/* One readable line for a custom effect's numbers */
const describeCustomFx = (m) => [m.ac && `AC ${fmtMod(m.ac)}`, m.atk && `attacks ${fmtMod(m.atk)}`, m.save && `saves ${fmtMod(m.save)}`, m.dmg && `weapon damage ${fmtMod(m.dmg)}`, m.speed && `speed ${fmtMod(m.speed)} ft`, m.maxHp && `max HP ${fmtMod(m.maxHp)}`].filter(Boolean).join(" · ");

/* Aggregate every active effect into the numbers and reminders the sheet consumes */
function fxMods(ch) {
  const out = { ac: [], acBase: null, acFloor: null, maxHp: 0, halveMaxHp: false, speedAdd: [], speedMult: 1, speedZero: false, atk: [], save: [], dmg: [], shillelagh: false, conc: [], notes: { attack: [], save: [], check: [], dmg: [] } };
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
    if (m.shillelagh) out.shillelagh = true;
    if (m.notes) for (const k of ["attack", "save", "check", "dmg"]) if (m.notes[k]) out.notes[k].push(...m.notes[k]);
  }
  return out;
}

/* Effective max HP: base + effect increases, halved by deep exhaustion */
function effMaxHp(ch, fx = fxMods(ch)) {
  const t = ch.maxHp + fx.maxHp;
  return Math.max(1, fx.halveMaxHp ? Math.floor(t / 2) : t);
}

/* Speed was never derived before effects needed to bend it; now it earns a breakdown */
function speedOf(ch, customs, fx = fxMods(ch)) {
  let v = RACES[ch.race].speed;
  const parts = [`base ${v}`];
  const { armor, shield } = equippedGear(ch, customs);
  const monk = classLevel(ch, "Monk"), barb = classLevel(ch, "Barbarian");
  if (monk >= 2 && !armor && !shield) { const b = monk >= 18 ? 30 : monk >= 14 ? 25 : monk >= 10 ? 20 : monk >= 6 ? 15 : 10; v += b; parts.push(`Unarmored Movement +${b}`); }
  if (barb >= 5 && (!armor || armor.type !== "HA")) { v += 10; parts.push("Fast Movement +10"); }
  fx.speedAdd.forEach((s) => { v += s.value; parts.push(`${s.label} ${fmtMod(s.value)}`); });
  if (fx.speedMult !== 1) { v = Math.floor(v * fx.speedMult); parts.push(fx.speedMult > 1 ? `×${fx.speedMult}` : "halved"); }
  if (fx.speedZero) { v = 0; parts.push("held at 0"); }
  return { v: Math.max(0, v), parts, modified: parts.length > 1 };
}

/* ============ LORE LIBRARY (long-press anything to read it) ============ */
const LANG_INFO = {
  Common: "The trade tongue of humans, spoken nearly everywhere. Script: Common.",
  Dwarvish: "Full of hard consonants and guttural sounds. Typical speakers: dwarves. Script: Dwarvish.",
  Elvish: "Fluid, with subtle intonations and intricate grammar. Typical speakers: elves. Script: Elvish.",
  Giant: "The slow, booming tongue of ogres and giants. Script: Dwarvish.",
  Gnomish: "Renowned for technical treatises and catalogs of knowledge. Typical speakers: gnomes. Script: Dwarvish.",
  Goblin: "The language of goblinoids — goblins, hobgoblins, and bugbears. Script: Dwarvish.",
  Halfling: "Quiet and homey; halflings rarely share it with outsiders. Script: Common.",
  Orc: "Harsh and grating. Typical speakers: orcs. Script: Dwarvish.",
  Abyssal: "The twisting language of demons. Script: Infernal.",
  Celestial: "The language of celestials, brought by angels. Script: Celestial.",
  "Deep Speech": "The alien tongue of aboleths and mind flayers. It has no script.",
  Draconic: "The ancient language of dragons and dragonborn, common in arcane writings. Script: Draconic.",
  Infernal: "The rigid, hierarchical language of devils. Script: Infernal.",
  Primordial: "The elemental tongue; its dialects (Aquan, Auran, Ignan, Terran) are mutually intelligible. Script: Dwarvish.",
  Sylvan: "The flowing language of the fey. Script: Elvish.",
  Undercommon: "The trade language of the Underdark. Script: Elvish.",
};
const SKILL_INFO = {
  Acrobatics: "Stay on your feet in tricky situations — balancing on ice, deck of a pitching ship, or tumbling through a fall.",
  "Animal Handling": "Calm a spooked animal, intuit a beast's intentions, or control your mount in a risky maneuver.",
  Arcana: "Recall lore about spells, magic items, eldritch symbols, magical traditions, and the planes.",
  Athletics: "Climb a cliff, leap a chasm, swim rough waters, or win a grapple.",
  Deception: "Convincingly hide the truth — mislead, con, fast-talk, or keep a straight face.",
  History: "Recall lore about historical events, legendary people, ancient kingdoms, wars, and lost civilizations.",
  Insight: "Read intentions and body language — detect lies, predict someone's next move.",
  Intimidation: "Influence through threats, hostile posture, and raw menace.",
  Investigation: "Look for clues and make deductions — find the hidden mechanism, appraise the forgery, locate the weak point.",
  Medicine: "Stabilize the dying or diagnose an illness.",
  Nature: "Recall lore about terrain, plants and animals, weather, and natural cycles.",
  Perception: "Spot, hear, or otherwise notice something — the ambush in the trees, the eavesdropper at the door.",
  Performance: "Delight an audience with music, dance, acting, or storytelling.",
  Persuasion: "Influence with tact, social grace, and good faith — negotiate, mediate, inspire.",
  Religion: "Recall lore about deities, rites, holy symbols, and the practices of cults.",
  "Sleight of Hand": "Palm a coin, plant evidence, lift a purse, or perform legerdemain unseen.",
  Stealth: "Conceal yourself, move silently, slip past guards unnoticed.",
  Survival: "Follow tracks, hunt game, navigate wilderness, predict weather, avoid natural hazards.",
};
const INVOCATION_INFO = {
  "Agonizing Blast": "When you cast eldritch blast, add your Charisma modifier to the damage it deals on a hit.",
  "Armor of Shadows": "You can cast mage armor on yourself at will, without expending a spell slot or material components.",
  "Ascendant Step": "You can cast levitate on yourself at will, without expending a spell slot or material components.",
  "Beast Speech": "You can cast speak with animals at will, without expending a spell slot.",
  "Beguiling Influence": "You gain proficiency in the Deception and Persuasion skills.",
  "Bewitching Whispers": "You can cast compulsion once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Book of Ancient Secrets": "Inscribe two 1st-level ritual spells in your Book of Shadows and cast them as rituals; you can add further ritual spells you find to the book.",
  "Chains of Carceri": "You can cast hold monster at will — targeting a celestial, fiend, or elemental — without expending a spell slot. Long rest before reusing on the same creature.",
  "Devil's Sight": "You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.",
  "Dreadful Word": "You can cast confusion once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Eldritch Sight": "You can cast detect magic at will, without expending a spell slot.",
  "Eldritch Spear": "When you cast eldritch blast, its range is 300 feet.",
  "Eyes of the Rune Keeper": "You can read all writing.",
  "Fiendish Vigor": "You can cast false life on yourself at will as a 1st-level spell, without expending a spell slot or material components.",
  "Gaze of Two Minds": "Touch a willing humanoid to perceive through its senses until the end of your next turn; keep concentrating to extend it.",
  "Lifedrinker": "When you hit a creature with your pact weapon, it takes extra necrotic damage equal to your Charisma modifier (minimum 1).",
  "Mask of Many Faces": "You can cast disguise self at will, without expending a spell slot.",
  "Master of Myriad Forms": "You can cast alter self at will, without expending a spell slot.",
  "Minions of Chaos": "You can cast conjure elemental once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Mire the Mind": "You can cast slow once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Misty Visions": "You can cast silent image at will, without expending a spell slot or material components.",
  "One with Shadows": "When you are in dim light or darkness, you can become invisible as an action until you move, act, or react.",
  "Otherworldly Leap": "You can cast jump on yourself at will, without expending a spell slot or material components.",
  "Repelling Blast": "When you hit a creature with eldritch blast, you can push it up to 10 feet away from you in a straight line.",
  "Sculptor of Flesh": "You can cast polymorph once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Sign of Ill Omen": "You can cast bestow curse once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Thief of Five Fates": "You can cast bane once using a warlock spell slot. You can't do so again until you finish a long rest.",
  "Thirsting Blade": "You can attack with your pact weapon twice, instead of once, whenever you take the Attack action on your turn.",
  "Visions of Distant Realms": "You can cast arcane eye at will, without expending a spell slot.",
  "Voice of the Chain Master": "Communicate telepathically with your familiar and perceive through its senses anywhere on the same plane; you can also speak through it.",
  "Whispers of the Grave": "You can cast speak with dead at will, without expending a spell slot.",
  "Witch Sight": "You can see the true form of any shapechanger or creature concealed by illusion or transmutation magic within 30 feet.",
};
const METAMAGIC_INFO = {
  "Careful Spell": "Spend 1 sorcery point: choose up to Charisma-modifier creatures who automatically succeed on their saving throw against your spell.",
  "Distant Spell": "Spend 1 sorcery point to double a spell's range, or give a touch spell a range of 30 feet.",
  "Empowered Spell": "Spend 1 sorcery point to reroll up to Charisma-modifier damage dice. Usable alongside another Metamagic option.",
  "Extended Spell": "Spend 1 sorcery point to double the duration of a spell (max 24 hours).",
  "Heightened Spell": "Spend 3 sorcery points to give one target disadvantage on its first saving throw against the spell.",
  "Quickened Spell": "Spend 2 sorcery points to cast a spell with a casting time of 1 action as a bonus action.",
  "Subtle Spell": "Spend 1 sorcery point to cast without somatic or verbal components.",
  "Twinned Spell": "Spend sorcery points equal to the spell's level (1 for cantrips) to target a second creature with a single-target spell.",
};
const BOON_INFO = {
  "Pact of the Blade": "Create a pact weapon in your empty hand as an action — any melee weapon form, counts as magical, vanishes if dismissed or far away. You can bind a magic weapon as your pact weapon.",
  "Pact of the Chain": "Learn find familiar and cast it as a ritual; your familiar can take special forms (imp, pseudodragon, quasit, sprite), and you can forgo an attack to let it attack with its reaction.",
  "Pact of the Tome": "Your patron grants a Book of Shadows containing three cantrips from any class's list — you can cast them at will.",
};

const ABILITY_INFO = {
  Strength: "Raw physical power. Governs melee attack and damage rolls, Athletics, carrying capacity, and Strength saves against being shoved or restrained.",
  Dexterity: "Agility and reflexes. Governs finesse and ranged attacks, Armor Class in light armor, initiative, Acrobatics, Sleight of Hand, Stealth, and Dexterity saves against effects you must dodge.",
  Constitution: "Endurance and vitality. Adds to every Hit Die you roll, powers concentration saves for spellcasters, and resists poison, disease, and exhaustion.",
  Intelligence: "Reasoning and memory. Governs Arcana, History, Investigation, Nature, Religion — and it's the Wizard's casting ability.",
  Wisdom: "Awareness and intuition. Governs Perception, Insight, Survival, Medicine, Animal Handling; casting ability for Clerics, Druids, and Rangers; resists charms and frights.",
  Charisma: "Force of personality. Governs Deception, Intimidation, Performance, Persuasion; casting ability for Bards, Paladins, Sorcerers, and Warlocks.",
};
const CORE_FEATURE_INFO = {
  "Pact Magic": "Your patron grants you spell slots unlike anyone else's. You have a small number of slots (shown as the purple Pact diamonds), and every one of them is cast at the same level — the highest you can manage. You regain ALL expended pact slots on a SHORT rest, not just a long one. Any leveled warlock spell you know is cast using a pact slot; your cantrips cost nothing and are cast at will.",
  "Spellcasting": "You can cast spells of this class using its spell slots. Cantrips are cast at will without slots. See your Grimoire below for known/prepared spells and the Spell Slots card to track expenditure.",
  "Eldritch Invocations": "Fragments of forbidden knowledge that grant a permanent magical ability. You learn two at 2nd level and more as you level (shown on your sheet under Eldritch Invocations), and may swap one out whenever you gain a warlock level.",
  "Mystic Arcanum": "Your patron grants a single spell of 6th level (then 7th, 8th, and 9th at higher levels) that you can cast once per long rest without a spell slot.",
  "Pact Boon": "At 3rd level your patron grants a gift: Pact of the Blade (a summonable weapon), Pact of the Chain (an improved familiar), or Pact of the Tome (a Book of Shadows with three any-class cantrips).",
  "Channel Divinity": "Channel divine energy to fuel magical effects determined by your domain or oath. Once per short or long rest (twice at higher levels).",
};

/* ============ CHOICE PREVIEWS ============ */
/* One feature, name + full rules text — the unit of "know what you're getting". */
function FeatureLine({ name, cls, customs }) {
  const body = featureBody(name, cls, customs);
  return (
    <div style={{ marginTop: 8 }}>
      <span {...lorePress(name)} style={{ color: T.ink, fontWeight: 700, fontSize: 13.5 }}>{name}</span>
      {body && <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6, marginTop: 2 }}>{body}</div>}
    </div>
  );
}

/* Everything a subclass grants — flavor, spell lists, and every feature at every level —
   rendered inline so the choice can be read in full before it is made. */
function SubclassDetail({ name, cls, customs, nowLevel = 1, terrain }) {
  const base = baseSubName(name);
  const lore = SUB_LORE[base];
  const custom = !lore && Object.values(customs?.subs || {}).flat().find((s) => s.name === name || s.name === base);
  const spellName = base === "Circle of the Land" ? (terrain ? `${base} (${terrain})` : null) : name;
  const sd = spellName ? subSpellData(spellName, cls, customs) : null;
  const featLevels = lore
    ? Object.entries(lore.features)
    : custom ? Object.entries(custom.feats || {}).map(([l, names]) => [l, names.map((n) => ({ n, t: featureBody(n, cls, customs) }))]) : [];
  if (!lore && !custom) return null;
  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${T.edge}`, paddingTop: 10 }}>
      {lore?.flavor && <div style={{ color: T.ink, fontSize: 13, fontStyle: "italic", lineHeight: 1.6, opacity: 0.9 }}>{lore.flavor}</div>}
      {base === "Circle of the Land" && !terrain && (
        <div style={{ color: "#b48ead", fontSize: 12, marginTop: 8 }}>Each land grants its own always-prepared circle spells — choose a terrain to see them.</div>
      )}
      {sd && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: "#b48ead", fontSize: 12, fontWeight: 700 }}>{sd.label}</div>
          {Object.entries(sd.spells).sort((a, b) => a[0] - b[0]).map(([l, arr]) => (
            <div key={l} style={{ fontSize: 13, color: T.ink, marginTop: 3 }}>
              <span style={{ color: T.dim }}>{cls} {l}: </span>
              {arr.map((s, i) => <span key={s}>{i > 0 ? ", " : ""}<span {...lorePress(s)}>{s}</span></span>)}
            </div>
          ))}
        </div>
      )}
      {featLevels.sort((a, b) => a[0] - b[0]).map(([l, fx]) => (
        <div key={l} style={{ marginTop: 10 }}>
          <div style={{ color: T.gold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
            {cls} level {l}{+l <= nowLevel ? <span style={{ color: T.green }}> — you gain this now</span> : ""}
          </div>
          {fx.map((f) => <FeatureLine key={f.n} name={f.n} cls={cls} customs={customs} />)}
        </div>
      ))}
      <div style={{ color: T.dim, fontSize: 11, marginTop: 10 }}>{lore ? SRD_FOOT : "Custom content — imported feature text appears here when available."}</div>
    </div>
  );
}

/* What a class gives you at level 1, in full — shown under the class picker. */
function ClassDetail({ cls, customs }) {
  const d = CLASSES[cls];
  return (
    <div style={{ ...card, padding: 14, marginBottom: 14 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17 }}><ClassTag name={cls} size={16} /></div>
      <div style={{ color: T.ink, fontSize: 13, fontStyle: "italic", marginTop: 4, opacity: 0.9 }}>{CLASS_BLURB[cls]}</div>
      <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>
        <span style={{ color: T.gold }}>Hit die</span> d{d.die} · <span style={{ color: T.gold }}>Saves</span> {d.saves.map((s) => s.toUpperCase()).join(" & ")} · <span style={{ color: T.gold }}>Proficiencies</span> {PROF_TEXT[cls]}
        <br /><span style={{ color: T.gold }}>{d.subName}</span> chosen at level {d.subLvl} · <span style={{ color: T.gold }}>Skills</span> choose {d.nSkills}
      </div>
      <div style={{ color: T.gold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 10 }}>At level 1 you gain</div>
      {(d.feats[1] || []).map((f) => <FeatureLine key={f} name={f} cls={cls} customs={customs} />)}
    </div>
  );
}

/* Resolve a name into readable lore, searching compendium imports then built-in tables */
function infoFor(rawName, customs) {
  const name = String(rawName || "").trim();
  if (!name) return null;
  const strip = baseSubName(name);
  const sp = (customs?.spells || []).find((s) => s.name === name || s.name === strip);
  if (sp) return {
    title: sp.name,
    meta: [sp.level === 0 ? "Cantrip" : `Level ${sp.level}`, schoolName(sp.school), sp.time && `Cast: ${sp.time}`, sp.range && `Range: ${sp.range}`, sp.components && `Components: ${sp.components}`, sp.duration && `Duration: ${sp.duration}`].filter(Boolean).join(" · "),
    body: sp.text || null, foot: [sourceOf(sp.text), sp.classes ? `Classes: ${sp.classes}` : null].filter(Boolean).join(" · ") || null,
  };
  const item = (customs?.items || []).find((x) => x.name === name || x.name === strip);
  if (item) {
    const props = (item.property || "").split(",").map((p) => WEAPON_PROPS[p.trim()] || p.trim()).filter(Boolean).join(", ");
    return {
      title: item.name,
      meta: [ITEM_TYPES[item.type] || item.type, item.ac ? `AC ${item.type === "S" ? "+" : ""}${item.ac}` : "", item.dmg1 ? `${item.dmg1}${item.dmg2 ? ` (${item.dmg2} versatile)` : ""} ${DMG_TYPES[item.dmgType] || item.dmgType || ""}` : "", props, item.range ? `Range ${item.range}` : "", item.strReq ? `Str ${item.strReq} required` : "", item.stealthDis ? "Stealth disadvantage" : "", item.weight ? `${item.weight} lb` : "", item.value ? `${item.value} gp` : ""].filter(Boolean).join(" · "),
      body: item.text || null, foot: sourceOf(item.text),
    };
  }
  const inv = INVOCATION_DATA.find(([n]) => n === name || n === strip);
  if (inv) return { title: inv[0], meta: ["Eldritch Invocation", inv[1] > 0 ? `requires warlock ${inv[1]}` : "", inv[2] ? `requires ${inv[2]}` : ""].filter(Boolean).join(" · "), body: INVOCATION_INFO[inv[0]] || null };
  if (METAMAGIC_INFO[name]) return { title: name, meta: "Metamagic", body: METAMAGIC_INFO[name] };
  if (BOON_INFO[name]) return { title: name, meta: "Pact Boon", body: BOON_INFO[name] };
  const fs = strip.replace(/^Fighting Style:\s*/, "");
  if (STYLE_DESC[fs]) return { title: `Fighting Style: ${fs}`, meta: "Fighting Style", body: STYLE_DESC[fs] };
  if (LANG_INFO[name]) return { title: name, meta: "Language", body: LANG_INFO[name] };
  if (ABILITY_INFO[name]) return { title: name, meta: "Ability score", body: ABILITY_INFO[name] };
  if (SKILL_ABIL[name]) return { title: name, meta: `Skill · ${ABIL_NAMES[SKILL_ABIL[name]]}`, body: SKILL_INFO[name] };
  const feat = allFeats(customs || EMPTY_CUSTOM).find((f) => f.name === name || f.name === strip);
  if (feat) return { title: feat.name, meta: ["Feat", feat.prereq && `Prerequisite: ${feat.prereq}`].filter(Boolean).join(" · "), body: feat.text || feat.desc || null };
  for (const [cls, arr] of Object.entries(customs?.subs || {})) {
    const s = arr.find((x) => x.name === name || x.name === strip);
    if (s) return { title: s.name, meta: `${cls} subclass`, body: Object.entries(s.feats).map(([l, fx]) => `Level ${l}: ${fx.join(", ")}`).join("\n"), foot: "Long-press any feature name for its own entry." };
  }
  if (SUB_LORE[strip]) {
    const sl = SUB_LORE[strip];
    const sd = subSpellData(strip === "Circle of the Land" ? name : strip, sl.cls, customs);
    const lines = [sl.flavor];
    if (sd) { lines.push(`${sd.label} — ` + Object.entries(sd.spells).sort((a, b) => a[0] - b[0]).map(([l, arr]) => `${sl.cls} ${l}: ${arr.join(", ")}`).join("; ") + "."); }
    Object.entries(sl.features).sort((a, b) => a[0] - b[0]).forEach(([l, fx]) => fx.forEach((f) => lines.push(`Level ${l} — ${f.n}. ${f.t}`)));
    return { title: strip, meta: `${CLASSES[sl.cls].subName} · ${sl.cls}`, body: lines.join("\n"), foot: SRD_FOOT };
  }
  if (SUB_FEATS[strip]) return { title: strip, meta: "Subclass", body: Object.entries(SUB_FEATS[strip]).map(([l, fx]) => `Level ${l}: ${fx.join(", ")}`).join("\n") };
  const ft = customs?.featureTexts || {};
  let key = ft[name] ? name : ft[strip] ? strip : Object.keys(ft).find((k) => baseSubName(k) === strip || k.startsWith(strip + " ("));
  if (!key) { const cp = name.match(/^([^:]+):/); if (cp && ft[cp[1].trim()]) key = cp[1].trim(); }
  if (!key) key = Object.keys(ft).filter((k) => k.length > 3 && strip.startsWith(k + " ")).sort((a, b) => b.length - a.length)[0];
  if (key) return { title: strip, meta: "Feature", body: ft[key], foot: sourceOf(ft[key]) };
  if (FEATURE_TEXT[name] || FEATURE_TEXT[strip]) return { title: strip, meta: "Feature", body: FEATURE_TEXT[name] || FEATURE_TEXT[strip], foot: SRD_FOOT };
  if (CORE_FEATURE_INFO[strip]) return { title: strip, meta: "Feature", body: CORE_FEATURE_INFO[strip] };
  const eff = EFFECT_LIB.find((x) => x.name === name || x.name === strip);
  if (eff) return { title: eff.name, meta: [eff.kind === "Condition" ? "Condition" : `${eff.kind} · trackable effect`, eff.conc && "Concentration", eff.dur].filter(Boolean).join(" · "), body: [eff.brief, eff.desc].filter(Boolean).join("\n") };
  return null;
}

/* Long-press (or right-click) to open the lore sheet. data-lore also kills text selection via CSS. */
let __showLore = null;
function lorePress(name) {
  return {
    "data-lore": "",
    onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); __showLore && __showLore(name); },
    onPointerDown: (e) => {
      const el = e.currentTarget;
      const sx = e.clientX, sy = e.clientY;
      const t = setTimeout(() => { el.dataset.loreFired = "1"; __showLore && __showLore(name); }, 480);
      const move = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) end(); };
      const end = () => { clearTimeout(t); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", end); el.removeEventListener("pointercancel", end); el.removeEventListener("pointerleave", end); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end); el.addEventListener("pointerleave", end);
    },
    onClickCapture: (e) => {
      if (e.currentTarget.dataset.loreFired) { delete e.currentTarget.dataset.loreFired; e.preventDefault(); e.stopPropagation(); }
    },
  };
}

function LoreSheet({ customs }) {
  const [item, setItem] = useState(null);
  const openedAt = useRef(0);
  __showLore = (name) => { openedAt.current = Date.now(); setItem(infoFor(name, customs) || { title: String(name), meta: "", body: null }); };
  if (!item) return null;
  // the release of the long-press lands on this backdrop — a short grace period keeps it open
  const dismiss = () => { if (Date.now() - openedAt.current > 400) setItem(null); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={dismiss}>
      <div style={{ ...card, width: "min(620px, 100%)", maxHeight: "72vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>{item.title}</div>
          <span style={{ color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1 }} onClick={() => setItem(null)}>✕</span>
        </div>
        {item.meta && <div style={{ color: "#b48ead", fontSize: 13, marginTop: 4 }}>{item.meta}</div>}
        <div style={{ color: T.ink, fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
          {item.body
            ? item.body.split(/\n+/).map((p, i) => <p key={i} style={{ margin: "0 0 10px" }}>{p}</p>)
            : <span style={{ color: T.dim }}>No lore recorded for this yet. Import a compendium XML in the Homebrew Forge to fill the library — or consult your books.</span>}
        </div>
        {item.foot && <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{item.foot}</div>}
      </div>
    </div>
  );
}

/* ============ STORAGE ============ */
const KEY = "dnd-srd-characters-v1";
async function loadChars() {
  try { const r = await window.storage.get(KEY); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveChars(chars) {
  try { await window.storage.set(KEY, JSON.stringify(chars)); } catch (e) { console.error("save failed", e); }
}

/* ============ CUSTOM (HOMEBREW) CONTENT ============ */
const CKEY = "dnd-custom-content-v1";
const EMPTY_CUSTOM = { subs: {}, feats: [], spells: [], items: [], featureTexts: {} };
async function loadCustom() {
  try { const r = await window.storage.get(CKEY); return r ? JSON.parse(r.value) : EMPTY_CUSTOM; } catch { return EMPTY_CUSTOM; }
}
async function saveCustom(c) {
  try { await window.storage.set(CKEY, JSON.stringify(c)); } catch (e) { console.error("save failed", e); }
}
/* ---- export / import: the ledger escapes the vault ---- */
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

const allSubs = (cls, customs) => CLASSES[cls].subs.concat((customs?.subs?.[cls] || []).map((s) => s.name));
const customSubFeats = (subclass, level, customs) => {
  for (const arr of Object.values(customs?.subs || {})) {
    const hit = arr.find((s) => s.name === subclass || s.name === baseSubName(subclass));
    if (hit) return hit.feats?.[level] || [];
  }
  return [];
};
const allSubFeats = (subclass, level, customs) => subFeatsFor(subclass, level).concat(customSubFeats(subclass, level, customs));
const allFeats = (customs) => {
  const map = new Map(FEATS.map((f) => [f.name, f]));
  (customs?.feats || []).forEach((f) => map.set(f.name, f)); // imported full text shadows the stub
  return [...map.values()];
};


/* ============ PHOTO ============ */
function usePhotoUpload(onPhoto) {
  return useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const c = document.createElement("canvas");
        const s = 220;
        c.width = s; c.height = s;
        const ctx = c.getContext("2d");
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, s, s);
        onPhoto(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, [onPhoto]);
}

function Portrait({ photo, size = 72, name }) {
  return photo ? (
    <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.gold}` }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: T.panel2, border: `2px solid ${T.edge}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, fontFamily: "Georgia, serif", fontSize: size * 0.4 }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

/* ============ ABILITY SCORE GENERATION ============ */
const STD_ARRAY = [15, 14, 13, 12, 10, 8];
const PB_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function AbilityStep({ scores, setScores, method, setMethod }) {
  const [rolling, setRolling] = useState(null); // {dice, targetIdx}
  const [rolled, setRolled] = useState([]); // pool of rolled totals
  const [assignIdx, setAssignIdx] = useState({}); // ability -> pool index

  const pbSpent = ABILITIES.reduce((s, a) => s + (PB_COST[scores[a]] ?? 0), 0);

  const startRoll = () => setRolling({ dice: [roll(6), roll(6), roll(6), roll(6)].map((v) => ({ sides: 6, value: v })) });

  const usedPool = Object.values(assignIdx);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["Standard Array", "Point Buy", "Roll 4d6"].map((m) => (
          <button key={m} style={{ ...btn(method === m), padding: "8px 14px" }} onClick={() => { setMethod(m); setAssignIdx({}); if (m !== "Roll 4d6") setRolled([]); setScores(Object.fromEntries(ABILITIES.map((a) => [a, 8]))); }}>{m}</button>
        ))}
      </div>

      {method === "Point Buy" && (
        <div style={{ color: pbSpent > 27 ? T.blood : T.dim, marginBottom: 10, fontSize: 14 }}>
          Points spent: <b style={{ color: pbSpent > 27 ? T.blood : T.gold }}>{pbSpent} / 27</b>
        </div>
      )}

      {method === "Roll 4d6" && (
        <div style={{ marginBottom: 12 }}>
          <button style={btn(true)} onClick={startRoll} disabled={rolled.length >= 6}>
            <Icon name="d20" /> Roll {rolled.length < 6 ? `score ${rolled.length + 1} of 6` : "complete"}
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {rolled.map((v, i) => (
              <div key={i} style={{ padding: "6px 12px", borderRadius: 8, background: usedPool.includes(i) ? T.panel2 : T.gold, color: usedPool.includes(i) ? T.dim : "#1c1410", fontWeight: 700 }}>{v}</div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {ABILITIES.map((a) => (
          <div key={a} style={{ ...card, background: T.panel2, padding: 12, textAlign: "center" }}>
            <div style={{ color: T.dim, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>{ABIL_NAMES[a]}</div>
            {method === "Standard Array" && (
              <select value={scores[a]} onChange={(e) => setScores({ ...scores, [a]: +e.target.value })}
                style={{ marginTop: 8, background: T.panel, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 6, padding: 6, fontSize: 18, width: "100%" }}>
                {[8, ...STD_ARRAY].filter((v, i, arr) => arr.indexOf(v) === i).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {method === "Point Buy" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}>
                <button style={{ ...btn(false), padding: "2px 10px" }} onClick={() => scores[a] > 8 && setScores({ ...scores, [a]: scores[a] - 1 })}>−</button>
                <span style={{ fontSize: 22, fontFamily: "Georgia, serif" }}>{scores[a]}</span>
                <button style={{ ...btn(false), padding: "2px 10px" }} onClick={() => scores[a] < 15 && setScores({ ...scores, [a]: scores[a] + 1 })}>+</button>
              </div>
            )}
            {method === "Roll 4d6" && (
              <select value={assignIdx[a] ?? ""} onChange={(e) => {
                const v = e.target.value === "" ? undefined : +e.target.value;
                const next = { ...assignIdx };
                if (v === undefined) delete next[a]; else next[a] = v;
                setAssignIdx(next);
                setScores({ ...scores, [a]: v === undefined ? 8 : rolled[v] });
              }} style={{ marginTop: 8, background: T.panel, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 6, padding: 6, fontSize: 16, width: "100%" }}>
                <option value="">—</option>
                {rolled.map((v, i) => (
                  <option key={i} value={i} disabled={usedPool.includes(i) && assignIdx[a] !== i}>{v}</option>
                ))}
              </select>
            )}
            <div style={{ color: T.gold, marginTop: 6, fontSize: 13 }}>{fmtMod(mod(scores[a]))}</div>
          </div>
        ))}
      </div>

      {method === "Standard Array" && (
        <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Assign 15, 14, 13, 12, 10, 8 — each once.</div>
      )}

      {rolling && (
        <DiceTray title={`Rolling 4d6 — score ${rolled.length + 1} of 6`} dice={rolling.dice} dropLowest
          note="The bones tumble; the weakest is discarded."
          tally={rolled} rollId={rolled.length}
          acceptLabel={rolled.length < 5 ? "Keep · Next Roll →" : "Keep · Finish"}
          onAccept={(total) => {
            const next = [...rolled, total];
            setRolled(next);
            if (next.length >= 6) setRolling(null);
            else startRoll();
          }} />
      )}
    </div>
  );
}

/* ============ CREATION WIZARD ============ */
function CreateWizard({ onDone, onCancel, customs }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [race, setRace] = useState("Human");
  const [halfElfPicks, setHalfElfPicks] = useState([]);
  const [cls, setCls] = useState("Fighter");
  const [subclass, setSubclass] = useState(null);
  const [skills, setSkills] = useState([]);
  const [alignment, setAlignment] = useState("True Neutral");
  const [bg, setBg] = useState("Acolyte");
  const [bgSkills, setBgSkills] = useState([]);
  const [style, setStyle] = useState(null);
  const [terrain, setTerrain] = useState(null);
  const [gold, setGold] = useState(null);
  const [spellPicks, setSpellPicks] = useState({ cantrips: [], spells: [] });
  const [rogueExp, setRogueExp] = useState([]);
  const [favEnemy, setFavEnemy] = useState(null);
  const [natTerrain, setNatTerrain] = useState(null);
  const [persona, setPersona] = useState({ traits: "", ideals: "", bonds: "", flaws: "" });
  const [goldRoll, setGoldRoll] = useState(null);
  const [gearMode, setGearMode] = useState(null); // 'standard' | 'gold'
  const [gearPicks, setGearPicks] = useState({}); // slotIdx -> { opt, picks: [] }
  const [purchases, setPurchases] = useState([]); // { name, qty, price }
  const [shopQ, setShopQ] = useState("");
  const [langPicks, setLangPicks] = useState([]);
  const [ancestry, setAncestry] = useState(null);
  const [heSkills, setHeSkills] = useState([]);
  const [heCantrip, setHeCantrip] = useState("");
  const [method, setMethod] = useState("Standard Array");
  const [scores, setScores] = useState(Object.fromEntries(ABILITIES.map((a) => [a, 8])));
  const photoUpload = usePhotoUpload(setPhoto);

  const raceData = RACES[race];
  const clsData = CLASSES[cls];
  const finalScores = { ...scores };
  ABILITIES.forEach((a) => { finalScores[a] += raceData.bonus[a] || 0; });
  if (race === "Half-Elf") halfElfPicks.forEach((a) => { finalScores[a] += 1; });

  const conMod = mod(finalScores.con);
  const hp = clsData.die + conMod + (race === "Hill Dwarf" ? 1 : 0);

  const steps = ["Identity", "Race", "Origins", "Class", "Abilities", "Spells", "Gear", "Confirm"];
  const langNeed = (RACE_LANGS[race].choose || 0) + 2; // race choice + Acolyte's two
  const wizCantrips = (customs?.spells || []).filter((x) => x.level === 0 && spellFitsClass(x, "Wizard"));
  const castsAt1 = !!CLASSES[cls].caster && CLASSES[cls].caster !== "half";
  const canCap1 = CANTRIPS_KNOWN[cls] ? CANTRIPS_KNOWN[cls](1) : 0;
  const spellCap1 = castsAt1 ? spellCapacity(cls, 1, finalScores).n : 0;
  const pool1 = (customs?.spells || []).filter((x) => spellFitsClass(x, cls, subclass));
  const gearPlan = STARTING_GEAR[cls];
  const slotDone = (i) => {
    const gp = gearPicks[i];
    if (!gp) return false;
    const o = gearPlan.slots[i].options[gp.opt];
    return o.pick ? (gp.picks || []).length === o.n : true;
  };
  const standardReady = gearPlan.slots.every((_, i) => slotDone(i));
  const spent = purchases.reduce((s, p) => s + p.price * p.qty, 0);
  const goldLeft = Math.round(((gold ?? 0) - spent) * 100) / 100;
  const standardItems = () => {
    const rows = [];
    const add = (nm, qty) => { const r = rows.find((x) => x.name === nm); if (r) r.qty += qty; else rows.push({ name: nm, qty }); };
    gearPlan.fixed.forEach(([nm, q]) => add(nm, q));
    gearPlan.slots.forEach((s, i) => {
      const gp = gearPicks[i]; const o = s.options[gp.opt];
      (o.items || []).forEach(([nm, q]) => add(nm, q));
      (o.extra || []).forEach(([nm, q]) => add(nm, q));
      (gp.picks || []).forEach((nm) => add(nm, 1));
    });
    return rows.map((r) => {
      const it = findItem(r.name, customs);
      return it && (isArmorType(it.type) || it.type === "S" || isWeaponType(it.type)) ? { ...r, equipped: true } : r;
    });
  };
  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? (race !== "Half-Elf" || halfElfPicks.length === 2) :
    step === 2 ? langPicks.length === langNeed && (bg !== "Custom" || bgSkills.length === 2) && (race !== "Dragonborn" || ancestry) && (race !== "Half-Elf" || heSkills.length === 2) && (race !== "High Elf" || heCantrip.trim()) :
    step === 3 ? skills.length === clsData.nSkills && (clsData.subLvl > 1 || subclass) && (cls !== "Fighter" || style) && (cls !== "Rogue" || rogueExp.length === 2) && (cls !== "Ranger" || (favEnemy && natTerrain)) :
    step === 6 ? (gearMode === "standard" ? standardReady : gearMode === "gold" ? gold !== null : false) :
    true;

  const finish = () => {
    const inventory = gearMode === "standard" ? standardItems() : purchases.map(({ name: nm, qty }) => ({ name: nm, qty }));
    onDone({
      id: uid(), name: name.trim(), photo, race, background: bg, alignment,
      gold: gearMode === "standard" ? 10 : Math.max(0, goldLeft),
      inventory,
      styles: style ? [style] : [], notes: "", persona,
      expertise: rogueExp, metamagic: [], pactBoon: null, invocations: [],
      rangerChoices: cls === "Ranger" ? { favEnemy, natTerrain } : null,
      spells: castsAt1 && (spellPicks.cantrips.length || spellPicks.spells.length) ? { [cls]: spellPicks } : {},
      abilities: finalScores, method,
      classes: [{ name: cls, level: 1, subclass: clsData.subLvl === 1 ? subclass : null }],
      skills: [...skills, ...heSkills, ...(bg === "Acolyte" ? ["Insight", "Religion"] : bgSkills)].filter((v, i, a) => a.indexOf(v) === i),
      languages: [...RACE_LANGS[race].fixed, ...langPicks],
      racialChoices: { ancestry: race === "Dragonborn" ? ancestry : null, cantrip: race === "High Elf" ? heCantrip.trim() : null },
      maxHp: hp, hpLog: [{ cls, gained: hp, how: "1st level (max)" }],
      log: [`Created as ${race} ${cls} 1${style ? ` · ${style}` : ""} · ${bg} · ${alignment}${gearMode === "standard" ? " · standard gear" : ` · bought gear (${Math.max(0, goldLeft)} gp left)`}`],
    });
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, letterSpacing: 1,
            background: i === step ? T.blood : "transparent", color: i === step ? T.ink : i < step ? T.gold : T.dim,
            border: `1px solid ${i <= step ? T.gold : T.edge}` }}>{s}</div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ ...card, padding: 20 }}>
          <label style={{ color: T.dim, fontSize: 13 }}>Character name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Thalia Emberfall"
            style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, padding: 12, background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 8, color: T.ink, fontSize: 18, fontFamily: "Georgia, serif" }} />
          <label style={{ color: T.dim, fontSize: 13, display: "block", marginTop: 14 }}>Alignment</label>
          <select value={alignment} onChange={(e) => setAlignment(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 6, padding: 12, background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 10, color: T.ink, fontSize: 16 }}>
            {ALIGNMENTS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
            <Portrait photo={photo} size={84} name={name} />
            <label style={{ ...btn(false), display: "inline-block" }}>
              Upload portrait
              <input type="file" accept="image/*" onChange={photoUpload} style={{ display: "none" }} />
            </label>
            {photo && <button style={{ ...btn(false), borderColor: T.blood, color: T.blood }} onClick={() => setPhoto(null)}>Remove</button>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          {Object.entries(RACES).map(([r, d]) => (
            <div key={r} onClick={() => { setRace(r); setHalfElfPicks([]); }}
              style={{ ...card, padding: 14, cursor: "pointer", borderColor: race === r ? T.gold : T.edge, background: race === r ? T.panel2 : T.panel }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: race === r ? T.gold : T.ink }}>{r}</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>
                {ABILITIES.filter((a) => d.bonus[a]).map((a) => `${a.toUpperCase()} +${d.bonus[a]}`).join(", ")}{d.choose ? ", +1 to two others" : ""} · {d.speed} ft
              </div>
              <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>{d.traits.slice(0, 3).join(" · ")}</div>
            </div>
          ))}
          {race === "Half-Elf" && (
            <div style={{ gridColumn: "1 / -1", ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Choose two abilities for +1 (not Charisma)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ABILITIES.filter((a) => a !== "cha").map((a) => (
                  <button key={a} style={{ ...btn(halfElfPicks.includes(a)), padding: "6px 12px" }}
                    onClick={() => setHalfElfPicks(halfElfPicks.includes(a) ? halfElfPicks.filter((x) => x !== a) : halfElfPicks.length < 2 ? [...halfElfPicks, a] : halfElfPicks)}>
                    {ABIL_NAMES[a]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Background</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <button style={{ ...btn(bg === "Acolyte"), padding: "6px 14px" }} onClick={() => { setBg("Acolyte"); setBgSkills([]); }}>Acolyte (SRD)</button>
              <button style={{ ...btn(bg === "Custom"), padding: "6px 14px" }} onClick={() => setBg("Custom")}>Custom</button>
            </div>
            {bg === "Acolyte" && <div style={{ color: T.dim, fontSize: 12 }}>Skills: Insight & Religion · two extra languages · Shelter of the Faithful.</div>}
            {bg === "Custom" && (
              <div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 6 }}>Per background customization rules: choose any two skills ({bgSkills.length}/2) and two languages (below).</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ALL_SKILLS.map((sk) => (
                    <button key={sk} style={{ ...btn(bgSkills.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setBgSkills(bgSkills.includes(sk) ? bgSkills.filter((x) => x !== sk) : bgSkills.length < 2 ? [...bgSkills, sk] : bgSkills)}>{sk}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Languages</div>
            <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>
              {race} grants {RACE_LANGS[race].fixed.join(" & ")}. Choose {langNeed} more ({RACE_LANGS[race].choose || 0} racial + 2 from your background). ({langPicks.length}/{langNeed})
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LANGS.filter((l) => !RACE_LANGS[race].fixed.includes(l)).map((l) => (
                <button key={l} {...lorePress(l)} style={{ ...btn(langPicks.includes(l)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                  onClick={() => setLangPicks(langPicks.includes(l) ? langPicks.filter((x) => x !== l) : langPicks.length < langNeed ? [...langPicks, l] : langPicks)}>{l}</button>
              ))}
            </div>
          </div>
          {race === "Dragonborn" && (
            <div style={{ ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Draconic Ancestry</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(ANCESTRIES).map(([d, dmg]) => (
                  <button key={d} style={{ ...btn(ancestry === d), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setAncestry(d)}>{d} ({dmg})</button>
                ))}
              </div>
            </div>
          )}
          {race === "Half-Elf" && (
            <div style={{ ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Skill Versatility — choose two ({heSkills.length}/2)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ALL_SKILLS.map((sk) => (
                  <button key={sk} style={{ ...btn(heSkills.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                    onClick={() => setHeSkills(heSkills.includes(sk) ? heSkills.filter((x) => x !== sk) : heSkills.length < 2 ? [...heSkills, sk] : heSkills)}>{sk}</button>
                ))}
              </div>
            </div>
          )}
          {race === "High Elf" && (
            <div style={{ ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Wizard Cantrip (Intelligence is your ability for it)</div>
              {wizCantrips.length > 0 ? (
                <select value={heCantrip} onChange={(e) => setHeCantrip(e.target.value)}
                  style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, width: "100%" }}>
                  <option value="">Choose…</option>
                  {wizCantrips.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                </select>
              ) : (
                <input value={heCantrip} onChange={(e) => setHeCantrip(e.target.value)} placeholder="Cantrip name (import spells to get a picker)"
                  style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, width: "100%", boxSizing: "border-box" }} />
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
            {Object.entries(CLASSES).map(([c, d]) => (
              <div key={c} onClick={() => { setCls(c); setSkills([]); setSubclass(null); setStyle(null); setRogueExp([]); setFavEnemy(null); setNatTerrain(null); setSpellPicks({ cantrips: [], spells: [] }); setGearMode(null); setGearPicks({}); setPurchases([]); setGold(null); setGoldRoll(null); }}
                style={{ ...card, padding: 12, cursor: "pointer", borderColor: cls === c ? T.gold : T.edge, background: cls === c ? T.panel2 : T.panel }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 16 }}><ClassTag name={c} size={15} /></div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>d{d.die} · saves {d.saves.map((s) => s.toUpperCase()).join("/")}{d.caster ? ` · ${d.caster} caster` : ""}</div>
              </div>
            ))}
          </div>
          <ClassDetail cls={cls} customs={customs} />
          {cls === "Fighter" && (
            <div style={{ ...card, padding: 14, marginBottom: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Fighting Style (level 1)</div>
              <div style={{ display: "grid", gap: 6 }}>
                {FIGHTING_STYLES.Fighter.map((f) => (
                  <div key={f} {...lorePress("Fighting Style: " + f)} onClick={() => setStyle(f)} style={{ ...card, background: style === f ? T.panel : T.panel2, borderColor: style === f ? T.gold : T.edge, padding: "8px 12px", cursor: "pointer" }}>
                    <span style={{ color: style === f ? T.gold : T.ink, fontWeight: 700 }}>{f}</span>
                    <span style={{ color: T.dim, fontSize: 12 }}> — {STYLE_DESC[f]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {clsData.subLvl === 1 && (
            <div style={{ ...card, padding: 14, marginBottom: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>{clsData.subName} (chosen at level 1)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allSubs(cls, customs).map((s) => (
                  <button key={s} {...lorePress(s)} style={{ ...btn(subclass === s), padding: "6px 14px" }} onClick={() => setSubclass(s)}>{s}</button>
                ))}
              </div>
              {subclass
                ? <SubclassDetail name={subclass} cls={cls} customs={customs} nowLevel={1} />
                : <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Select one to read everything it grants — now and at every level to come.</div>}
            </div>
          )}
          <div style={{ ...card, padding: 14 }}>
            <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Choose {clsData.nSkills} skills ({skills.length}/{clsData.nSkills})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {clsData.skills.map((s) => (
                <button key={s} {...lorePress(s)} style={{ ...btn(skills.includes(s)), padding: "5px 10px", fontSize: 13 }}
                  onClick={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : skills.length < clsData.nSkills ? [...skills, s] : skills)}>{s}</button>
              ))}
            </div>
            <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Your background adds its skills automatically.</div>
            {cls === "Rogue" && skills.length === clsData.nSkills && (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Expertise — double proficiency on two ({rogueExp.length}/2)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {skills.map((sk) => (
                    <button key={sk} style={{ ...btn(rogueExp.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setRogueExp(rogueExp.includes(sk) ? rogueExp.filter((x) => x !== sk) : rogueExp.length < 2 ? [...rogueExp, sk] : rogueExp)}>{sk}</button>
                  ))}
                </div>
              </div>
            )}
            {cls === "Ranger" && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div>
                  <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Favored Enemy</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {FAVORED_ENEMIES.map((f) => <button key={f} style={{ ...btn(favEnemy === f), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setFavEnemy(f)}>{f}</button>)}
                  </div>
                </div>
                <div>
                  <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Natural Explorer terrain</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {NE_TERRAINS.map((t) => <button key={t} style={{ ...btn(natTerrain === t), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setNatTerrain(t)}>{t}</button>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <AbilityStep scores={scores} setScores={setScores} method={method} setMethod={setMethod} />
      )}

      {step === 5 && (
        <div style={{ ...card, padding: 20 }}>
          {!castsAt1 ? (
            <div style={{ color: T.dim }}>
              {CLASSES[cls].caster === "half"
                ? `${cls}s begin spellcasting at 2nd level — the Grimoire will open on your sheet when you get there.`
                : `${cls}s channel no spells. Proceed, unburdened by the arcane.`}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ color: T.dim, fontSize: 13 }}>
                {cls === "Cleric" || cls === "Druid"
                  ? `${cls}s know their whole list — choose what you'll have prepared on day one.`
                  : cls === "Wizard" ? "Choose your six starting spellbook spells and your cantrips."
                  : "Choose your cantrips and known spells."}
                {pool1.length === 0 && " (No spell list loaded — import a compendium XML in the Forge, or add spells later in the Grimoire.)"}
              </div>
              {canCap1 > 0 && (
                <div>
                  <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Cantrips ({spellPicks.cantrips.length}/{canCap1})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 180, overflowY: "auto" }}>
                    {pool1.filter((x) => x.level === 0).sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
                      <button key={x.name} {...lorePress(x.name)} style={{ ...btn(spellPicks.cantrips.includes(x.name)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                        onClick={() => setSpellPicks(spellPicks.cantrips.includes(x.name)
                          ? { ...spellPicks, cantrips: spellPicks.cantrips.filter((n) => n !== x.name) }
                          : spellPicks.cantrips.length < canCap1 ? { ...spellPicks, cantrips: [...spellPicks.cantrips, x.name] } : spellPicks)}>{x.name}</button>
                    ))}
                  </div>
                </div>
              )}
              {spellCap1 > 0 && (
                <div>
                  <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>1st-level spells ({spellPicks.spells.length}/{spellCap1})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 220, overflowY: "auto" }}>
                    {pool1.filter((x) => x.level === 1).sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
                      <button key={x.name} {...lorePress(x.name)} style={{ ...btn(spellPicks.spells.includes(x.name)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                        onClick={() => setSpellPicks(spellPicks.spells.includes(x.name)
                          ? { ...spellPicks, spells: spellPicks.spells.filter((n) => n !== x.name) }
                          : spellPicks.spells.length < spellCap1 ? { ...spellPicks, spells: [...spellPicks.spells, x.name] } : spellPicks)}>{x.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 6 && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold, marginBottom: 4 }}>Provisions</div>
          <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>Take the standard {cls} kit, or let fortune fill your purse and outfit yourself.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div onClick={() => setGearMode("standard")}
              style={{ ...card, padding: 14, cursor: "pointer", borderColor: gearMode === "standard" ? T.gold : T.edge, background: gearMode === "standard" ? T.panel2 : T.panel }}>
              <div style={{ color: gearMode === "standard" ? T.gold : T.ink, fontFamily: "Georgia, serif", fontSize: 16 }}><Icon name="shield" /> Standard issue</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>The classic {cls} loadout — make your either/or picks below. Comes with a modest 10 gp pouch.</div>
            </div>
            <div onClick={() => setGearMode("gold")}
              style={{ ...card, padding: 14, cursor: "pointer", borderColor: gearMode === "gold" ? T.gold : T.edge, background: gearMode === "gold" ? T.panel2 : T.panel }}>
              <div style={{ color: gearMode === "gold" ? T.gold : T.ink, fontFamily: "Georgia, serif", fontSize: 16 }}><Icon name="d20" /> Roll for gold</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>Fortune decides: {START_GOLD[cls][0]}d4{START_GOLD[cls][1] > 1 ? " × 10" : ""} gp, then buy whatever you can afford.</div>
            </div>
          </div>

          {gearMode === "standard" && (
            <div>
              {gearPlan.fixed.length > 0 && (
                <div style={{ color: T.dim, fontSize: 13, marginBottom: 10 }}>
                  Always included: {gearPlan.fixed.map(([nm, q]) => (
                    <span key={nm} {...lorePress(nm)} style={{ color: T.ink }}>{q > 1 ? `${nm} ×${q}` : nm}</span>
                  )).reduce((acc, x, i) => (i === 0 ? [x] : [...acc, " · ", x]), [])}
                </div>
              )}
              {gearPlan.slots.map((s, i) => {
                const gp = gearPicks[i];
                const chosen = gp ? s.options[gp.opt] : null;
                return (
                  <div key={s.name} style={{ marginBottom: 12 }}>
                    <div style={{ color: T.gold, fontSize: 13, marginBottom: 6 }}>{s.name}{s.options.length > 1 ? " — choose one" : ""}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {s.options.map((o, j) => (
                        <button key={o.label} style={{ ...btn(gp?.opt === j), padding: "6px 12px", fontSize: 13 }}
                          onClick={() => setGearPicks({ ...gearPicks, [i]: { opt: j, picks: [] } })}>{o.label}</button>
                      ))}
                    </div>
                    {chosen?.pick && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: T.dim, fontSize: 12, marginBottom: 4 }}>Pick {chosen.n} ({(gp.picks || []).length}/{chosen.n}) · long-press to inspect</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {GEAR_LISTS[chosen.pick].map((nm) => {
                            const on = (gp.picks || []).includes(nm);
                            return (
                              <button key={nm} {...lorePress(nm)} style={{ ...btn(on), padding: "4px 10px", fontSize: 12, minHeight: 0 }}
                                onClick={() => setGearPicks({ ...gearPicks, [i]: { ...gp, picks: on ? gp.picks.filter((x) => x !== nm) : gp.picks.length < chosen.n ? [...gp.picks, nm] : gp.picks } })}>{nm}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {standardReady && (
                <div style={{ color: T.green, fontSize: 13, marginTop: 4 }}>
                  ✓ Kit complete: {standardItems().map((r) => (r.qty > 1 ? `${r.name} ×${r.qty}` : r.name)).join(" · ")} — armor and weapons arrive equipped.
                </div>
              )}
            </div>
          )}

          {gearMode === "gold" && (
            <div>
              {gold === null ? (
                <button style={btn(false)} onClick={() => {
                  const [n] = START_GOLD[cls];
                  setGoldRoll({ dice: Array.from({ length: n }, () => ({ sides: 4, value: roll(4) })) });
                }}><Icon name="d20" /> Roll starting gold ({START_GOLD[cls][0]}d4{START_GOLD[cls][1] > 1 ? " × 10" : ""} gp)</button>
              ) : (
                <div>
                  <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 18 }}>Purse: {goldLeft} gp</div>
                  {purchases.length > 0 && (
                    <div style={{ margin: "8px 0" }}>
                      {purchases.map((p) => (
                        <span key={p.name} {...lorePress(p.name)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
                          {p.name}{p.qty > 1 ? ` ×${p.qty}` : ""} <span style={{ color: T.dim, fontSize: 11 }}>{Math.round(p.price * p.qty * 100) / 100} gp</span>
                          <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() =>
                            setPurchases(p.qty > 1 ? purchases.map((x) => (x.name === p.name ? { ...x, qty: x.qty - 1 } : x)) : purchases.filter((x) => x.name !== p.name))}>✕</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {(customs?.items || []).length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <input value={shopQ} onChange={(e) => setShopQ(e.target.value)} placeholder="Browse the outfitter's stock…"
                        style={{ width: "100%", boxSizing: "border-box", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16 }} />
                      <LazyList resetKey={shopQ} style={{ maxHeight: 260, marginTop: 6, border: `1px solid ${T.edge}`, borderRadius: 8 }}
                        items={(customs?.items || []).filter((x) => x.type !== "$" && x.name.toLowerCase().includes(shopQ.toLowerCase()))
                          .sort((a, b) => searchRank(a.name, shopQ) - searchRank(b.name, shopQ) || a.name.localeCompare(b.name))}
                        empty={<div style={{ color: T.dim, fontSize: 13, padding: 8 }}>Nothing matches.</div>}
                        render={(it) => {
                          const price = parseFloat(it.value) || 0;
                          const afford = price <= goldLeft;
                          return (
                            <div key={it.name} {...lorePress(it.name)} onClick={() => {
                              if (!afford) return;
                              const has = purchases.find((p) => p.name === it.name);
                              setPurchases(has ? purchases.map((p) => (p.name === it.name ? { ...p, qty: p.qty + 1 } : p)) : [...purchases, { name: it.name, qty: 1, price }]);
                            }} style={{ padding: "9px 8px", borderBottom: `1px solid ${T.edge}`, cursor: afford ? "pointer" : "default", opacity: afford ? 1 : 0.45 }}>
                              <span style={{ color: T.ink }}>{it.name}</span>
                              <span style={{ color: T.dim, fontSize: 12 }}> · {ITEM_TYPES[it.type] || it.type}{it.ac ? ` · AC ${it.type === "S" ? "+" : ""}${it.ac}` : ""}{it.dmg1 ? ` · ${it.dmg1}` : ""}</span>
                              <span style={{ float: "right", color: afford ? T.gold : T.blood, fontSize: 13 }}>{price > 0 ? `${price} gp` : "—"}</span>
                            </div>
                          );
                        }} />
                      <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>Buying is optional — your purse carries over, and the sheet's inventory is always open.</div>
                    </div>
                  ) : (
                    <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>No compendium imported — pocket the coin and buy gear from your sheet's inventory later.</div>
                  )}
                </div>
              )}
              {goldRoll && (
                <DiceTray title={`Starting wealth — ${START_GOLD[cls][0]}d4${START_GOLD[cls][1] > 1 ? " × 10" : ""}`} dice={goldRoll.dice}
                  note="Your inheritance, such as it is." acceptLabel="Pocket it"
                  onAccept={(total) => { setGold(total * START_GOLD[cls][1]); setGoldRoll(null); }} />
              )}
            </div>
          )}
        </div>
      )}

      {step === 7 && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Portrait photo={photo} size={72} name={name} />
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: T.gold }}>{name}</div>
              <div style={{ color: T.dim }}>{race} {cls} 1 {subclass ? `(${subclass})` : ""} · {bg}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 16 }}>
            {ABILITIES.map((a) => (
              <div key={a} style={{ textAlign: "center" }}>
                <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>{a}</div>
                <div style={{ fontSize: 20, fontFamily: "Georgia, serif", color: T.ink }}>{finalScores[a]}</div>
                <div style={{ color: T.gold, fontSize: 12 }}>{fmtMod(mod(finalScores[a]))}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {["traits", "ideals", "bonds", "flaws"].map((k) => (
              <input key={k} value={persona[k]} onChange={(e) => setPersona({ ...persona, [k]: e.target.value })}
                placeholder={`Personality ${k}…`}
                style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, boxSizing: "border-box" }} />
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 16 }}>
              Gold: {gearMode === "standard" ? 10 : Math.max(0, goldLeft)} gp
            </div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>
              {(() => {
                const rows = gearMode === "standard" ? standardItems() : purchases;
                return rows.length ? "Gear: " + rows.map((r) => (r.qty > 1 ? `${r.name} ×${r.qty}` : r.name)).join(" · ") : "Traveling light — no gear yet.";
              })()}
            </div>
          </div>
          <div style={{ marginTop: 14, color: T.ink }}>HP <b style={{ color: T.gold }}>{hp}</b> (max d{clsData.die} + CON{race === "Hill Dwarf" ? " + Dwarven Toughness" : ""}) · Speed {raceData.speed} ft · Prof +2</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button style={btn(false)} onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</button>
        <button style={{ ...btn(true), opacity: canNext ? 1 : 0.4 }} disabled={!canNext}
          onClick={() => (step === 7 ? finish() : setStep(step + 1))}>{step === 7 ? "Forge Character" : "Next"}</button>
      </div>
    </div>
  );
}

/* exact match first, then prefix, then substring */
const searchRank = (name, q) => {
  const n = name.toLowerCase(), s = q.toLowerCase();
  return n === s ? 0 : n.startsWith(s) ? 1 : 2;
};
const SCHOOL_NAMES = { A: "Abjuration", C: "Conjuration", D: "Divination", EN: "Enchantment", EV: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation" };
const schoolName = (s) => SCHOOL_NAMES[(s || "").toUpperCase()] || s;

/* Scrollable list that renders in batches and keeps loading as you approach the
   bottom — long compendium lists (1,700 items, 850 spells) stay fully reachable
   without mounting thousands of rows up front. resetKey (usually the search
   query) snaps back to the top batch when it changes. */
function LazyList({ items, render, resetKey, empty, style }) {
  const BATCH = 80;
  const [count, setCount] = useState(BATCH);
  const ref = useRef(null);
  useEffect(() => {
    setCount(BATCH);
    if (ref.current) ref.current.scrollTop = 0;
  }, [resetKey]);
  const onScroll = () => {
    const el = ref.current;
    if (el && count < items.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 400) setCount((c) => c + BATCH);
  };
  return (
    <div ref={ref} onScroll={onScroll} style={{ overflowY: "auto", ...style }}>
      {items.slice(0, count).map(render)}
      {items.length === 0 && empty}
      {count < items.length && (
        <div style={{ color: T.dim, fontSize: 12, padding: "10px 8px", textAlign: "center" }}>
          ⌄ {items.length - count} more below — keep scrolling
        </div>
      )}
    </div>
  );
}

/* Searchable multi-pick list used by the level-up flow for cantrips, spells, and arcanum */
function SpellPickGrid({ options, picks, cap, onChange, placeholder = "Search spells…" }) {
  const [q, setQ] = useState("");
  const shown = options.filter((sp) => !picks.includes(sp.name) && sp.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => searchRank(a.name, q) - searchRank(b.name, q));
  return (
    <div>
      {picks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {picks.map((n) => (
            <span key={n} {...lorePress(n)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel, border: `1px solid ${T.gold}`, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13, color: T.gold }}>
              {n}<span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => onChange(picks.filter((x) => x !== n))}>✕</span>
            </span>
          ))}
        </div>
      )}
      {picks.length < cap && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
            style={{ width: "100%", boxSizing: "border-box", background: T.panel, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 14 }} />
          <LazyList items={shown} resetKey={q} style={{ maxHeight: 200, marginTop: 6, border: `1px solid ${T.edge}`, borderRadius: 8 }}
            empty={<div style={{ padding: "8px 10px", color: T.dim, fontSize: 13 }}>Nothing matches.</div>}
            render={(sp) => (
              <div key={sp.name} {...lorePress(sp.name)} onClick={() => onChange([...picks, sp.name])}
                style={{ padding: "8px 10px", borderBottom: `1px solid ${T.edge}`, cursor: "pointer" }}>
                <span style={{ color: T.ink }}>{sp.name}</span>
                <span style={{ color: T.dim, fontSize: 12 }}> · {sp.level === 0 ? "cantrip" : `level ${sp.level}`}{sp.school ? ` · ${schoolName(sp.school)}` : ""}{sourceOf(sp.text) ? ` · ${sourceOf(sp.text)}` : ""}</span>
              </div>
            )} />
        </>
      )}
    </div>
  );
}

/* ============ LEVEL UP (with full multiclassing) ============ */
function LevelUp({ ch, onDone, onCancel, customs }) {
  const lvl = totalLevel(ch);
  const [stage, setStage] = useState("class"); // class -> hp -> extras -> done
  const [pick, setPick] = useState(() => [...ch.classes].sort((a, b) => b.level - a.level)[0]?.name || null);
  const [rollingHp, setRollingHp] = useState(false);
  const [hpGain, setHpGain] = useState(null);
  const [asiMode, setAsiMode] = useState(null); // 'asi' | 'feat'
  const [asiPicks, setAsiPicks] = useState([]);
  const [featPick, setFeatPick] = useState(null);
  const [featBump, setFeatBump] = useState(null);
  const [stylePick, setStylePick] = useState(null);
  const [terrPick, setTerrPick] = useState(null);
  const [expPicks, setExpPicks] = useState([]);
  const [metaPicks, setMetaPicks] = useState([]);
  const [boonPick, setBoonPick] = useState(null);
  const [newSub, setNewSub] = useState(null);
  const [mcSkill, setMcSkill] = useState(null);
  const [invPicks, setInvPicks] = useState([]);
  const [invSwapOut, setInvSwapOut] = useState(null);
  const [invSwapIn, setInvSwapIn] = useState(null);
  const [cantripPicks, setCantripPicks] = useState([]);
  const [spellPicks, setSpellPicks] = useState([]);
  const [spellSwapOut, setSpellSwapOut] = useState(null);
  const [spellSwapIn, setSpellSwapIn] = useState(null);
  const [arcanumPick, setArcanumPick] = useState(null);
  const [boasPicks, setBoasPicks] = useState([]);       // Book of Ancient Secrets rituals
  const [tomePicks, setTomePicks] = useState([]);       // Pact of the Tome cantrips
  const [secretsPicks, setSecretsPicks] = useState([]); // Magical Secrets (any class)
  const [favEnemyPick, setFavEnemyPick] = useState(null);
  const [terrainPick2, setTerrainPick2] = useState(null);
  const [masteryPicks, setMasteryPicks] = useState({}); // { 1: spell, 2: spell }
  const [signaturePicks, setSignaturePicks] = useState([]);
  const [groupPicks, setGroupPicks] = useState({});     // maneuvers, disciplines, totems, …

  if (lvl >= 20) return (
    <div style={{ ...card, padding: 24, textAlign: "center" }}>
      <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 20 }}>Level 20 — the summit is reached.</div>
      <button style={{ ...btn(false), marginTop: 12 }} onClick={onCancel}>Close</button>
    </div>
  );

  const existing = ch.classes.map((c) => c.name);
  const currentOk = ch.classes.every((c) => meetsPrereq(c.name, ch.abilities));

  const classOrder = [
    ...[...ch.classes].sort((a, b) => b.level - a.level).map((c) => c.name),
    ...Object.keys(CLASSES).filter((n) => !ch.classes.some((c) => c.name === n)),
  ];
  const options = classOrder.map((name) => {
    const isNew = !existing.includes(name);
    let ok = true, why = "";
    if (isNew) {
      if (!currentOk) { ok = false; why = "Current class prerequisites unmet — cannot multiclass"; }
      else if (!meetsPrereq(name, ch.abilities)) {
        ok = false;
        why = "Requires " + MC_PREREQ[name].map((r) => Object.entries(r).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" & ")).join(" or ");
      }
    }
    return { name, isNew, ok, why };
  });

  const pickData = pick ? CLASSES[pick] : null;
  const entry = pick ? ch.classes.find((c) => c.name === pick) : null;
  const newClsLevel = entry ? entry.level + 1 : 1;
  const conM = mod(ch.abilities.con);
  const dwarfBonus = ch.race === "Hill Dwarf" ? 1 : 0;
  const avg = pickData ? Math.floor(pickData.die / 2) + 1 : 0;

  const gainsASI = pickData && pickData.asi.includes(newClsLevel);
  const gainsSub = pickData && newClsLevel === pickData.subLvl && !(entry?.subclass);
  const gainsMcSkill = pick && !entry && MC_SKILL_GRANT[pick];
  const featSub = gainsSub ? newSub : entry?.subclass;
  const feats = pickData
    ? (pickData.feats[newClsLevel] || []).concat(allSubFeats(featSub, newClsLevel, customs))
    : [];

  const applyLevel = () => {
    const finalSub = gainsSub ? (gainsTerrain ? `${newSub} (${terrPick})` : newSub) : null;
    const classes = entry
      ? ch.classes.map((c) => (c.name === pick ? { ...c, level: c.level + 1, subclass: gainsSub ? finalSub : c.subclass } : c))
      : [...ch.classes, { name: pick, level: 1, subclass: finalSub }];
    const abilities = { ...ch.abilities };
    let logBits = [`${pick} → ${newClsLevel}`];
    if (asiMode === "asi") { asiPicks.forEach((a) => { abilities[a] = Math.min(20, abilities[a] + 1); }); logBits.push(`ASI: ${asiPicks.map((a) => "+" + 1 + " " + a.toUpperCase()).join(", ")}`); }
    if (asiMode === "feat") {
      logBits.push(`Feat: ${featPick}${featBump ? ` (+1 ${featBump.toUpperCase()})` : ""}`);
      if (featBump) abilities[featBump] = Math.min(20, abilities[featBump] + 1);
    }
    if (gainsSub && newSub) logBits.push(gainsTerrain ? `${newSub} (${terrPick})` : newSub);
    if (stylePick) logBits.push(`Fighting Style: ${stylePick}`);
    if (expPicks.length) logBits.push(`Expertise: ${expPicks.join(", ")}`);
    if (metaPicks.length) logBits.push(`Metamagic: ${metaPicks.join(", ")}`);
    if (boonPick) logBits.push(boonPick);
    let invocations = ch.invocations || [];
    if (invSwapOut && invSwapIn) { invocations = [...invocations.filter((n) => n !== invSwapOut), invSwapIn]; logBits.push(`Invocation swap: ${invSwapOut} → ${invSwapIn}`); }
    if (invPicks.length) { invocations = [...invocations, ...invPicks]; logBits.push(`Invocations: ${invPicks.join(", ")}`); }
    const spellsBook = { ...(ch.spells || {}) };
    if (cantripPicks.length || spellPicks.length || secretsPicks.length || (spellSwapOut && spellSwapIn) || arcanumPick) {
      const mine = { cantrips: [], spells: [], ...(spellsBook[pick] || {}) };
      const learned = [...mine.spells.filter((n) => n !== spellSwapOut), ...(spellSwapOut && spellSwapIn ? [spellSwapIn] : []), ...spellPicks, ...secretsPicks];
      spellsBook[pick] = { ...mine, cantrips: [...mine.cantrips, ...cantripPicks], spells: learned, ...(arcanumPick ? { arcanum: { ...(mine.arcanum || {}), [arcLvlGained]: arcanumPick } } : {}) };
      if (cantripPicks.length) logBits.push(`Cantrips: ${cantripPicks.join(", ")}`);
      if (spellSwapOut && spellSwapIn) logBits.push(`Spell swap: ${spellSwapOut} → ${spellSwapIn}`);
      if (spellPicks.length) logBits.push(`Spells: ${spellPicks.join(", ")}`);
      if (secretsPicks.length) logBits.push(`Magical Secrets: ${secretsPicks.join(", ")}`);
      if (arcanumPick) logBits.push(`Mystic Arcanum: ${arcanumPick}`);
    }
    const boasRituals = takingBoAS && boasPicks.length ? [...(ch.boasRituals || []), ...boasPicks] : ch.boasRituals;
    if (takingBoAS && boasPicks.length) logBits.push(`Book of Shadows rituals: ${boasPicks.join(", ")}`);
    const tomeCantrips = boonPick === "Pact of the Tome" && tomePicks.length ? tomePicks : ch.tomeCantrips;
    if (boonPick === "Pact of the Tome" && tomePicks.length) logBits.push(`Tome cantrips: ${tomePicks.join(", ")}`);
    const rangerChoices = pick === "Ranger" && (favEnemyPick || terrainPick2)
      ? { ...rc, extraEnemies: [...(rc.extraEnemies || []), ...(favEnemyPick ? [favEnemyPick] : [])], extraTerrains: [...(rc.extraTerrains || []), ...(terrainPick2 ? [terrainPick2] : [])] }
      : ch.rangerChoices;
    if (favEnemyPick) logBits.push(`Favored Enemy: ${favEnemyPick}`);
    if (terrainPick2) logBits.push(`Natural Explorer: ${terrainPick2}`);
    let choices = ch.choices;
    if (gainsMastery && (masteryPicks[1] || masteryPicks[2])) { choices = { ...choices, "Spell Mastery": [masteryPicks[1], masteryPicks[2]].filter(Boolean) }; logBits.push(`Spell Mastery: ${choices["Spell Mastery"].join(", ")}`); }
    if (gainsSignature && signaturePicks.length) { choices = { ...choices, "Signature Spell": signaturePicks }; logBits.push(`Signature Spells: ${signaturePicks.join(", ")}`); }
    for (const d of choiceGroupsDue) {
      const picksArr = groupPicks[d.g.key] || [];
      const grants = Object.entries(d.g.grant || {}).flatMap(([l, arr]) => (newClsLevel >= +l ? arr : [])).filter((n) => !d.held.includes(n) && !picksArr.includes(n));
      choices = { ...choices, [d.g.key]: [...d.held, ...grants, ...picksArr] };
      if (picksArr.length) logBits.push(`${d.g.key}: ${picksArr.join(", ")}`);
    }
    const skills = mcSkill ? [...ch.skills, mcSkill] : ch.skills;
    onDone({
      ...ch, classes, abilities, skills, invocations, spells: spellsBook,
      boasRituals, tomeCantrips, rangerChoices, choices,
      maxHp: ch.maxHp + hpGain + conM + dwarfBonus,
      hpLog: [...ch.hpLog, { cls: pick, gained: hpGain + conM + dwarfBonus, how: hpGain === avg ? "average" : `rolled ${hpGain}` }],
      log: [...ch.log, `Level ${lvl + 1}: ${logBits.join(" · ")}`],
      feats: asiMode === "feat" ? [...(ch.feats || []), featPick] : ch.feats,
      styles: stylePick ? [...(ch.styles || []), stylePick] : ch.styles,
      expertise: expPicks.length ? [...(ch.expertise || []), ...expPicks] : ch.expertise,
      metamagic: metaPicks.length ? [...(ch.metamagic || []), ...metaPicks] : ch.metamagic,
      pactBoon: boonPick || ch.pactBoon,
    });
  };

  const styleClass = pick === "Fighter" || (entry?.subclass === "Champion" && newClsLevel === 10) ? "Fighter" : pick;
  const gainsStyle = feats.some((f) => /Fighting Style/.test(f)) && FIGHTING_STYLES[styleClass];
  const styleOptions = gainsStyle ? FIGHTING_STYLES[styleClass].filter((f) => !(ch.styles || []).includes(f)) : [];
  const gainsTerrain = gainsSub && newSub === "Circle of the Land";
  const gainsExpertise = feats.some((f) => f.startsWith("Expertise"));
  const expPool = ch.skills.filter((sk) => !(ch.expertise || []).includes(sk));
  const gainsMeta = pick === "Sorcerer" && feats.some((f) => f.startsWith("Metamagic"));
  const metaNeed = newClsLevel === 3 ? 2 : 1;
  const metaPool = METAMAGIC.filter((m) => !(ch.metamagic || []).includes(m));
  const gainsBoon = feats.some((f) => f === "Pact Boon");

  /* ---- BG3-style gained choices: invocations, cantrips, spells, arcanum ---- */
  const effSub = gainsSub ? (gainsTerrain && terrPick ? `${newSub} (${terrPick})` : newSub) : entry?.subclass;
  const book = ch.spells?.[pick] || { cantrips: [], spells: [] };
  const pool = customs?.spells || [];
  const fits = (sp) => spellFitsClass(sp, pick, effSub);

  // Eldritch invocations — pick new ones when the known cap rises, swap one freely
  const curInv = ch.invocations || [];
  const invCap = pick === "Warlock" ? INVOCATIONS(newClsLevel) : 0;
  const invNeed = Math.max(0, invCap - curInv.length);
  const canSwapInv = pick === "Warlock" && invCap > 0 && curInv.length > 0;
  const futureCantrips = [...(book.cantrips || []), ...cantripPicks];
  const hasEB = futureCantrips.some((n) => /eldritch blast/i.test(n));
  const boonHeld = boonPick || ch.pactBoon;
  const invReqMet = (req) => !req || (req === "eldritch blast cantrip" ? hasEB : boonHeld === req);
  const invTaken = [...curInv.filter((n) => n !== invSwapOut), ...invPicks, ...(invSwapIn ? [invSwapIn] : [])];
  const invOptions = INVOCATION_DATA.filter(([n, lvl]) => newClsLevel >= lvl && !invTaken.includes(n));

  // Cantrips and spells known — required picks are what this level grants; deficits may be filled too
  const sortSp = (a, b) => a.level - b.level || a.name.localeCompare(b.name);
  const cantripTarget = CANTRIPS_KNOWN[pick] ? CANTRIPS_KNOWN[pick](newClsLevel) : 0;
  const cantripPrev = entry && CANTRIPS_KNOWN[pick] ? CANTRIPS_KNOWN[pick](newClsLevel - 1) : 0;
  const cantripAllow = Math.max(0, cantripTarget - (book.cantrips || []).length);
  const cantripPool = pick ? pool.filter((sp) => sp.level === 0 && fits(sp) && !(book.cantrips || []).includes(sp.name)).sort(sortSp) : [];
  const cantripReq = Math.min(Math.max(0, cantripTarget - cantripPrev), cantripAllow, cantripPool.length);
  const gainsCantrips = cantripAllow > 0 && cantripPool.length > 0;

  const knownCaster = !!SPELLS_KNOWN[pick];
  const spellTarget = knownCaster ? SPELLS_KNOWN[pick][newClsLevel - 1] : pick === "Wizard" ? 6 + 2 * (newClsLevel - 1) : 0;
  const spellPrev = entry ? (knownCaster ? SPELLS_KNOWN[pick][newClsLevel - 2] || 0 : pick === "Wizard" ? 6 + 2 * (newClsLevel - 2) : 0) : 0;
  const maxLvlNew = pick ? maxSpellLevel(pick, newClsLevel) : 0;
  const spellAllow = Math.max(0, spellTarget - (book.spells || []).length);
  const spellPool = pick ? pool.filter((sp) => sp.level >= 1 && sp.level <= maxLvlNew && fits(sp) && !(book.spells || []).includes(sp.name)).sort(sortSp) : [];
  const spellReq = Math.min(Math.max(0, spellTarget - spellPrev), spellAllow, spellPool.length);
  const gainsSpells = spellAllow > 0 && spellPool.length > 0;
  const canSwapSpell = knownCaster && (book.spells || []).length > 0 && spellPool.length > 0;

  // Mystic Arcanum — one spell of the unlocked level at Warlock 11/13/15/17
  const arcLvlGained = pick === "Warlock" ? { 11: 6, 13: 7, 15: 8, 17: 9 }[newClsLevel] : null;
  const arcPool = arcLvlGained && !ch.spells?.Warlock?.arcanum?.[arcLvlGained]
    ? pool.filter((sp) => sp.level === arcLvlGained && fits(sp)).sort(sortSp) : [];
  const gainsArcanum = arcPool.length > 0;

  // Book of Ancient Secrets — two 1st-level rituals from any class when the invocation is taken
  const takingBoAS = invPicks.includes("Book of Ancient Secrets") || invSwapIn === "Book of Ancient Secrets";
  const boasPool = takingBoAS && !(ch.boasRituals || []).length
    ? pool.filter((sp) => sp.level === 1 && sp.ritual && !boasPicks.includes(sp.name)).sort(sortSp) : [];
  const gainsBoAS = boasPool.length > 0 || boasPicks.length > 0;

  // Pact of the Tome — three cantrips from any class's list
  const tomePool = boonPick === "Pact of the Tome" ? pool.filter((sp) => sp.level === 0).sort(sortSp) : [];
  const gainsTome = tomePool.length > 0;

  // Magical Secrets — Bard 10/14/18 (counted in spells known) and College of Lore 6 (extra)
  const secretsN = pick === "Bard"
    ? ([10, 14, 18].includes(newClsLevel) ? 2 : 0) + (baseSubName(effSub || "") === "College of Lore" && newClsLevel === 6 ? 2 : 0) : 0;
  const secretsPool = secretsN > 0
    ? pool.filter((sp) => !isTechnique(sp) && sp.level >= 1 && sp.level <= maxLvlNew && !(book.spells || []).includes(sp.name) && !spellPicks.includes(sp.name)).sort(sortSp) : [];
  const gainsSecrets = secretsPool.length > 0 || secretsPicks.length > 0;
  const secretsReq = Math.min(secretsN, secretsPool.length + secretsPicks.length);
  const countedSecrets = pick === "Bard" && [10, 14, 18].includes(newClsLevel) ? 2 : 0;
  const spellReqNet = Math.max(0, Math.min(spellReq, spellAllow - Math.min(countedSecrets, secretsPicks.length)));

  // Ranger — additional Favored Enemy (6, 14) and Natural Explorer terrain (6, 10)
  const rc = ch.rangerChoices || {};
  const enemiesTaken = [rc.favEnemy, ...(rc.extraEnemies || [])].filter(Boolean);
  const terrainsTaken = [rc.natTerrain, ...(rc.extraTerrains || [])].filter(Boolean);
  const gainsFavEnemy = pick === "Ranger" && [6, 14].includes(newClsLevel);
  const gainsNatTerrain = pick === "Ranger" && [6, 10].includes(newClsLevel);

  // Wizard — Spell Mastery (18: one 1st- and one 2nd-level from the spellbook), Signature Spell (20: two 3rd-level)
  const spLevel = (n) => pool.find((sp) => sp.name === n)?.level;
  const masteryPools = pick === "Wizard" && newClsLevel === 18 && !ch.choices?.["Spell Mastery"]
    ? { 1: (book.spells || []).filter((n) => spLevel(n) === 1), 2: (book.spells || []).filter((n) => spLevel(n) === 2) } : null;
  const gainsMastery = !!masteryPools && (masteryPools[1].length > 0 || masteryPools[2].length > 0);
  const signaturePool = pick === "Wizard" && newClsLevel === 20 && !ch.choices?.["Signature Spell"]
    ? (book.spells || []).filter((n) => spLevel(n) === 3) : [];
  const gainsSignature = signaturePool.length > 0;

  // Subclass option groups (maneuvers, disciplines, totems, shots, runes…) with catch-up for missed levels
  const choiceGroupsDue = CHOICE_GROUPS.map((g) => {
    if (!pick || !groupMatches(g, pick, effSub)) return null;
    const options = choiceOptionsFor(g, customs);
    if (!options.length) return null;
    const held = ch.choices?.[g.key] || [];
    const avail = options.filter((o) => !held.includes(o.name) && (!o.minLvl || o.minLvl <= newClsLevel));
    const need = Math.min(Math.max(0, choiceCum(g, newClsLevel) - held.filter((n) => !(g.grant && Object.values(g.grant).flat().includes(n))).length), avail.length);
    return need > 0 ? { g, avail, need, held } : null;
  }).filter(Boolean);

  const preparedCaster = ["Cleric", "Druid", "Paladin"].includes(pick);

  const extrasNeeded = gainsASI || gainsSub || gainsMcSkill || gainsStyle || gainsExpertise || gainsMeta || gainsBoon ||
    invNeed > 0 || canSwapInv || gainsCantrips || gainsSpells || canSwapSpell || gainsArcanum ||
    gainsBoAS || gainsTome || gainsSecrets || gainsFavEnemy || gainsNatTerrain || gainsMastery || gainsSignature ||
    choiceGroupsDue.length > 0;
  const extrasDone =
    (!gainsASI || (asiMode === "feat" && featPick && (!(allFeats(customs).find((f) => f.name === featPick)?.bump?.length) || featBump)) || (asiMode === "asi" && asiPicks.length === 2)) &&
    (!gainsSub || newSub) && (!gainsMcSkill || mcSkill) && (!gainsStyle || stylePick) && (!gainsTerrain || terrPick) &&
    (!gainsExpertise || expPicks.length === Math.min(2, expPool.length)) && (!gainsMeta || metaPicks.length === metaNeed) && (!gainsBoon || boonPick) &&
    invPicks.length >= invNeed && !!invSwapOut === !!invSwapIn &&
    cantripPicks.length >= cantripReq && spellPicks.length >= spellReqNet && !!spellSwapOut === !!spellSwapIn &&
    (!gainsArcanum || arcanumPick) &&
    (!gainsBoAS || boasPicks.length >= Math.min(2, boasPool.length + boasPicks.length)) &&
    (!gainsTome || tomePicks.length >= Math.min(3, tomePool.length)) &&
    secretsPicks.length >= secretsReq &&
    (!gainsFavEnemy || favEnemyPick) && (!gainsNatTerrain || terrainPick2) &&
    (!gainsMastery || ((masteryPools[1].length === 0 || masteryPicks[1]) && (masteryPools[2].length === 0 || masteryPicks[2]))) &&
    (!gainsSignature || signaturePicks.length >= Math.min(2, signaturePool.length)) &&
    choiceGroupsDue.every((d) => (groupPicks[d.g.key] || []).length >= d.need);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 50, overflowY: "auto", padding: "calc(30px + env(safe-area-inset-top)) 14px calc(30px + env(safe-area-inset-bottom))" }}>
      <div style={{ ...card, maxWidth: 640, margin: "0 auto", padding: 22 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.gold, marginBottom: 4 }}>Level {lvl} → {lvl + 1}</div>
        <div style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>{ch.name} · proficiency bonus becomes +{profBonus(lvl + 1)}</div>

        {stage === "class" && (
          <div>
            <div style={{ color: T.ink, marginBottom: 10 }}>Advance an existing class, or multiclass into a new one:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {options.map((o) => {
                const e = ch.classes.find((c) => c.name === o.name);
                return (
                  <div key={o.name} onClick={() => o.ok && setPick(o.name)}
                    style={{ ...card, background: pick === o.name ? T.panel2 : T.panel, borderColor: pick === o.name ? T.gold : T.edge, padding: 12, cursor: o.ok ? "pointer" : "not-allowed", opacity: o.ok ? 1 : 0.45 }}>
                    <div style={{ fontFamily: "Georgia, serif", color: pick === o.name ? T.gold : T.ink }}>
                      <ClassTag name={o.name} /> {e ? `${e.level} → ${e.level + 1}` : <span style={{ color: T.blood, fontSize: 12 }}>new</span>}
                    </div>
                    {!o.ok && <div style={{ color: T.blood, fontSize: 11, marginTop: 4 }}>{o.why}</div>}
                    {o.ok && o.isNew && <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>Grants: {MC_PROFS[o.name]}</div>}
                  </div>
                );
              })}
            </div>
            {pick && feats.length > 0 && (
              <div style={{ marginTop: 12, color: T.dim, fontSize: 13 }}>
                At {pick} {newClsLevel}: {feats.map((f, i) => <span key={f}>{i > 0 ? ", " : ""}<span {...lorePress(f)} style={{ color: T.ink }}>{f}</span></span>)}
                <div style={{ fontSize: 11, marginTop: 4 }}>Long-press any feature to read its full rules — details follow after hit points.</div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <button style={btn(false)} onClick={onCancel}>Cancel</button>
              <button style={{ ...btn(true), opacity: pick ? 1 : 0.4 }} disabled={!pick} onClick={() => setStage("hp")}>Choose Hit Points</button>
            </div>
          </div>
        )}

        {stage === "hp" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: T.ink, marginBottom: 14 }}>Hit points for {pick} level {newClsLevel} — d{pickData.die} {fmtMod(conM)} CON{dwarfBonus ? " +1" : ""}</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={btn(false)} onClick={() => { setHpGain(avg); setStage(extrasNeeded ? "extras" : "confirm"); }}>
                Take average ({avg})
              </button>
              <button style={btn(true)} onClick={() => setRollingHp(true)}><Icon name="d20" /> Roll the d{pickData.die}</button>
            </div>
            {rollingHp && (
              <DiceTray title={`Rolling 1d${pickData.die} for hit points`} dice={[{ sides: pickData.die, value: roll(pickData.die) }]}
                note="No rerolls. The bones do not negotiate." acceptLabel="Accept fate"
                onAccept={(total) => { setHpGain(total); setRollingHp(false); setStage(extrasNeeded ? "extras" : "confirm"); }} />
            )}
          </div>
        )}

        {stage === "extras" && (
          <div>
            {feats.length > 0 && (
              <div style={{ ...card, background: T.panel2, borderColor: T.gold, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, fontFamily: "Georgia, serif", marginBottom: 2 }}>{pick} {newClsLevel} grants</div>
                {feats.filter((f) => !(featSub && /\bfeature\b$/i.test(f))).map((f) => <FeatureLine key={f} name={f} cls={pick} customs={customs} />)}
              </div>
            )}
            {gainsSub && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>{pickData.subName}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {allSubs(pick, customs).map((s) => <button key={s} {...lorePress(s)} style={{ ...btn(newSub === s), padding: "6px 14px" }} onClick={() => { setNewSub(s); setTerrPick(null); }}>{s}</button>)}
                </div>
                {gainsTerrain && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: T.gold, fontSize: 13, marginBottom: 6 }}>Choose your land — it decides your circle spells</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.keys(LAND_TERRAINS).map((t) => (
                        <button key={t} style={{ ...btn(terrPick === t), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setTerrPick(t)}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {newSub
                  ? <SubclassDetail name={newSub} cls={pick} customs={customs} nowLevel={newClsLevel} terrain={terrPick} />
                  : <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Select one to read everything it grants — now and at every level to come.</div>}
              </div>
            )}
            {gainsASI && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Ability Score Improvement</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button style={{ ...btn(asiMode === "asi"), padding: "6px 12px" }} onClick={() => { setAsiMode("asi"); setFeatPick(null); }}>+1 to two abilities</button>
                  <button style={{ ...btn(asiMode === "feat"), padding: "6px 12px" }} onClick={() => { setAsiMode("feat"); setAsiPicks([]); }}>Take a feat</button>
                </div>
                {asiMode === "feat" && (
                  <div style={{ display: "grid", gap: 6 }}>
                    {allFeats(customs).filter((f) => !(ch.feats || []).includes(f.name)).map((f) => (
                      <div key={f.name} {...lorePress(f.name)} onClick={() => { setFeatPick(f.name); setFeatBump(null); }}
                        style={{ ...card, background: featPick === f.name ? T.panel : T.panel2, borderColor: featPick === f.name ? T.gold : T.edge, padding: "8px 12px", cursor: "pointer" }}>
                        <span style={{ color: featPick === f.name ? T.gold : T.ink, fontWeight: 700 }}>{f.name}</span>
                        <span style={{ color: T.dim, fontSize: 12 }}> — {f.desc}</span>
                        {f.prereq && <div style={{ color: T.blood, fontSize: 11, marginTop: 2 }}>Prerequisite: {f.prereq}</div>}
                        {featPick === f.name && f.bump?.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ color: T.gold, fontSize: 12 }}>+1 to:</span>
                            {f.bump.map((a) => (
                              <button key={a} disabled={ch.abilities[a] >= 20}
                                style={{ ...btn(featBump === a), padding: "4px 10px", fontSize: 13, minHeight: 0 }}
                                onClick={(e) => { e.stopPropagation(); setFeatBump(a); }}>
                                {a.toUpperCase()} {ch.abilities[a]}{featBump === a ? ` → ${ch.abilities[a] + 1}` : ""}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {asiMode === "asi" && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ABILITIES.map((a) => (
                      <button key={a} disabled={ch.abilities[a] + (asiPicks.filter((x) => x === a).length) >= 20}
                        style={{ ...btn(false), padding: "5px 10px", fontSize: 13, borderColor: asiPicks.includes(a) ? T.gold : T.edge, background: asiPicks.filter((x) => x === a).length ? T.blood : "transparent", color: T.ink }}
                        onClick={() => setAsiPicks(asiPicks.length < 2 ? [...asiPicks, a] : [asiPicks[1], a])}>
                        {a.toUpperCase()} {ch.abilities[a]}{asiPicks.filter((x) => x === a).length ? ` → ${ch.abilities[a] + asiPicks.filter((x) => x === a).length}` : ""}
                      </button>
                    ))}
                  </div>
                )}
                {asiMode === "asi" && <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>Pick two (the same ability twice = +2). Max 20.</div>}
              </div>
            )}
            {gainsStyle && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Fighting Style</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {styleOptions.map((f) => (
                    <div key={f} {...lorePress("Fighting Style: " + f)} onClick={() => setStylePick(f)}
                      style={{ ...card, background: stylePick === f ? T.panel : T.panel2, borderColor: stylePick === f ? T.gold : T.edge, padding: "8px 12px", cursor: "pointer" }}>
                      <span style={{ color: stylePick === f ? T.gold : T.ink, fontWeight: 700 }}>{f}</span>
                      <span style={{ color: T.dim, fontSize: 12 }}> — {STYLE_DESC[f]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {gainsExpertise && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Expertise — double proficiency on two skills ({expPicks.length}/2)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {expPool.map((sk) => (
                    <button key={sk} {...lorePress(sk)} style={{ ...btn(expPicks.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setExpPicks(expPicks.includes(sk) ? expPicks.filter((x) => x !== sk) : expPicks.length < 2 ? [...expPicks, sk] : expPicks)}>{sk}</button>
                  ))}
                </div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>Rogues may instead apply one to thieves' tools — note it in Notes if so.</div>
              </div>
            )}
            {gainsMeta && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Metamagic — choose {metaNeed} ({metaPicks.length}/{metaNeed})</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {metaPool.map((m) => (
                    <button key={m} {...lorePress(m)} style={{ ...btn(metaPicks.includes(m)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setMetaPicks(metaPicks.includes(m) ? metaPicks.filter((x) => x !== m) : metaPicks.length < metaNeed ? [...metaPicks, m] : metaPicks)}>{m}</button>
                  ))}
                </div>
              </div>
            )}
            {gainsBoon && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Pact Boon</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PACT_BOONS.map((b) => <button key={b} {...lorePress(b)} style={{ ...btn(boonPick === b), padding: "6px 14px" }} onClick={() => setBoonPick(b)}>{b}</button>)}
                </div>
              </div>
            )}
            {invNeed > 0 && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Eldritch Invocations — choose {invNeed} ({invPicks.length}/{invNeed})</div>
                <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${T.edge}`, borderRadius: 8 }}>
                  {invOptions.concat(invPicks.map((n) => INVOCATION_DATA.find(([x]) => x === n))).sort((a, b) => a[0].localeCompare(b[0])).map(([n, lvl, req]) => {
                    const on = invPicks.includes(n);
                    const ok = on || (invReqMet(req) && invPicks.length < invNeed);
                    return (
                      <div key={n} {...lorePress(n)} onClick={() => ok && setInvPicks(on ? invPicks.filter((x) => x !== n) : [...invPicks, n])}
                        style={{ padding: "8px 10px", borderBottom: `1px solid ${T.edge}`, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.45, background: on ? T.panel : "transparent" }}>
                        <span style={{ color: on ? T.gold : T.ink, fontWeight: on ? 700 : 400 }}>{on ? "✓ " : ""}{n}</span>
                        {(lvl > 0 || req) && <span style={{ color: T.dim, fontSize: 12 }}> · requires {[lvl > 0 ? `warlock ${lvl}` : "", req].filter(Boolean).join(", ")}</span>}
                        {!on && !invReqMet(req) && <span style={{ color: T.blood, fontSize: 11 }}> ({req === "eldritch blast cantrip" ? "learn Eldritch Blast first" : "boon not held"})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {canSwapInv && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Swap an invocation <span style={{ color: T.dim, fontSize: 12 }}>(optional — one per level-up)</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: invSwapOut ? 8 : 0 }}>
                  {curInv.map((n) => (
                    <button key={n} {...lorePress(n)} style={{ ...btn(invSwapOut === n), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => { setInvSwapOut(invSwapOut === n ? null : n); setInvSwapIn(null); }}>{invSwapOut === n ? `✕ ${n}` : n}</button>
                  ))}
                </div>
                {invSwapOut && (
                  <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${T.edge}`, borderRadius: 8 }}>
                    {invOptions.map(([n, lvl, req]) => {
                      const ok = invReqMet(req);
                      return (
                        <div key={n} {...lorePress(n)} onClick={() => ok && setInvSwapIn(invSwapIn === n ? null : n)}
                          style={{ padding: "8px 10px", borderBottom: `1px solid ${T.edge}`, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.45, background: invSwapIn === n ? T.panel : "transparent" }}>
                          <span style={{ color: invSwapIn === n ? T.gold : T.ink }}>{invSwapIn === n ? "✓ " : ""}{n}</span>
                          {(lvl > 0 || req) && <span style={{ color: T.dim, fontSize: 12 }}> · requires {[lvl > 0 ? `warlock ${lvl}` : "", req].filter(Boolean).join(", ")}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {gainsCantrips && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>New cantrips — choose {cantripReq}{cantripAllow > cantripReq ? ` (up to ${cantripAllow})` : ""} ({cantripPicks.length}/{cantripReq})</div>
                <SpellPickGrid options={cantripPool} picks={cantripPicks} cap={cantripAllow} onChange={setCantripPicks} placeholder="Search cantrips…" />
              </div>
            )}
            {gainsSpells && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>
                  {pick === "Wizard" ? "Scribe spells into your spellbook" : "New spells known"} — choose {spellReqNet}{spellAllow > spellReqNet ? ` (up to ${spellAllow})` : ""} ({spellPicks.length}/{spellReqNet})
                </div>
                <SpellPickGrid options={spellPool.filter((sp) => sp.name !== spellSwapIn)} picks={spellPicks} cap={spellAllow} onChange={setSpellPicks} />
              </div>
            )}
            {canSwapSpell && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Replace a known spell <span style={{ color: T.dim, fontSize: 12 }}>(optional — one per level-up)</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: spellSwapOut ? 8 : 0 }}>
                  {(book.spells || []).map((n) => (
                    <button key={n} {...lorePress(n)} style={{ ...btn(spellSwapOut === n), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => { setSpellSwapOut(spellSwapOut === n ? null : n); setSpellSwapIn(null); }}>{spellSwapOut === n ? `✕ ${n}` : n}</button>
                  ))}
                </div>
                {spellSwapOut && (
                  <SpellPickGrid options={spellPool.filter((sp) => !spellPicks.includes(sp.name))} picks={spellSwapIn ? [spellSwapIn] : []} cap={1}
                    onChange={(arr) => setSpellSwapIn(arr[arr.length - 1] || null)} placeholder="Search a replacement…" />
                )}
              </div>
            )}
            {gainsArcanum && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Mystic Arcanum — choose one {arcLvlGained}th-level spell</div>
                <SpellPickGrid options={arcPool} picks={arcanumPick ? [arcanumPick] : []} cap={1}
                  onChange={(arr) => setArcanumPick(arr[arr.length - 1] || null)} placeholder="Search arcanum…" />
              </div>
            )}
            {gainsBoAS && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Book of Ancient Secrets — inscribe two 1st-level rituals ({boasPicks.length}/2)</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>From any class's list. Rituals you find later can be added in the Grimoire's Book of Shadows.</div>
                <SpellPickGrid options={boasPool} picks={boasPicks} cap={2} onChange={setBoasPicks} placeholder="Search ritual spells…" />
              </div>
            )}
            {gainsTome && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Pact of the Tome — choose three cantrips ({tomePicks.length}/3)</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>From any class's list. They're castable at will from your Book of Shadows.</div>
                <SpellPickGrid options={tomePool} picks={tomePicks} cap={3} onChange={setTomePicks} placeholder="Search cantrips…" />
              </div>
            )}
            {gainsSecrets && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Magical Secrets — choose {secretsN} from ANY class ({secretsPicks.length}/{secretsN})</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>Any spell of a level you can cast, from any class's list.</div>
                <SpellPickGrid options={secretsPool} picks={secretsPicks} cap={secretsN} onChange={setSecretsPicks} />
              </div>
            )}
            {gainsFavEnemy && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Additional Favored Enemy</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FAVORED_ENEMIES.filter((e) => !enemiesTaken.includes(e)).map((e) => (
                    <button key={e} style={{ ...btn(favEnemyPick === e), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setFavEnemyPick(e)}>{e}</button>
                  ))}
                </div>
              </div>
            )}
            {gainsNatTerrain && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Additional Natural Explorer Terrain</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {NE_TERRAINS.filter((t) => !terrainsTaken.includes(t)).map((t) => (
                    <button key={t} style={{ ...btn(terrainPick2 === t), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setTerrainPick2(t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}
            {gainsMastery && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Spell Mastery — one 1st- and one 2nd-level spell from your spellbook</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>You can cast them at their lowest level without expending a slot.</div>
                {[1, 2].map((l) => masteryPools[l].length > 0 && (
                  <div key={l} style={{ marginBottom: 6 }}>
                    <span style={{ color: T.dim, fontSize: 12 }}>Level {l}: </span>
                    {masteryPools[l].map((n) => (
                      <button key={n} {...lorePress(n)} style={{ ...btn(masteryPicks[l] === n), padding: "4px 10px", fontSize: 13, minHeight: 0, margin: 2 }}
                        onClick={() => setMasteryPicks({ ...masteryPicks, [l]: masteryPicks[l] === n ? null : n })}>{n}</button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {gainsSignature && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 4 }}>Signature Spells — two 3rd-level spells from your spellbook ({signaturePicks.length}/2)</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>Always prepared; each castable once per short rest without a slot.</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {signaturePool.map((n) => (
                    <button key={n} {...lorePress(n)} style={{ ...btn(signaturePicks.includes(n)), padding: "4px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setSignaturePicks(signaturePicks.includes(n) ? signaturePicks.filter((x) => x !== n) : signaturePicks.length < 2 ? [...signaturePicks, n] : signaturePicks)}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            {choiceGroupsDue.map((d) => (
              <div key={d.g.key} style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>{d.g.key} — choose {d.need} ({(groupPicks[d.g.key] || []).length}/{d.need})</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {d.avail.map((o) => {
                    const on = (groupPicks[d.g.key] || []).includes(o.name);
                    return (
                      <button key={o.name} {...lorePress(o.name)} style={{ ...btn(on), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                        onClick={() => { const cur = groupPicks[d.g.key] || []; setGroupPicks({ ...groupPicks, [d.g.key]: on ? cur.filter((x) => x !== o.name) : cur.length < d.need ? [...cur, o.name] : cur }); }}>
                        {baseSubName(o.name.replace(/^[^:]+:\s*/, ""))}{o.minLvl ? ` (lvl ${o.minLvl}+)` : ""}
                      </button>
                    );
                  })}
                </div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>Long-press any option to read its full text.</div>
              </div>
            ))}
            {preparedCaster && (
              <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>
                {pick} prepares spells daily — your prepared count rises with this level. Adjust anytime in the Grimoire.
              </div>
            )}
            {gainsMcSkill && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Multiclass skill ({pick} grants one)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CLASSES[pick].skills.filter((s) => !ch.skills.includes(s)).map((s) => (
                    <button key={s} {...lorePress(s)} style={{ ...btn(mcSkill === s), padding: "5px 10px", fontSize: 13 }} onClick={() => setMcSkill(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={{ ...btn(true), opacity: extrasDone ? 1 : 0.4 }} disabled={!extrasDone} onClick={() => setStage("confirm")}>Review</button>
            </div>
          </div>
        )}

        {stage === "confirm" && (
          <div>
            <div style={{ color: T.ink, lineHeight: 1.8 }}>
              <b style={{ color: T.gold }}>{pick} {newClsLevel}</b> · +{hpGain + conM + dwarfBonus} HP ({hpGain === avg ? "average" : "rolled"} {hpGain} {fmtMod(conM)}{dwarfBonus ? " +1" : ""})<br />
              {gainsSub && newSub && <>{pickData.subName}: <b style={{ color: T.gold }}>{newSub}</b><br /></>}
              {asiMode === "asi" && <>ASI: {asiPicks.map((a) => a.toUpperCase() + " +1").join(", ")}<br /></>}
              {asiMode === "feat" && <>Feat: {featPick}<br /></>}
              {mcSkill && <>New skill: {mcSkill}<br /></>}
              {invPicks.length > 0 && <>Invocations: <b style={{ color: T.gold }}>{invPicks.join(", ")}</b><br /></>}
              {invSwapOut && invSwapIn && <>Invocation swap: {invSwapOut} → <b style={{ color: T.gold }}>{invSwapIn}</b><br /></>}
              {cantripPicks.length > 0 && <>Cantrips: <b style={{ color: T.gold }}>{cantripPicks.join(", ")}</b><br /></>}
              {spellPicks.length > 0 && <>Spells: <b style={{ color: T.gold }}>{spellPicks.join(", ")}</b><br /></>}
              {spellSwapOut && spellSwapIn && <>Spell swap: {spellSwapOut} → <b style={{ color: T.gold }}>{spellSwapIn}</b><br /></>}
              {arcanumPick && <>Mystic Arcanum: <b style={{ color: T.gold }}>{arcanumPick}</b><br /></>}
              {takingBoAS && boasPicks.length > 0 && <>Book of Shadows rituals: <b style={{ color: T.gold }}>{boasPicks.join(", ")}</b><br /></>}
              {tomePicks.length > 0 && <>Tome cantrips: <b style={{ color: T.gold }}>{tomePicks.join(", ")}</b><br /></>}
              {secretsPicks.length > 0 && <>Magical Secrets: <b style={{ color: T.gold }}>{secretsPicks.join(", ")}</b><br /></>}
              {favEnemyPick && <>Favored Enemy: <b style={{ color: T.gold }}>{favEnemyPick}</b><br /></>}
              {terrainPick2 && <>Natural Explorer: <b style={{ color: T.gold }}>{terrainPick2}</b><br /></>}
              {(masteryPicks[1] || masteryPicks[2]) && <>Spell Mastery: <b style={{ color: T.gold }}>{[masteryPicks[1], masteryPicks[2]].filter(Boolean).join(", ")}</b><br /></>}
              {signaturePicks.length > 0 && <>Signature Spells: <b style={{ color: T.gold }}>{signaturePicks.join(", ")}</b><br /></>}
              {choiceGroupsDue.filter((d) => (groupPicks[d.g.key] || []).length).map((d) => (
                <span key={d.g.key}>{d.g.key}: <b style={{ color: T.gold }}>{groupPicks[d.g.key].map((n) => baseSubName(n.replace(/^[^:]+:\s*/, ""))).join(", ")}</b><br /></span>
              ))}
              {feats.length > 0 && <>Features: {feats.join(", ")}</>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <button style={btn(false)} onClick={onCancel}>Cancel</button>
              <button style={btn(true)} onClick={applyLevel}>Seal the Level</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ GRIMOIRE (SPELL MANAGEMENT) ============ */
/* ============ INVENTORY & EQUIPMENT ============ */
function InventoryCard({ ch, customs, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [usableOnly, setUsableOnly] = useState(true);
  const [freeText, setFreeText] = useState("");
  const inv = ch.inventory || [];
  const pool = customs?.items || [];
  const save = (rows) => onUpdate({ inventory: rows });
  const totalWeight = inv.reduce((s, r) => s + ((findItem(r.name, customs)?.weight || 0) * (r.qty || 1)), 0);
  const capacity = ch.abilities.str * 15;
  const equip = (row) => {
    const it = findItem(row.name, customs);
    save(inv.map((r) => {
      if (r.name === row.name) return { ...r, equipped: !r.equipped };
      if (!it || !r.equipped) return r;
      const other = findItem(r.name, customs);
      // one suit of armor, one shield at a time
      if (other && ((isArmorType(it.type) && isArmorType(other.type)) || (it.type === "S" && other.type === "S"))) return { ...r, equipped: false };
      return r;
    }));
  };
  const shown = pool.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()))
    .filter((x) => !usableOnly || !(isArmorType(x.type) || x.type === "S" || isWeaponType(x.type)) || canEquip(x, ch))
    .sort((a, b) => searchRank(a.name, q) - searchRank(b.name, q) || a.name.localeCompare(b.name));
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Inventory</div>
        <div style={{ color: totalWeight > capacity ? T.blood : T.dim, fontSize: 12 }}>{totalWeight.toFixed(0)} / {capacity} lb{totalWeight > capacity ? " — over capacity!" : ""}</div>
      </div>
      {inv.length === 0 && <div style={{ color: T.dim, fontSize: 13, margin: "8px 0" }}>Empty packs win no battles. Add gear below — equip armor, shields, and weapons to power your AC and attack buttons.</div>}
      {inv.map((row) => {
        const it = findItem(row.name, customs);
        const equippable = it && (isArmorType(it.type) || it.type === "S" || isWeaponType(it.type));
        return (
          <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.edge}`, flexWrap: "wrap" }}>
            <span {...lorePress(row.name)} style={{ color: row.equipped ? T.gold : T.ink, fontWeight: row.equipped ? 700 : 400, flex: 1, minWidth: 120 }}>
              {row.name}
              <span style={{ color: T.dim, fontWeight: 400, fontSize: 11 }}> {it ? `· ${ITEM_TYPES[it.type] || it.type}${it.ac ? ` · AC ${it.type === "S" ? "+" : ""}${it.ac}` : ""}${it.dmg1 ? ` · ${it.dmg1}` : ""}${it.weight ? ` · ${it.weight} lb` : ""}` : ""}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.dim, fontSize: 13 }}>
              <button style={{ ...btn(false), padding: "1px 8px", minHeight: 0, fontSize: 13 }} onClick={() => save(inv.map((r) => (r.name === row.name ? { ...r, qty: Math.max(1, (r.qty || 1) - 1) } : r)))}>−</button>
              {row.qty || 1}
              <button style={{ ...btn(false), padding: "1px 8px", minHeight: 0, fontSize: 13 }} onClick={() => save(inv.map((r) => (r.name === row.name ? { ...r, qty: (r.qty || 1) + 1 } : r)))}>＋</button>
            </span>
            {equippable && (canEquip(it, ch)
              ? (
                <button style={{ ...btn(!!row.equipped), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => equip(row)}>
                  {row.equipped ? "✓ Equipped" : "Equip"}
                </button>
              )
              : <span style={{ color: T.blood, fontSize: 11 }}>not proficient</span>)}
            <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700, padding: "0 4px" }} onClick={() => save(inv.filter((r) => r.name !== row.name))}>✕</span>
          </div>
        );
      })}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pool.length > 0 && <button style={{ ...btn(true), padding: "6px 14px" }} onClick={() => { setOpen(true); setQ(""); }}>＋ Add from compendium</button>}
        <input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="or type any item + Enter"
          onKeyDown={(e) => { if (e.key === "Enter" && freeText.trim() && !inv.some((r) => r.name === freeText.trim())) { save([...inv, { name: freeText.trim(), qty: 1 }]); setFreeText(""); } }}
          style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, flex: 1, minWidth: 160 }} />
      </div>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setOpen(false)}>
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "75vh", display: "flex", flexDirection: "column", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ color: T.gold, fontFamily: "Georgia, serif" }}>Add gear <span style={{ color: T.dim, fontSize: 12 }}>· long-press to inspect first</span></div>
              <button style={{ ...btn(usableOnly), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => setUsableOnly(!usableOnly)}>
                {usableOnly ? `✓ Usable by ${ch.name}` : "Showing everything"}
              </button>
            </div>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…"
              style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 }} />
            <LazyList items={shown} resetKey={`${q}|${usableOnly}`}
              empty={<div style={{ color: T.dim, fontSize: 13, padding: 8 }}>Nothing matches.</div>}
              render={(it) => (
                <div key={it.name} {...lorePress(it.name)} onClick={() => {
                  const has = inv.find((r) => r.name === it.name);
                  save(has ? inv.map((r) => (r.name === it.name ? { ...r, qty: (r.qty || 1) + 1 } : r)) : [...inv, { name: it.name, qty: 1 }]);
                  setOpen(false);
                }} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.edge}`, cursor: "pointer" }}>
                  <span style={{ color: T.ink }}>{it.name}</span>
                  <span style={{ color: T.dim, fontSize: 12 }}> · {ITEM_TYPES[it.type] || it.type}{it.ac ? ` · AC ${it.type === "S" ? "+" : ""}${it.ac}` : ""}{it.dmg1 ? ` · ${it.dmg1} ${DMG_TYPES[it.dmgType] || ""}` : ""}{it.value ? ` · ${it.value} gp` : ""}{sourceOf(it.text) ? ` · ${sourceOf(it.text)}` : ""}</span>
                </div>
              )} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ INVOCATIONS (sheet management) ============ */
function InvocationManager({ ch, onInvocations }) {
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const [open, setOpen] = useState(false);
  if (!wl || wl.level < 2) return null;
  const cap = INVOCATIONS(wl.level);
  const mine = ch.invocations || [];
  const knownCantrips = ch.spells?.Warlock?.cantrips || [];
  const hasEB = knownCantrips.some((n) => /eldritch blast/i.test(n));
  const reqMet = (req) => !req || (req === "eldritch blast cantrip" ? hasEB : ch.pactBoon === req);
  const options = INVOCATION_DATA.filter(([n, lvl]) => !mine.includes(n) && wl.level >= lvl);
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4 }}>Eldritch Invocations</div>
      <div style={{ color: mine.length > cap ? T.blood : T.dim, fontSize: 12, marginBottom: 8 }}>
        {mine.length}/{cap} known{ch.pactBoon ? ` · ${ch.pactBoon}` : ""} · swap freely on level-up per the rules
      </div>
      <div>
        {mine.map((n) => (
          <span key={n} {...lorePress(n)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
            {n}<span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => onInvocations(mine.filter((x) => x !== n))}>✕</span>
          </span>
        ))}
        {mine.length < cap && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => setOpen(true)}>＋ add</button>}
      </div>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setOpen(false)}>
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "75vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", marginBottom: 8 }}>Learn an invocation</div>
            {options.map(([n, lvl, req]) => {
              const ok = reqMet(req);
              return (
                <div key={n} {...lorePress(n)} onClick={() => { if (!ok) return; onInvocations([...mine, n]); setOpen(false); }}
                  style={{ padding: "10px 8px", borderBottom: `1px solid ${T.edge}`, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.45 }}>
                  <span style={{ color: T.ink }}>{n}</span>
                  <span style={{ color: T.dim, fontSize: 12 }}>{lvl > 0 || req ? ` · requires ${[lvl > 0 ? `${lvl}th level` : "", req].filter(Boolean).join(", ")}` : ""}</span>
                  {!ok && <span style={{ color: T.blood, fontSize: 11 }}> ({req === "eldritch blast cantrip" ? "learn Eldritch Blast first" : "boon not held"})</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const ARCANUM_UNLOCK = { 6: 11, 7: 13, 8: 15, 9: 17 }; // arcanum spell level -> warlock level

function SpellManager({ ch, customs, onSpells, onUpdate }) {
  const casters = ch.classes.filter((c) => CLASSES[c.name].caster);
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const hasBoAS = (ch.invocations || []).includes("Book of Ancient Secrets");
  const hasTome = ch.pactBoon === "Pact of the Tome";
  const [adding, setAdding] = useState(null); // { cls, kind: 'cantrips'|'spells'|'arcanum', lvl? }
  const [q, setQ] = useState("");
  if (!casters.length) return null;
  const book = ch.spells || {};
  const pool = customs?.spells || [];

  const expandedFor = (clsName) => {
    const e = ch.classes.find((c) => c.name === clsName);
    const data = e && subSpellData(e.subclass, clsName, customs);
    if (!data || data.type !== "expanded") return [];
    return Object.entries(data.spells).filter(([lvl]) => +lvl <= e.level)
      .flatMap(([, arr]) => arr).map((n) => pool.find((sp) => sp.name === n) || { name: n, level: SPELL_LVL_HINT[n] || 1, school: "", classes: clsName });
  };
  const listFor = (clsName, kind, arcLvl) => {
    if (kind === "boas") {
      const capLvl = Math.max(1, Math.ceil((wl?.level || 1) / 2));
      return pool.filter((sp) => sp.ritual && sp.level >= 1 && sp.level <= capLvl && !(ch.boasRituals || []).includes(sp.name))
        .filter((sp) => sp.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    }
    if (kind === "tome") {
      return pool.filter((sp) => sp.level === 0 && !(ch.tomeCantrips || []).includes(sp.name))
        .filter((sp) => sp.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }
    const entry = ch.classes.find((c) => c.name === clsName);
    const maxLvl = maxSpellLevel(clsName, entry.level);
    const extra = kind === "spells" ? expandedFor(clsName).filter((x) => !pool.some((sp) => sp.name === x.name && spellFitsClass(sp, clsName, entry.subclass))) : [];
    const taken = kind === "arcanum"
      ? Object.values(book[clsName]?.arcanum || {})
      : (book[clsName]?.[kind]) || [];
    return [...pool, ...extra]
      .filter((sp) => spellFitsClass(sp, clsName, entry.subclass) || extra.includes(sp))
      .filter((sp) => (kind === "cantrips" ? sp.level === 0 : kind === "arcanum" ? sp.level === arcLvl : sp.level >= 1 && sp.level <= maxLvl))
      .filter((sp) => !taken.includes(sp.name))
      .filter((sp) => sp.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (q ? searchRank(a.name, q) - searchRank(b.name, q) : 0) || a.level - b.level || a.name.localeCompare(b.name));
  };
  const setList = (clsName, kind, arr) =>
    onSpells({ ...book, [clsName]: { cantrips: [], spells: [], ...(book[clsName] || {}), [kind]: arr } });
  const setArcanum = (clsName, lvl, name) => {
    const arc = { ...(book[clsName]?.arcanum || {}) };
    if (name === null) delete arc[lvl]; else arc[lvl] = name;
    onSpells({ ...book, [clsName]: { cantrips: [], spells: [], ...(book[clsName] || {}), arcanum: arc } });
  };

  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4 }}>Grimoire</div>
      {pool.length === 0 && <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>No spell list loaded — import a compendium XML in the Homebrew Forge to enable pickers.</div>}
      {casters.map((c) => {
        const cap = spellCapacity(c.name, c.level, ch.abilities);
        const canCap = CANTRIPS_KNOWN[c.name] ? CANTRIPS_KNOWN[c.name](c.level) : 0;
        const maxLvl = maxSpellLevel(c.name, c.level);
        const mine = book[c.name] || { cantrips: [], spells: [] };
        const subData = subSpellData(c.subclass, c.name, customs);
        const grantedNow = subData?.type === "granted"
          ? Object.entries(subData.spells).filter(([lvl]) => +lvl <= c.level).flatMap(([, arr]) => arr) : [];
        const chip = (name, kind) => (
          <span key={name} {...lorePress(name)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
            {name}
            <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => setList(c.name, kind, mine[kind].filter((x) => x !== name))}>✕</span>
          </span>
        );
        return (
          <div key={c.name} style={{ marginBottom: 14 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}><ClassTag name={c.name} /> {c.level} <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>· max spell level {maxLvl || "—"}{c.name === "Warlock" && c.level >= 11 ? " · Mystic Arcanum below" : ""}</span></div>
            {canCap > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ color: mine.cantrips.length > canCap ? T.blood : T.dim, fontSize: 12 }}>Cantrips {mine.cantrips.length}/{canCap} </span>
                {mine.cantrips.map((n) => chip(n, "cantrips"))}
                {mine.cantrips.length < canCap && pool.length > 0 && (
                  <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => { setAdding({ cls: c.name, kind: "cantrips" }); setQ(""); }}>＋ add</button>
                )}
              </div>
            )}
            {grantedNow.length > 0 && (
              <div style={{ marginTop: 6, color: T.green, fontSize: 12 }}>
                {subData.label}: {grantedNow.map((n, i) => <span key={n} {...lorePress(n)} style={{ color: T.ink }}>{i > 0 ? ", " : ""}{n}</span>)}
              </div>
            )}
            {subData?.type === "expanded" && (
              <div style={{ marginTop: 6, color: "#b48ead", fontSize: 12 }}>{subData.label}</div>
            )}
            {cap.n > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ color: mine.spells.length > cap.n ? T.blood : T.dim, fontSize: 12 }}>{mine.spells.length}/{cap.n} {cap.label} </span>
                {mine.spells.map((n) => chip(n, "spells"))}
                {mine.spells.length < cap.n && pool.length > 0 && (
                  <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => { setAdding({ cls: c.name, kind: "spells" }); setQ(""); }}>＋ add</button>
                )}
              </div>
            )}
            {c.name === "Warlock" && c.level >= 11 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ color: "#b48ead", fontSize: 12 }}>Mystic Arcanum · one spell per level, 1 cast per long rest, no slot required </span>
                {Object.entries(ARCANUM_UNLOCK).filter(([, wl]) => c.level >= wl).map(([lvlStr]) => {
                  const aLvl = +lvlStr;
                  const picked = (mine.arcanum || {})[aLvl];
                  return picked ? (
                    <span key={aLvl} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, border: `1px solid #b48ead55`, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
                      <span style={{ color: "#b48ead" }}>{aLvl}th</span> {picked}
                      <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => setArcanum(c.name, aLvl, null)}>✕</span>
                    </span>
                  ) : (
                    <button key={aLvl} style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, borderColor: "#b48ead55", color: "#b48ead" }}
                      onClick={() => { setAdding({ cls: c.name, kind: "arcanum", lvl: aLvl }); setQ(""); }} disabled={pool.length === 0}>
                      ＋ {aLvl}th
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {hasBoAS && (
        <div style={{ marginBottom: 14, paddingTop: 10, borderTop: `1px solid ${T.edge}` }}>
          <div style={{ color: T.ink, fontWeight: 700 }}>Book of Shadows — Ancient Secrets <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>· rituals only · level ≤ {Math.max(1, Math.ceil((wl?.level || 1) / 2))}</span></div>
          <div style={{ marginTop: 6 }}>
            {(ch.boasRituals || []).map((n) => (
              <span key={n} {...lorePress(n)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
                {n}<span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => onUpdate({ boasRituals: (ch.boasRituals || []).filter((x) => x !== n) })}>✕</span>
              </span>
            ))}
            {pool.length > 0 && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => { setAdding({ kind: "boas" }); setQ(""); }}>＋ transcribe ritual</button>}
          </div>
          {(ch.boasRituals || []).length < 2 && <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>Start with two 1st-level rituals from any class; transcribe rituals you find in your travels.</div>}
        </div>
      )}
      {hasTome && (
        <div style={{ marginBottom: 14, paddingTop: 10, borderTop: `1px solid ${T.edge}` }}>
          <div style={{ color: T.ink, fontWeight: 700 }}>Book of Shadows — Tome Cantrips <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>· {(ch.tomeCantrips || []).length}/3 · any class · cast at will</span></div>
          <div style={{ marginTop: 6 }}>
            {(ch.tomeCantrips || []).map((n) => (
              <span key={n} {...lorePress(n)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
                {n}<span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => onUpdate({ tomeCantrips: (ch.tomeCantrips || []).filter((x) => x !== n) })}>✕</span>
              </span>
            ))}
            {(ch.tomeCantrips || []).length < 3 && pool.length > 0 && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => { setAdding({ kind: "tome" }); setQ(""); }}>＋ add</button>}
          </div>
        </div>
      )}

      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setAdding(null)}>
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "75vh", display: "flex", flexDirection: "column", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", marginBottom: 8 }}>
              {adding.kind === "arcanum" ? `Choose ${adding.lvl}th-level Mystic Arcanum — ${adding.cls}`
                : adding.kind === "boas" ? `Transcribe a ritual (any class, level ≤ ${Math.max(1, Math.ceil((wl?.level || 1) / 2))})`
                : adding.kind === "tome" ? "Add a Tome cantrip (any class)"
                : `Add ${adding.kind === "cantrips" ? "cantrip" : "spell"} — ${adding.cls}`}
            </div>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 }} />
            <LazyList items={listFor(adding.cls, adding.kind, adding.lvl)} resetKey={`${q}|${adding.cls}|${adding.kind}|${adding.lvl}`}
              empty={<div style={{ color: T.dim, fontSize: 13, padding: 8 }}>No matching spells in your imported list.</div>}
              render={(sp) => (
                <div key={sp.name} {...lorePress(sp.name)} onClick={() => {
                  if (adding.kind === "arcanum") { setArcanum(adding.cls, adding.lvl, sp.name); setAdding(null); return; }
                  if (adding.kind === "boas") { onUpdate({ boasRituals: [...(ch.boasRituals || []), sp.name] }); setAdding(null); return; }
                  if (adding.kind === "tome") { onUpdate({ tomeCantrips: [...(ch.tomeCantrips || []), sp.name] }); setAdding(null); return; }
                  const mine = (ch.spells || {})[adding.cls] || { cantrips: [], spells: [] };
                  setList(adding.cls, adding.kind, [...(mine[adding.kind] || []), sp.name]);
                  setAdding(null);
                }} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.edge}`, cursor: "pointer" }}>
                  <span style={{ color: T.ink }}>{sp.name}</span>
                  <span style={{ color: T.dim, fontSize: 12 }}> · {sp.level === 0 ? "cantrip" : `level ${sp.level}`}{sp.school ? ` · ${schoolName(sp.school)}` : ""}</span>
                </div>
              )} />
          </div>
        </div>
      )}
    </div>
  );
}


/* ============ FEATURE CHOICE MANAGER (sheet-side) ============ */
function ChoiceManager({ ch, customs, onUpdate }) {
  const groups = characterChoiceGroups(ch, customs);
  const [open, setOpen] = useState(null); // group key
  if (!groups.length) return null;
  const shortName = (n) => baseSubName(n.replace(/^[^:]+:\s*/, ""));
  const save = (key, arr) => onUpdate({ choices: { ...(ch.choices || {}), [key]: arr } });
  const openGroup = groups.find((x) => x.g.key === open);
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4 }}>Feature Choices</div>
      <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>Maneuvers, disciplines, totems, and other subclass options. Long-press anything to read it; swap by removing and re-adding.</div>
      {groups.map(({ g, entry, grants, held, cap }) => {
        const all = [...new Set([...grants, ...held])];
        return (
          <div key={g.key} style={{ marginBottom: 10 }}>
            <div style={{ color: T.ink, fontWeight: 700, fontSize: 14 }}>{g.key} <span style={{ color: all.length > cap ? T.blood : T.dim, fontWeight: 400, fontSize: 12 }}>· {all.length}/{cap}</span></div>
            <div>
              {all.map((n) => (
                <span key={n} {...lorePress(n)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
                  {shortName(n)}
                  {!(grants.includes(n) && !held.includes(n)) && (
                    <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => save(g.key, held.filter((x) => x !== n))}>✕</span>
                  )}
                </span>
              ))}
              {all.length < cap && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => setOpen(g.key)}>＋ add</button>}
            </div>
          </div>
        );
      })}
      {openGroup && (
        <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setOpen(null)}>
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "75vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", marginBottom: 8 }}>Choose — {openGroup.g.key}</div>
            {openGroup.options.filter((o) => !openGroup.held.includes(o.name) && !openGroup.grants.includes(o.name)).map((o) => {
              const ok = !o.minLvl || o.minLvl <= openGroup.entry.level;
              return (
                <div key={o.name} {...lorePress(o.name)} onClick={() => { if (!ok) return; save(openGroup.g.key, [...openGroup.held, o.name]); setOpen(null); }}
                  style={{ padding: "10px 8px", borderBottom: `1px solid ${T.edge}`, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.45 }}>
                  <span style={{ color: T.ink }}>{shortName(o.name)}</span>
                  {o.minLvl > 0 && <span style={{ color: T.dim, fontSize: 12 }}> · requires level {o.minLvl}</span>}
                </div>
              );
            })}
            <div style={{ color: T.dim, fontSize: 11, marginTop: 8 }}>Long-press an option to read it before choosing.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ CHARACTER SHEET ============ */
/* ============ ACTIVE EFFECTS CARD — the buff tracker ============ */
const pillBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.edge}`, background: T.panel, color: T.gold, fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" };
const fieldStyle = { background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
const FX_KIND_COLOR = { Spell: "#6c91e0", Feature: "#7fb069", Feat: "#c77dca", Action: "#5eb1bf", Condition: "#d76a76", Custom: "#c9a44c" };

function EffectsCard({ ch, customs, fx, onUpdate }) {
  const effects = effectsOf(ch);
  const tempHp = Math.max(0, ch.tempHp || 0);
  const dmgRaw = Math.max(0, ch.dmg || 0);
  const [adding, setAdding] = useState(false);
  /* Ending an effect that granted max HP refunds the grant from recorded damage,
     so current HP only drops to the new maximum (the 5e rule for Aid & kin) */
  const withRefund = (removed, patch) => {
    const refund = removed.reduce((s, e) => s + instMaxHp(e, ch), 0);
    return refund ? { ...patch, dmg: Math.max(0, dmgRaw - refund) } : patch;
  };
  const remove = (id) => onUpdate(withRefund(effects.filter((e) => e.id === id), { effects: effects.filter((e) => e.id !== id) }));
  const bumpStacks = (id, d, max) => onUpdate({ effects: effects.map((e) => (e.id === id ? { ...e, stacks: Math.max(1, Math.min(max, (e.stacks || 1) + d)) } : e)) });
  const addEffect = (inst, grantTemp) => {
    let next = effects;
    let dropped = [];
    const def = effDefOf(inst);
    // concentration is a jealous god: starting a new concentration effect of YOUR OWN
    // drops the one you were holding (ally-held effects don't touch your concentration)
    if (isConcInst(inst)) { dropped = next.filter(isConcInst); next = next.filter((e) => !isConcInst(e)); }
    if (def?.stacks && next.some((e) => e.key === inst.key)) next = next.map((e) => (e.key === inst.key ? { ...e, stacks: Math.min(def.stacks, (e.stacks || 1) + 1) } : e));
    else if (inst.key !== "custom" && next.some((e) => e.key === inst.key)) { /* refreshed, not stacked */ }
    else next = [...next, inst];
    // temp HP never stacks — you keep the larger pool
    onUpdate(withRefund(dropped, { effects: next, ...(grantTemp ? { tempHp: Math.max(tempHp, grantTemp) } : {}) }));
    setAdding(false);
  };
  const acTotal = fx.ac.reduce((s, b) => s + b.value, 0);
  const summary = [
    fx.acBase && `base AC ${fx.acBase.value}+Dex`, acTotal !== 0 && `AC ${fmtMod(acTotal)}`, fx.acFloor && `AC no lower than ${fx.acFloor.value}`,
    fx.maxHp !== 0 && `max HP ${fmtMod(fx.maxHp)}`, fx.halveMaxHp && "max HP halved",
    fx.speedZero ? "speed 0" : fx.speedMult !== 1 ? (fx.speedMult > 1 ? `speed ×${fx.speedMult}` : "speed halved") : null,
    fx.speedAdd.length > 0 && `speed ${fmtMod(fx.speedAdd.reduce((s, b) => s + b.value, 0))} ft`,
    ...fx.atk.map((b) => `${b.label} ${fmtMod(b.value)} to ${b.scope === "all" ? "" : b.scope + " "}attacks`),
    ...fx.dmg.map((b) => `${b.label} ${fmtMod(b.value)} to ${b.scope === "all" ? "" : b.scope + " "}damage`),
    ...fx.save.map((b) => `${b.label} ${fmtMod(b.value)} to saves`),
    fx.shillelagh && "club/quarterstaff ✦ Wis & 1d8",
  ].filter(Boolean);
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Active Effects</div>
        {fx.conc.length > 0 && <span title="One concentration effect at a time; Con save when you take damage" style={{ color: "#b48ead", fontSize: 12 }}>◉ concentrating on {fx.conc.join(", ")}</span>}
        <div style={{ flex: 1 }} />
        <button style={{ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 13 }} onClick={() => setAdding(true)}>＋ Add effect</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ color: "#5eb1bf", fontSize: 13, fontWeight: 700 }}>Temp HP</span>
        <button style={{ ...pillBtn, opacity: tempHp ? 1 : 0.4 }} disabled={!tempHp} onClick={() => onUpdate({ tempHp: Math.max(0, tempHp - 1) })}>−</button>
        <span style={{ color: tempHp ? "#5eb1bf" : T.dim, fontFamily: "Georgia, serif", fontSize: 18, minWidth: 26, textAlign: "center" }}>{tempHp}</span>
        <button style={pillBtn} onClick={() => onUpdate({ tempHp: tempHp + 1 })}>＋</button>
        {tempHp > 0 && <button style={{ ...pillBtn, width: "auto", padding: "0 10px", fontSize: 12 }} onClick={() => onUpdate({ tempHp: 0 })}>clear</button>}
        <span style={{ color: T.dim, fontSize: 11 }}>absorbs damage first · new grants don't stack, keep the larger · fades on a long rest</span>
      </div>
      {effects.length === 0 ? (
        <div style={{ color: T.dim, fontSize: 13, marginTop: 12 }}>Nothing clings to you — no blessings, no curses. Add one when the Mage Armor goes up, the Rage takes hold, or the poison sets in.</div>
      ) : (
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          {effects.map((e) => {
            const def = effDefOf(e);
            if (!def && e.key !== "custom") return null;
            const name = e.name || def.name;
            const kind = def ? def.kind : "Custom";
            const brief = def ? def.brief : [describeCustomFx(e.mods || {}), e.note].filter(Boolean).join(" · ");
            const dur = e.key === "custom" ? e.dur : def.dur;
            return (
              <div key={e.id} data-fx-chip={e.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 10, padding: "8px 10px" }}>
                <div {...lorePress(name)} style={{ flex: 1, cursor: "pointer" }}>
                  <span style={{ color: T.ink, fontWeight: 700, fontSize: 14 }}>
                    {name}{def?.stacks ? ` · level ${e.stacks || 1}` : e.val != null && def?.input ? ` (${def.input.unit === "+" ? "+" + e.val : `${def.input.unit} ${e.val}`})` : ""}
                  </span>
                  <span style={{ color: FX_KIND_COLOR[kind], fontSize: 10.5, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{kind}</span>
                  {isConcDef(e) && <span title={e.ally ? "An ally concentrates on this — it doesn't hold your concentration" : "Concentration — one at a time; Con save when you take damage"} style={{ color: "#b48ead", fontSize: 12, marginLeft: 6 }}>{e.ally ? "◉ ally conc" : "◉ conc"}</span>}
                  <div style={{ color: T.dim, fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{brief}{dur ? ` — ${dur}` : ""}</div>
                </div>
                {def?.stacks && (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button style={{ ...pillBtn, opacity: (e.stacks || 1) <= 1 ? 0.4 : 1 }} disabled={(e.stacks || 1) <= 1} onClick={() => bumpStacks(e.id, -1, def.stacks)}>−</button>
                    <button style={{ ...pillBtn, opacity: (e.stacks || 1) >= def.stacks ? 0.4 : 1 }} disabled={(e.stacks || 1) >= def.stacks} onClick={() => bumpStacks(e.id, 1, def.stacks)}>＋</button>
                  </span>
                )}
                <span onClick={() => remove(e.id)} title="Remove effect" style={{ color: T.dim, cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1.4 }}>✕</span>
              </div>
            );
          })}
        </div>
      )}
      {summary.length > 0 && <div style={{ color: T.gold, fontSize: 12, marginTop: 10 }}>Now shaping the sheet: {summary.join(" · ")}</div>}
      <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>Long-press an effect for its rules · AC, HP, speed, attacks, saves, and roll reminders update automatically · rests sweep expired effects away</div>
      {adding && <AddEffectSheet ch={ch} customs={customs} existing={effects} onAdd={addEffect} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddEffectSheet({ ch, customs, existing, onAdd, onClose }) {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(null); // a picked effect awaiting its number (slot level, rolled HP…)
  const [val, setVal] = useState(1);
  const [ally, setAlly] = useState(false); // concentration effect held by an ally, not this character
  const [concAsk, setConcAsk] = useState(null); // a picked concentration effect awaiting "whose concentration?"
  const [custom, setCustom] = useState(null);
  const known = knownSpellNames(ch, customs);
  const have = new Set(existing.map((e) => e.key));
  const concActive = existing.filter(isConcInst).map((e) => e.name);
  const ql = q.trim().toLowerCase();
  const matches = (d) => !ql || d.name.toLowerCase().includes(ql) || (d.brief || "").toLowerCase().includes(ql);
  const isMine = (d) => (d.kind === "Spell" ? known.has(d.match || d.name) : d.mine ? d.mine(ch) : false);
  const suggested = EFFECT_LIB.filter((d) => matches(d) && isMine(d));
  const sugKeys = new Set(suggested.map((d) => d.key));
  const groups = [
    [`Yours — ${ch.name}'s spells & features`, suggested],
    ["Spells", EFFECT_LIB.filter((d) => d.kind === "Spell" && matches(d) && !sugKeys.has(d.key))],
    ["Class features", EFFECT_LIB.filter((d) => d.kind === "Feature" && matches(d) && !sugKeys.has(d.key))],
    ["Actions & stances", EFFECT_LIB.filter((d) => d.kind === "Action" && matches(d) && !sugKeys.has(d.key))],
    ["Feat toggles", EFFECT_LIB.filter((d) => d.kind === "Feat" && matches(d) && !sugKeys.has(d.key))],
    ["Conditions", EFFECT_LIB.filter((d) => d.kind === "Condition" && matches(d) && !sugKeys.has(d.key))],
  ].filter(([, a]) => a.length);
  const commit = (d, v, isAlly) => onAdd({ id: uid(), key: d.key, name: d.name, ...(v != null ? { val: v } : {}), ...(d.stacks ? { stacks: 1 } : {}), ...(isAlly ? { ally: true } : {}) }, d.tempHp ? d.tempHp(v, ch) : 0);
  const proceed = (d, isAlly) => { setConcAsk(null); setAlly(isAlly); if (d.input) { setPending(d); setVal(d.input.def); } else commit(d, undefined, isAlly); };
  const pick = (d) => (d.conc ? setConcAsk(d) : proceed(d, false));
  // free typing in the value field; the bounds bite only when it's applied
  const clampVal = () => pending && Math.max(pending.input.min, Math.min(pending.input.max, parseInt(val, 10) || pending.input.def));
  const blankCustom = { name: "", ac: "", atk: "", save: "", dmg: "", speed: "", maxHp: "", tempHp: "", note: "", conc: false, dur: "", ends: "short" };
  const submitCustom = () => {
    const mods = {};
    [["ac", "ac"], ["atk", "atk"], ["save", "save"], ["dmg", "dmg"], ["speed", "speed"], ["maxHp", "maxHp"]].forEach(([f, k]) => { const n = parseInt(custom[f], 10) || 0; if (n) mods[k] = n; });
    onAdd({ id: uid(), key: "custom", name: (custom.name || "").trim() || "Custom effect", conc: custom.conc, dur: (custom.dur || "").trim() || "until removed", ends: custom.ends, note: (custom.note || "").trim(), mods }, Math.max(0, parseInt(custom.tempHp, 10) || 0));
  };
  const numField = (label, f) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.dim, flex: "1 1 96px" }}>
      {label}
      <input type="number" value={custom[f]} placeholder="0" onChange={(e) => setCustom({ ...custom, [f]: e.target.value })} style={fieldStyle} />
    </label>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ ...card, width: "min(680px, 100%)", maxHeight: "82vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>Bestow an Effect</div>
          <span style={{ color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1 }} onClick={onClose}>✕</span>
        </div>
        {concAsk ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}>{concAsk.name} <span style={{ color: "#b48ead", fontSize: 12 }}>◉ concentration</span></div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>{concAsk.brief}</div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 12 }}>Whose concentration holds it?</div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <button style={btn(true)} onClick={() => proceed(concAsk, false)}>Mine{concActive.length ? ` — replaces ${concActive.join(", ")}` : ""}</button>
              <button style={btn(false)} onClick={() => proceed(concAsk, true)}>An ally's — cast on me</button>
              <button style={btn(false)} onClick={() => setConcAsk(null)}>Back</button>
            </div>
          </div>
        ) : pending ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}>{pending.name}</div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>{pending.brief}</div>
            <label style={{ display: "block", color: T.dim, fontSize: 13, marginTop: 12 }}>{pending.input.label} ({pending.input.min}–{pending.input.max})</label>
            <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center" }}>
              <input type="number" min={pending.input.min} max={pending.input.max} value={val} autoFocus
                onChange={(e) => setVal(e.target.value)}
                style={{ ...fieldStyle, width: 90, textAlign: "center", fontSize: 18 }} />
              <button style={btn(true)} onClick={() => commit(pending, clampVal(), ally)}>Apply</button>
              <button style={btn(false)} onClick={() => setPending(null)}>Back</button>
            </div>
            {pending.tempHp && <div style={{ color: "#5eb1bf", fontSize: 12, marginTop: 8 }}>Grants {pending.tempHp(clampVal(), ch)} temporary hit points.</div>}
          </div>
        ) : custom ? (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: T.dim, fontSize: 12 }}>Name<input value={custom.name} autoFocus placeholder="Potion of Heroism, DM's mysterious blessing…" onChange={(e) => setCustom({ ...custom, name: e.target.value })} style={{ ...fieldStyle, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {numField("AC bonus", "ac")}{numField("Attack bonus", "atk")}{numField("Save bonus", "save")}{numField("Weapon damage", "dmg")}{numField("Speed (ft)", "speed")}{numField("Max HP", "maxHp")}{numField("Temp HP granted", "tempHp")}
            </div>
            <label style={{ display: "block", color: T.dim, fontSize: 12, marginTop: 10 }}>Reminder note (shown with the effect)<input value={custom.note} placeholder="advantage on stealth checks in dim light…" onChange={(e) => setCustom({ ...custom, note: e.target.value })} style={{ ...fieldStyle, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <label style={{ color: T.dim, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={custom.conc} onChange={(e) => setCustom({ ...custom, conc: e.target.checked })} /> Concentration</label>
              <label style={{ color: T.dim, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>Expires:
                <select value={custom.ends} onChange={(e) => setCustom({ ...custom, ends: e.target.value })} style={{ ...fieldStyle, width: "auto", padding: "6px 8px" }}>
                  <option value="short">on any rest</option><option value="long">on a long rest</option><option value="manual">only when removed</option>
                </select>
              </label>
              <input value={custom.dur} placeholder="duration, e.g. 1 hour" onChange={(e) => setCustom({ ...custom, dur: e.target.value })} style={{ ...fieldStyle, width: 150 }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={btn(true)} onClick={submitCustom}>Bestow it</button>
              <button style={btn(false)} onClick={() => setCustom(null)}>Back</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={q} placeholder="Search — mage armor, rage, poisoned…" onChange={(e) => setQ(e.target.value)} style={fieldStyle} />
              <button style={{ ...btn(false), whiteSpace: "nowrap", fontSize: 13 }} onClick={() => setCustom(blankCustom)}><Icon name="hammer" size={13} /> Custom</button>
            </div>
            {concActive.length > 0 && <div style={{ color: "#b48ead", fontSize: 12, marginTop: 8 }}>◉ Concentrating on {concActive.join(", ")} — adding another concentration effect will end it.</div>}
            {groups.length === 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 14 }}>Nothing in the catalog matches — forge it as a custom effect instead.</div>}
            {groups.map(([title, defs]) => (
              <div key={title} style={{ marginTop: 14 }}>
                <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15 }}>{title}</div>
                <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                  {defs.map((d) => {
                    const active = have.has(d.key);
                    const disabled = active && !d.stacks;
                    return (
                      <div key={d.key} data-fx-row={d.key} onClick={() => !disabled && pick(d)}
                        style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "7px 9px", borderRadius: 8, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, background: T.panel2, border: `1px solid ${T.edge}` }}>
                        <span style={{ color: T.ink, fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>{d.name}</span>
                        {d.conc && <span style={{ color: "#b48ead", fontSize: 11 }}>◉</span>}
                        <span style={{ color: T.dim, fontSize: 12, flex: 1 }}>{d.brief}</span>
                        <span style={{ color: FX_KIND_COLOR[d.kind], fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{active ? (d.stacks ? "worsen" : "active") : d.dur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Sheet({ ch, onBack, onLevelUp, onDelete, onPhoto, onSpells, onNotes, onInvocations, onUpdate, customs }) {
  const lvl = totalLevel(ch);
  const pb = profBonus(lvl);
  const slots = spellSlots(ch.classes);
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const pact = wl ? PACT(wl.level) : null;
  const photoUpload = usePhotoUpload(onPhoto);
  const [confirmDel, setConfirmDel] = useState(false);

  /* ---- play state: damage taken, temp HP, active effects, expended slots, rests ---- */
  const fx = fxMods(ch);
  const effMax = effMaxHp(ch, fx);
  const spd = speedOf(ch, customs, fx);
  /* dmgRaw is the recorded truth; the display clamps to the effective max so a temporarily
     halved maximum (Exhaustion 4) hides — but never erases — damage beyond it */
  const dmgRaw = Math.max(0, ch.dmg || 0);
  const curHp = Math.max(0, effMax - dmgRaw);
  const tempHp = Math.max(0, ch.tempHp || 0);
  const hpRatio = curHp / effMax;
  const hpColor = hpRatio > 0.5 ? T.green : hpRatio > 0.25 ? T.gold : "#d76a76";
  const [hpAmt, setHpAmt] = useState(1);
  const [concNote, setConcNote] = useState(null);
  useEffect(() => { if (concNote && !fx.conc.length) setConcNote(null); }, [concNote, fx.conc.length]);
  const applyHp = (delta) => {
    if (delta >= 0) { onUpdate({ dmg: Math.max(0, dmgRaw - delta) }); return; }
    // damage chews through temporary hit points before touching the real ones
    const d = -delta;
    const fromTemp = Math.min(tempHp, d);
    const patch = {};
    if (fromTemp) patch.tempHp = tempHp - fromTemp;
    if (d - fromTemp > 0) patch.dmg = Math.max(dmgRaw, Math.min(effMax, dmgRaw + (d - fromTemp)));
    onUpdate(patch);
    if (fx.conc.length) setConcNote(`Concentration check — Con save DC ${Math.max(10, Math.floor(d / 2))} or lose ${fx.conc.join(", ")}.`);
  };
  const usedSlots = ch.usedSlots || [];
  const usedOf = (i) => Math.min(usedSlots[i] || 0, slots ? slots[i] || 0 : 0);
  const setUsed = (i, n) => {
    const next = Array.from({ length: slots.length }, (_, j) => (j === i ? n : usedOf(j)));
    onUpdate({ usedSlots: next });
  };
  const usedPact = pact ? Math.min(ch.usedPact || 0, pact.n) : 0;
  const arcanum = (wl && wl.level >= 11 && ch.spells?.Warlock?.arcanum) || {};
  const arcLevels = Object.keys(arcanum).map(Number).sort();
  const usedArc = ch.usedArcanum || [];
  const toggleArc = (lvl) => onUpdate({ usedArcanum: usedArc.includes(lvl) ? usedArc.filter((l) => l !== lvl) : [...usedArc, lvl] });
  /* Which effects survive a rest: short-fuse ones clear on any rest, long-fuse on a long
     rest, conditions cling until removed by hand — except stacking effects with restDecay
     (exhaustion), which fade a level instead */
  const restTouches = (e, kind) => {
    const def = effDefOf(e);
    if (def?.stacks && def.restDecay === kind) return true;
    const ends = effEnds(e);
    return ends === "short" || (kind === "long" && ends === "long");
  };
  const restEffects = (kind) => effectsOf(ch).flatMap((e) => {
    if (!restTouches(e, kind)) return [e];
    const def = effDefOf(e);
    if (def?.stacks && def.restDecay === kind) return (e.stacks || 1) > 1 ? [{ ...e, stacks: (e.stacks || 1) - 1 }] : [];
    return [];
  });
  const shortWould = usedPact > 0 || effectsOf(ch).some((e) => restTouches(e, "short"));
  const longWould = dmgRaw > 0 || tempHp > 0 || usedSlots.some(Boolean) || usedPact > 0 || usedArc.length > 0 || effectsOf(ch).some((e) => restTouches(e, "long"));
  const shortRest = () => {
    const kept = new Set(restEffects("short").map((e) => e.id));
    // granted max HP walks out with its effect: refund it from recorded damage
    const refund = effectsOf(ch).filter((e) => !kept.has(e.id)).reduce((s, e) => s + instMaxHp(e, ch), 0);
    onUpdate({ usedPact: 0, effects: restEffects("short"), ...(refund ? { dmg: Math.max(0, dmgRaw - refund) } : {}) });
  };
  const longRest = () => onUpdate({ dmg: 0, usedSlots: [], usedPact: 0, usedArcanum: [], tempHp: 0, effects: restEffects("long") });
  const pip = (filled, color) => ({ cursor: "pointer", fontSize: 18, fontFamily: "Georgia, serif", color: filled ? color : T.dim, opacity: filled ? 1 : 0.45, userSelect: "none", padding: "0 1px" });

  /* ---- the bones: d20 rolls with every modifier the sheet knows about ---- */
  const [rollSpec, setRollSpec] = useState(null);
  const [advMode, setAdvMode] = useState("normal");
  const feats = rollFeatures(ch);
  const saveProfFor = (a) => CLASSES[ch.classes[0].name].saves.includes(a) || feats.diamondSoul || (feats.slipperyMind && a === "wis");
  const saveProfLabel = (a) => (CLASSES[ch.classes[0].name].saves.includes(a) ? "proficiency" : feats.diamondSoul ? "Diamond Soul" : "Slippery Mind");
  const halfProf = (a) => {
    const athlete = ["str", "dex", "con"].includes(a) ? feats.athlete : 0;
    if (!athlete && !feats.jack) return null;
    return athlete >= feats.jack ? { label: "Remarkable Athlete", value: athlete } : { label: "Jack of All Trades", value: feats.jack };
  };
  const savePartsFor = (a) => [
    { label: ABIL_NAMES[a], value: mod(ch.abilities[a]) },
    ...(saveProfFor(a) ? [{ label: saveProfLabel(a), value: pb }] : []),
    ...(feats.aura ? [{ label: "Aura of Protection", value: feats.aura }] : []),
    ...fx.save,
  ];
  const saveMod = (a) => savePartsFor(a).reduce((s, p) => s + p.value, 0);
  const checkPartsFor = (a) => {
    const hp2 = halfProf(a);
    return [{ label: ABIL_NAMES[a], value: mod(ch.abilities[a]) }, ...(hp2 ? [hp2] : [])];
  };
  const skillPartsFor = (sk) => {
    const a = SKILL_ABIL[sk];
    const prof = ch.skills.includes(sk);
    const exp = (ch.expertise || []).includes(sk);
    const hp2 = !prof ? halfProf(a) : null;
    return [
      { label: ABIL_NAMES[a], value: mod(ch.abilities[a]) },
      ...(prof ? [{ label: exp ? "expertise" : "proficiency", value: pb * (exp ? 2 : 1) }] : []),
      ...(hp2 ? [hp2] : []),
    ];
  };
  const rollIt = (title, parts, kind, abil, proficient) => setRollSpec({ title, parts, kind, abil, proficient });
  const acInfo = armorClass(ch, customs, fx);
  const [dmgRoll, setDmgRoll] = useState(null); // { title, dice, bonus, bonusLabel, note }
  /* Active-effect attack/damage bonuses, filtered to the attack being made: its scope
     (melee/ranged/weapon/spell), the ability behind the swing (Rage is Strength-only),
     and any required weapon property (Great Weapon Master demands Heavy) */
  const fxInScope = (b, scope, abil, props) =>
    (b.scope === "all" || b.scope === scope || (b.scope === "weapon" && scope !== "spell")) &&
    (!b.abil || b.abil === abil) && (!b.prop || (props || []).includes(b.prop));
  const fxAtk = (scope, abil, props) => fx.atk.filter((b) => fxInScope(b, scope, abil, props)).map(({ label, value }) => ({ label, value }));
  const fxDmg = (scope, abil, props) => fx.dmg.filter((b) => fxInScope(b, scope, abil, props));
  const shillTarget = (it) => fx.shillelagh && /\b(club|quarterstaff)\b/i.test(it.name);
  const weaponAbility = (it) => {
    if (shillTarget(it)) return "wis";
    const props = (it.property || "").split(",").map((x) => x.trim());
    if (it.type === "R") return "dex";
    if (props.includes("F")) return mod(ch.abilities.dex) > mod(ch.abilities.str) ? "dex" : "str";
    return "str";
  };
  const weaponDie = (it) => (shillTarget(it) ? "1d8" : it.dmg1 || "1d4");
  const weaponAbilLabel = (it, abil) => (shillTarget(it) ? "Wisdom (Shillelagh)" : ABIL_NAMES[abil]);
  const rollWeaponDamage = (it) => {
    const m = weaponDie(it).match(/(\d+)d(\d+)/);
    if (!m) return;
    const abil = weaponAbility(it);
    const props = (it.property || "").split(",").map((x) => x.trim());
    const dueling = (ch.styles || []).includes("Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0;
    const extras = fxDmg(it.type === "R" ? "ranged" : "melee", abil, props);
    const bonus = mod(ch.abilities[abil]) + dueling + extras.reduce((s, b) => s + b.value, 0);
    const dmgNotes = rollNotes(ch, "dmg", abil);
    setDmgRoll({
      title: `${it.name} damage`,
      dice: Array.from({ length: +m[1] }, () => ({ sides: +m[2], value: roll(+m[2]) })),
      bonus, bonusLabel: [weaponAbilLabel(it, abil), dueling ? "Dueling" : null, ...extras.map((b) => b.label)].filter(Boolean).join(" + "),
      note: `${DMG_TYPES[it.dmgType] || "damage"}${it.dmg2 && !shillTarget(it) ? ` · versatile: ${it.dmg2} two-handed` : ""}${(ch.styles || []).includes("Great Weapon Fighting") && props.includes("2H") ? " · GWF: you may reroll 1s and 2s" : ""}${dmgNotes.length ? " · " + dmgNotes.join(" · ") : ""}`,
    });
  };
  const equippedWeapons = equippedOf(ch).map((r) => findItem(r.name, customs)).filter((x) => x && isWeaponType(x.type));
  const casterClasses = ch.classes.filter((c) => CLASSES[c.name].caster);
  const attackRolls = [
    { icon: "sword", label: "Melee", abil: "str", parts: [{ label: "Strength", value: mod(ch.abilities.str) }, { label: "proficiency", value: pb }, ...fxAtk("melee", "str")] },
    { icon: "bow", label: "Ranged / Finesse", abil: "dex", parts: [{ label: "Dexterity", value: mod(ch.abilities.dex) }, { label: "proficiency", value: pb }, ...(feats.archery ? [{ label: "Archery", value: feats.archery }] : []), ...fxAtk("ranged", "dex")] },
    ...casterClasses.map((c) => ({ icon: "sparkles", label: `Spell (${c.name})`, abil: SPELL_ABILITY[c.name], parts: [{ label: ABIL_NAMES[SPELL_ABILITY[c.name]], value: mod(ch.abilities[SPELL_ABILITY[c.name]]) }, { label: "proficiency", value: pb }, ...fxAtk("spell", SPELL_ABILITY[c.name])] })),
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <button style={{ ...btn(false), marginBottom: 16 }} onClick={onBack}>← Roster</button>

      <div style={{ ...card, padding: 20, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ cursor: "pointer" }} title="Click to change portrait">
          <Portrait photo={ch.photo} size={96} name={ch.name} />
          <input type="file" accept="image/*" onChange={photoUpload} style={{ display: "none" }} />
        </label>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: T.gold }}>{ch.name}</div>
          <div style={{ color: T.ink }}>{ch.race} · {ch.classes.map((c, i) => <span key={c.name}>{i > 0 ? " / " : ""}<ClassTag name={c.name} /> {c.level}{c.subclass ? <span style={{ color: T.dim }}> (<span {...lorePress(c.subclass)}>{c.subclass}</span>)</span> : ""}</span>)}</div>
          <div style={{ color: T.dim, fontSize: 13 }}>Character level {lvl} · Proficiency +{pb} · <span {...lorePress(ch.background)} style={{ textDecoration: "underline dotted" }}>{ch.background}</span>{ch.alignment ? ` · ${ch.alignment}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <button style={{ ...btn(true), opacity: lvl >= 20 ? 0.4 : 1 }} disabled={lvl >= 20} onClick={onLevelUp}><Icon name="up" /> Level Up</button>
          {!confirmDel
            ? <button style={{ ...btn(false), borderColor: T.blood, color: T.blood }} onClick={() => setConfirmDel(true)}>Delete</button>
            : <button style={{ ...btn(false), background: T.blood, color: T.ink, borderColor: T.blood }} onClick={onDelete}>Confirm delete?</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginTop: 14 }}>
        {ABILITIES.map((a) => {
          const saveProf = saveProfFor(a);
          return (
            <div key={a} {...lorePress(ABIL_NAMES[a])} style={{ ...card, padding: 12, textAlign: "center", cursor: "pointer" }} title={`Roll a ${ABIL_NAMES[a]} check`}
              onClick={() => rollIt(`${ABIL_NAMES[a]} check`, checkPartsFor(a), "check", a)}>
              <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{ABIL_NAMES[a]}</div>
              <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}>{ch.abilities[a]}</div>
              <div style={{ color: T.gold }}>{fmtMod(mod(ch.abilities[a]))}</div>
              <div style={{ color: saveProf ? T.green : T.dim, fontSize: 11, marginTop: 4, padding: "2px 0", borderRadius: 6 }} title={`Roll a ${ABIL_NAMES[a]} save`}
                onClick={(e) => { e.stopPropagation(); rollIt(`${ABIL_NAMES[a]} saving throw`, savePartsFor(a), "save", a); }}>
                save {fmtMod(saveMod(a))}{saveProf ? " ●" : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>● save proficiencies from first class only, per multiclass rules ({ch.classes[0].name}: {CLASSES[ch.classes[0].name].saves.map(s=>s.toUpperCase()).join(", ")}){feats.aura ? " · Aura of Protection adds +" + feats.aura + " to all saves" : ""} · tap an ability to roll a check, its save line to roll a save</div>



      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 14 }}>
        <div style={{ ...card, padding: 12, textAlign: "center", borderColor: "#4a5568" }} title={acInfo.parts.join(" + ")}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Armor Class</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}><Icon name="shield" size={16} style={{ marginRight: 4 }} />{acInfo.ac}</div>
          <div style={{ color: T.dim, fontSize: 10, lineHeight: 1.4 }}>{acInfo.parts.join(" + ")}</div>
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }} title={tempHp ? "Temporary hit points absorb damage first" : undefined}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Hit Points</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: hpColor }}>
            {curHp}{tempHp > 0 && <span style={{ fontSize: 16, color: "#5eb1bf" }}> +{tempHp}</span>}<span style={{ fontSize: 15, color: T.dim }}> / {effMax}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: T.panel2, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${hpRatio * 100}%`, background: hpColor, transition: "width 240ms ease" }} />
          </div>
          {(fx.maxHp !== 0 || fx.halveMaxHp) && <div style={{ color: T.dim, fontSize: 10, marginTop: 4 }}>{fx.halveMaxHp ? "max halved by Exhaustion" : `max ${fmtMod(fx.maxHp)} from effects`}</div>}
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center", cursor: "pointer" }} title="Roll initiative"
          onClick={() => rollIt("Initiative", checkPartsFor("dex"), "check", "dex")}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Initiative <Icon name="d20" size={11} style={{ marginRight: 0 }} /></div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}>{fmtMod(checkPartsFor("dex").reduce((s, p) => s + p.value, 0))}</div>
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }} title={spd.parts.join(" · ")}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Speed</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: spd.v === 0 ? "#d76a76" : spd.modified ? T.gold : T.ink }}>{spd.v}</div>
          {spd.modified && <div style={{ color: T.dim, fontSize: 10, lineHeight: 1.4 }}>{spd.parts.join(" · ")}</div>}
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Hit Dice</div>
          <div style={{ fontSize: 18, fontFamily: "Georgia, serif", color: T.ink, marginTop: 6 }}>
            {ch.classes.map((c) => `${c.level}d${CLASSES[c.name].die}`).join(" + ")}
          </div>
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Gold</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.gold }}>{ch.gold ?? 0}</div>
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Passive Perception</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}>{10 + mod(ch.abilities.wis) + (ch.skills.includes("Perception") ? pb : 0)}</div>
        </div>
      </div>

      <div style={{ ...card, padding: 14, marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginRight: 4 }}>In Play</div>
        <button style={{ ...btn(false), borderColor: T.blood, color: "#d76a76" }} onClick={() => applyHp(-hpAmt)} disabled={curHp <= 0 && tempHp <= 0}>− Damage</button>
        <input type="number" min={1} value={hpAmt}
          onChange={(e) => setHpAmt(Math.max(1, parseInt(e.target.value, 10) || 1))}
          style={{ width: 58, textAlign: "center", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 4px", fontSize: 16 }} />
        <button style={{ ...btn(false), borderColor: T.green, color: T.green }} onClick={() => applyHp(hpAmt)} disabled={dmgRaw === 0}>+ Heal</button>
        <div style={{ flex: 1 }} />
        <button style={btn(false)} onClick={shortRest} disabled={!shortWould} title="Recover pact slots; short-lived effects expire"><Icon name="moon" /> Short Rest</button>
        <button style={btn(false)} onClick={longRest} disabled={!longWould} title="Full HP, all slots recovered, temp HP and expiring effects cleared, exhaustion eases"><Icon name="sun" /> Long Rest</button>
        {concNote && (
          <div style={{ width: "100%", color: "#b48ead", fontSize: 12.5, lineHeight: 1.5 }}>
            ⚠ {concNote} <span style={{ color: T.dim, cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => setConcNote(null)}>dismiss</span>
          </div>
        )}
      </div>

      <EffectsCard ch={ch} customs={customs} fx={fx} onUpdate={onUpdate} />

      <div style={{ ...card, padding: 14, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Roll the Bones</div>
          <div style={{ display: "flex", gap: 4, background: T.panel2, borderRadius: 10, padding: 3 }}>
            {[["normal", "Normal"], ["adv", "Advantage"], ["dis", "Disadvantage"]].map(([m, label]) => (
              <button key={m} onClick={() => setAdvMode(m)}
                style={{ border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: advMode === m ? 700 : 400,
                  background: advMode === m ? (m === "adv" ? "#3c5a41" : m === "dis" ? "#5a3038" : T.panel) : "transparent",
                  color: advMode === m ? (m === "adv" ? "#9ed3a8" : m === "dis" ? "#d76a76" : T.gold) : T.dim }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {attackRolls.map((atk) => (
            <button key={atk.label} style={{ ...btn(false), padding: "8px 14px" }}
              onClick={() => rollIt(`${atk.label} attack`, atk.parts, "attack", atk.abil)}>
              <Icon name={atk.icon} /> {atk.label} {fmtMod(atk.parts.reduce((s, p) => s + p.value, 0))}
            </button>
          ))}
        </div>
        {equippedWeapons.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {equippedWeapons.map((it) => {
              const abil = weaponAbility(it);
              const props = (it.property || "").split(",").map((x) => x.trim());
              const atkParts = [{ label: weaponAbilLabel(it, abil), value: mod(ch.abilities[abil]) }, { label: "proficiency", value: pb }, ...(it.type === "R" && feats.archery ? [{ label: "Archery", value: feats.archery }] : []), ...fxAtk(it.type === "R" ? "ranged" : "melee", abil, props)];
              const atkMod = atkParts.reduce((s, p) => s + p.value, 0);
              const dmgBonus = mod(ch.abilities[abil]) + ((ch.styles || []).includes("Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0) + fxDmg(it.type === "R" ? "ranged" : "melee", abil, props).reduce((s, b) => s + b.value, 0);
              return (
                <span key={it.name} style={{ display: "inline-flex", border: `1px solid ${T.edge}`, borderRadius: 10, overflow: "hidden" }}>
                  <button {...lorePress(it.name)} style={{ ...btn(false), border: "none", borderRadius: 0, padding: "8px 12px" }}
                    onClick={() => rollIt(`${it.name} attack`, atkParts, "attack", abil)}>
                    <Icon name={it.type === "R" ? "bow" : "sword"} /> {it.name} {fmtMod(atkMod)}{shillTarget(it) ? " ✦" : ""}
                  </button>
                  <button style={{ ...btn(false), border: "none", borderLeft: `1px solid ${T.edge}`, borderRadius: 0, padding: "8px 12px", color: T.blood }}
                    onClick={() => rollWeaponDamage(it)}>
                    {weaponDie(it)}{dmgBonus ? fmtMod(dmgBonus) : ""}
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div style={{ color: T.dim, fontSize: 11, marginTop: 8 }}>
          {feats.critRange < 20 ? `Champion: attacks crit on ${feats.critRange}–20 · ` : ""}{feats.archery ? "Archery: +2 to ranged attacks · " : ""}{feats.lucky ? "Lucky: natural 1s reroll themselves · " : ""}the toggle applies to every roll — attacks, saves, checks, and skills{equippedWeapons.length ? " · weapon buttons: left rolls to-hit, right rolls damage" : " · equip weapons in your Inventory for attack & damage buttons"}
        </div>
      </div>

      <InventoryCard ch={ch} customs={customs} onUpdate={onUpdate} />

      {(slots || pact) && (
        <div style={{ ...card, padding: 16, marginTop: 14 }}>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Spell Slots <span style={{ color: T.dim, fontSize: 12, fontFamily: "inherit" }}>· tap ◆ to expend, ◇ to recover</span></div>
          {slots && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {slots.map((n, i) => {
                const avail = n - usedOf(i);
                return (
                  <div key={i} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid ${T.edge}` }}>
                    <div style={{ color: T.dim, fontSize: 11 }}>Level {i + 1}</div>
                    <div>
                      {Array.from({ length: n }, (_, j) => (
                        <span key={j} style={pip(j < avail, T.ink)}
                          onClick={() => setUsed(i, j < avail ? usedOf(i) + 1 : usedOf(i) - 1)}>
                          {j < avail ? "◆" : "◇"}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {slots && ch.classes.filter((c) => ["full", "half"].includes(CLASSES[c.name].caster)).length > 1 && (
            <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Combined caster level: full casters count fully, Paladin/Ranger at half (rounded down). Spells known/prepared are determined per class as if single-classed.</div>
          )}
          {pact && (
            <div style={{ marginTop: slots ? 12 : 0, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div {...lorePress("Pact Magic")} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid #b48ead55` }}>
                <div style={{ color: "#b48ead", fontSize: 11 }}>Pact · level {pact.lvl}</div>
                <div>
                  {Array.from({ length: pact.n }, (_, j) => (
                    <span key={j} style={pip(j < pact.n - usedPact, "#b48ead")}
                      onClick={() => onUpdate({ usedPact: j < pact.n - usedPact ? usedPact + 1 : usedPact - 1 })}>
                      {j < pact.n - usedPact ? "◆" : "◇"}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ color: "#b48ead", fontSize: 13 }}>
                <span {...lorePress("Pact Magic")} style={{ textDecoration: "underline dotted", cursor: "help" }}>Pact Magic</span> is separate from spell slots · all pact slots recharge on a short rest
                <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>
                  {(ch.spells?.Warlock?.spells || []).length > 0
                    ? <>Cast with pact slots (always at level {pact.lvl}): {(ch.spells?.Warlock?.spells || []).map((n, i) => <span key={n} {...lorePress(n)} style={{ color: T.ink }}>{i > 0 ? ", " : ""}{n}</span>)}</>
                    : "No warlock spells known yet — add them in the Grimoire below to have something to cast with these slots."}
                  {(ch.spells?.Warlock?.cantrips || []).length > 0 && <> · cantrips are cast at will: {(ch.spells?.Warlock?.cantrips || []).map((n, i) => <span key={n} {...lorePress(n)} style={{ color: T.ink }}>{i > 0 ? ", " : ""}{n}</span>)}</>}
                </div>
              </div>
              {arcLevels.map((aLvl) => (
                <div key={aLvl} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid #b48ead55` }}>
                  <div style={{ color: "#b48ead", fontSize: 11 }}>Arcanum {aLvl}th · {arcanum[aLvl]}</div>
                  <span style={pip(!usedArc.includes(aLvl), "#b48ead")} onClick={() => toggleArc(aLvl)}>
                    {usedArc.includes(aLvl) ? "◇" : "◆"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SpellManager ch={ch} customs={customs} onSpells={onSpells} onUpdate={onUpdate} />
      <ChoiceManager ch={ch} customs={customs} onUpdate={onUpdate} />
      <InvocationManager ch={ch} onInvocations={onInvocations} />

      <div style={{ ...card, padding: 16, marginTop: 14 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Class Features</div>
        {ch.classes.map((c) => (
          <div key={c.name} style={{ marginBottom: 10 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}><ClassTag name={c.name} /> {c.level}{c.subclass ? <> — <span {...lorePress(c.subclass)}>{c.subclass}</span></> : ""}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
              {(() => {
                const themed = (CLASS_THEMES[c.name] || {}).color || T.gold;
                const items = Array.from({ length: c.level }, (_, i) => i + 1)
                  .flatMap((l) => (CLASSES[c.name].feats[l] || [])
                    .filter((f) => !(c.subclass && /\bfeature\b$/i.test(f)))
                    .concat(allSubFeats(c.subclass, l, customs))
                    .concat(CLASSES[c.name].asi.includes(l) ? [ASI] : [])
                    .map((f) => ({ l, f })));
                return items.length ? items.map(({ l, f }, i) => (
                  <span key={i} {...lorePress(f)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "3px 9px", fontSize: 12.5, color: T.ink }}>
                    <span style={{ color: themed, fontSize: 10.5, fontWeight: 700, opacity: 0.9 }}>{l}</span>{f}
                  </span>
                )) : <span style={{ color: T.dim }}>—</span>;
              })()}
              {c.name === "Rogue" && <span style={{ color: T.gold }}> · Sneak Attack {Math.ceil(c.level / 2)}d6</span>}
              {c.name === "Warlock" && INVOCATIONS(c.level) > 0 && <span style={{ color: "#b48ead" }}> · Invocations known: {INVOCATIONS(c.level)}</span>}
            </div>
          </div>
        ))}
        <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>Note: Extra Attack from multiple classes doesn't stack; Unarmored Defense can only be gained once.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Skills</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 4 }}>
            {ALL_SKILLS.map((sk) => {
              const prof = ch.skills.includes(sk);
              const exp = (ch.expertise || []).includes(sk);
              const m = skillPartsFor(sk).reduce((s, p) => s + p.value, 0);
              return (
                <div key={sk} {...lorePress(sk)} title={`Roll ${sk}`} onClick={() => rollIt(`${sk} check`, skillPartsFor(sk), "skill", SKILL_ABIL[sk], prof)}
                  style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, background: prof ? T.panel2 : "transparent", fontSize: 13, cursor: "pointer" }}>
                  <span style={{ color: prof ? T.ink : T.dim }}>{exp ? "★ " : prof ? "● " : ""}{sk}</span>
                  <span style={{ color: exp ? T.gold : prof ? T.ink : T.dim, fontWeight: prof ? 700 : 400 }}>{fmtMod(m)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>● proficient · ★ expertise (double proficiency) · tap any skill to roll it{feats.jack ? " · Jack of All Trades adds +" + feats.jack + " to the rest" : ""}{feats.reliable ? " · Reliable Talent floors proficient checks at 10" : ""}</div>
          {ch.feats?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Feats: {ch.feats.map((f, i) => <span key={f} {...lorePress(f)}>{i > 0 ? ", " : ""}{f}</span>)}</div>}
          {ch.metamagic?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Metamagic: {ch.metamagic.map((m, i) => <span key={m} {...lorePress(m)}>{i > 0 ? ", " : ""}{m}</span>)}</div>}
          {ch.rangerChoices && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Favored Enemy: {[ch.rangerChoices.favEnemy, ...(ch.rangerChoices.extraEnemies || [])].filter(Boolean).join(", ")} · Natural Explorer: {[ch.rangerChoices.natTerrain, ...(ch.rangerChoices.extraTerrains || [])].filter(Boolean).join(", ")}</div>}
          {ch.choices && Object.entries(ch.choices).filter(([k]) => !CHOICE_KEYS.has(k)).map(([k, v]) => (
            <div key={k} style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>{k}: {v.map((n, i) => <span key={n} {...lorePress(n)}>{i > 0 ? ", " : ""}{n}</span>)}</div>
          ))}
          {ch.styles?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Fighting Styles: {ch.styles.map((f) => `${f} (${STYLE_DESC[f]})`).join(" · ")}</div>}
          <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Proficiencies ({ch.classes[0].name}): {PROF_TEXT[ch.classes[0].name]}{ch.classes.length > 1 ? " — plus multiclass grants (see Chronicle)" : ""}</div>
          {ch.languages?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Languages: {ch.languages.map((l, i) => <span key={l + i} {...lorePress(l)}>{i > 0 ? ", " : ""}{l}</span>)}</div>}
          <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Racial traits: {RACES[ch.race].traits.map((t, i) => <span key={t} {...lorePress(t.replace(/\s*\(.*$/, ""))}>{i > 0 ? " · " : ""}{t}</span>)}{ch.racialChoices?.ancestry ? ` · ${ch.racialChoices.ancestry} dragon ancestry (${ANCESTRIES[ch.racialChoices.ancestry]})` : ""}{ch.racialChoices?.cantrip ? ` · Cantrip: ${ch.racialChoices.cantrip}` : ""}</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Notes & Inventory</div>
          {ch.persona && Object.values(ch.persona).some(Boolean) && (
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 10, lineHeight: 1.7 }}>
              {ch.persona.traits && <div><b style={{ color: T.gold }}>Traits:</b> {ch.persona.traits}</div>}
              {ch.persona.ideals && <div><b style={{ color: T.gold }}>Ideals:</b> {ch.persona.ideals}</div>}
              {ch.persona.bonds && <div><b style={{ color: T.gold }}>Bonds:</b> {ch.persona.bonds}</div>}
              {ch.persona.flaws && <div><b style={{ color: T.gold }}>Flaws:</b> {ch.persona.flaws}</div>}
            </div>
          )}
          <textarea defaultValue={ch.notes || ""} onBlur={(e) => onNotes(e.target.value)} rows={7}
            placeholder="Equipment, personality traits, ideals, bonds, flaws, debts owed to ravens…"
            style={{ width: "100%", boxSizing: "border-box", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Chronicle</div>
          <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.8, maxHeight: 220, overflowY: "auto" }}>
            {ch.log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </div>

      {rollSpec && (
        <RollTray key={JSON.stringify(rollSpec) + advMode} title={rollSpec.title} mode={advMode} parts={rollSpec.parts}
          kind={rollSpec.kind} abil={rollSpec.abil} proficient={rollSpec.proficient} ch={ch} onClose={() => setRollSpec(null)} />
      )}
      {dmgRoll && (
        <DiceTray title={dmgRoll.title} dice={dmgRoll.dice} note={dmgRoll.note} bonus={dmgRoll.bonus} bonusLabel={dmgRoll.bonusLabel}
          acceptLabel="Done" onAccept={() => setDmgRoll(null)} />
      )}
    </div>
  );
}



/* ============ COMPENDIUM XML IMPORT ============ */
function parseCompendiumXML(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not valid XML");
  const out = { subs: {}, feats: [], spells: [], skippedClasses: [], featureTexts: {}, items: [] };
  const splitColon = (x) => { const m = x.match(/^([^:]+):\s*(.+)$/); return m ? [m[1].trim(), m[2].trim()] : null; };
  const splitParen = (x) => { const m = x.match(/^(.+?)\s*\(([^()]+)\)$/); return m ? [m[1].trim(), m[2].trim()] : null; };

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
        // the rules text library: keyed by the full feature name and its display forms
        keepText(t, txt);
        const pp = splitParen(t); if (pp) keepText(pp[0], txt);
        const cp = splitColon(t); if (cp) keepText(cp[1], txt);
      });
    });
    // Introducers: "A: Y". Members: "Y: F" or "F (Y)".
    const colonPairs = rows.map((r) => ({ ...r, m: splitColon(r.n) })).filter((r) => r.m);
    const parenPairs = rows.map((r) => ({ ...r, m: splitParen(r.n) })).filter((r) => r.m);
    // Members may drop a leading article the introducer keeps ("Hex Warrior (Hexblade)" under
    // "Otherworldly Patron: The Hexblade"), so compare via normSub.
    const memberCount = (y) =>
      colonPairs.filter((r) => normSub(r.m[0]) === normSub(y)).length + parenPairs.filter((r) => normSub(r.m[1]) === normSub(y)).length;
    let cands = new Set(colonPairs.map((r) => r.m[1]).filter((y) => memberCount(y) > 0));
    // Drop nested groups: every introducer of Y has a prefix that is itself a candidate
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

  doc.querySelectorAll("compendium > spell").forEach((sp) => {
    const name = sp.querySelector(":scope > name")?.textContent?.trim();
    if (!name) return;
    const grab = (tag) => sp.querySelector(`:scope > ${tag}`)?.textContent?.trim() || "";
    const level = +(sp.querySelector(":scope > level")?.textContent || 0);
    const text = [...sp.querySelectorAll(":scope > text")].map((t) => t.textContent).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    out.spells.push({ name, level, school: grab("school"), classes: grab("classes"), time: grab("time"), range: grab("range"), components: grab("components"), duration: grab("duration"), ritual: /^y/i.test(grab("ritual")), text });
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

/* ============ HOMEBREW FORGE ============ */
function HomebrewForge({ customs, onSave, onBack }) {
  const [tab, setTab] = useState("subclass");
  const [cls, setCls] = useState("Warlock");
  const [subName, setSubName] = useState("");
  const [rows, setRows] = useState([{ level: 1, text: "" }]);
  const [featName, setFeatName] = useState("");
  const [featDesc, setFeatDesc] = useState("");
  const [parsed, setParsed] = useState(null);
  const [importErr, setImportErr] = useState(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErr(null); setParsed(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const res = parseCompendiumXML(reader.result);
        const existingSubs = new Set(Object.values(customs.subs).flat().map((x) => x.name));
        Object.keys(res.subs).forEach((c) => { res.subs[c] = res.subs[c].filter((x) => !existingSubs.has(x.name)); if (!res.subs[c].length) delete res.subs[c]; });
        // duplicates are skipped — unless the incoming copy carries rules text the stored one lacks
        const oldFeats = new Map(customs.feats.map((f) => [f.name, f]));
        res.feats = res.feats.filter((f) => !oldFeats.has(f.name) || (f.text && !oldFeats.get(f.name).text));
        const oldSpells = new Map((customs.spells || []).map((x) => [x.name, x]));
        res.spells = res.spells.filter((x) => !oldSpells.has(x.name) || (x.text && !oldSpells.get(x.name).text) || oldSpells.get(x.name).ritual === undefined);
        const oldItems = new Set((customs.items || []).map((x) => x.name));
        res.items = res.items.filter((x) => !oldItems.has(x.name));
        setParsed(res);
      } catch (err) { setImportErr(err.message || "Could not parse this file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const doImport = () => {
    const subs = { ...customs.subs };
    Object.entries(parsed.subs).forEach(([c, arr]) => { subs[c] = [...(subs[c] || []), ...arr]; });
    // same-name entries are replaced (text upgrades); everything else appends
    const inFeats = new Map(parsed.feats.map((f) => [f.name, f]));
    const feats = [...customs.feats.map((f) => inFeats.get(f.name) || f), ...parsed.feats.filter((f) => !customs.feats.some((o) => o.name === f.name))];
    const inSpells = new Map(parsed.spells.map((x) => [x.name, x]));
    const spells = [...(customs.spells || []).map((s) => inSpells.get(s.name) || s), ...parsed.spells.filter((x) => !(customs.spells || []).some((o) => o.name === x.name))];
    onSave({ subs, feats, spells, items: [...(customs.items || []), ...parsed.items], featureTexts: { ...(customs.featureTexts || {}), ...parsed.featureTexts } });
    setParsed(null);
  };
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState(null);

  const inp = { background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 10, color: T.ink, padding: 12, fontSize: 16, boxSizing: "border-box", WebkitAppearance: "none", maxWidth: "100%" };

  const saveSub = () => {
    const feats = {};
    rows.forEach((r) => {
      const t = r.text.trim();
      if (!t) return;
      feats[r.level] = (feats[r.level] || []).concat(t.split(";").map((x) => x.trim()).filter(Boolean));
    });
    const next = { ...customs, subs: { ...customs.subs, [cls]: [...(customs.subs[cls] || []), { name: subName.trim(), feats }] } };
    onSave(next);
    setSubName(""); setRows([{ level: 1, text: "" }]);
  };

  const saveFeat = () => {
    onSave({ ...customs, feats: [...customs.feats, { name: featName.trim(), desc: featDesc.trim() }] });
    setFeatName(""); setFeatDesc("");
  };

  const removeSub = (c, name) => onSave({ ...customs, subs: { ...customs.subs, [c]: customs.subs[c].filter((s) => s.name !== name) } });
  const removeFeat = (name) => onSave({ ...customs, feats: customs.feats.filter((f) => f.name !== name) });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20 }}>
      <button style={{ ...btn(false), marginBottom: 14 }} onClick={onBack}>← Roster</button>
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold }}>The Homebrew Forge</div>
        <div style={{ color: T.dim, fontSize: 13, marginTop: 4, marginBottom: 14 }}>
          Add your own subclasses and feats — from your books, your table, or your imagination. They appear alongside SRD options everywhere in the app and persist between sessions.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button style={{ ...btn(tab === "subclass"), padding: "6px 14px" }} onClick={() => setTab("subclass")}>Subclass</button>
          <button style={{ ...btn(tab === "feat"), padding: "6px 14px" }} onClick={() => setTab("feat")}>Feat</button>
          <button style={{ ...btn(tab === "io"), padding: "6px 14px" }} onClick={() => setTab("io")}>Import / Export</button>
        </div>

        {tab === "subclass" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={cls} onChange={(e) => setCls(e.target.value)} style={{ ...inp, flex: "0 0 160px" }}>
                {Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder={`${CLASSES[cls].subName} name`} style={{ ...inp, flex: 1, minWidth: 180 }} />
            </div>
            <div style={{ color: T.dim, fontSize: 12 }}>{cls} gains its {CLASSES[cls].subName.toLowerCase()} at level {CLASSES[cls].subLvl}. Separate multiple features in one row with semicolons.</div>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <select value={r.level} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, level: +e.target.value } : x)))} style={{ ...inp, flex: "0 0 90px" }}>
                  {Array.from({ length: 20 }, (_, l) => l + 1).map((l) => <option key={l} value={l}>Lvl {l}</option>)}
                </select>
                <input value={r.text} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  placeholder="Feature name(s)" style={{ ...inp, flex: 1 }} />
                <button style={{ ...btn(false), borderColor: T.blood, color: T.blood, padding: "4px 10px" }} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={btn(false)} onClick={() => setRows([...rows, { level: 1, text: "" }])}>＋ Feature row</button>
              <button style={{ ...btn(true), opacity: subName.trim() && rows.some((r) => r.text.trim()) ? 1 : 0.4 }}
                disabled={!subName.trim() || !rows.some((r) => r.text.trim())} onClick={saveSub}>Forge Subclass</button>
            </div>
          </div>
        )}

        {tab === "io" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15, marginBottom: 4 }}>Compendium XML import</div>
              Feed me a compendium XML file (FightClub5 format) from your own collection. Parsing happens entirely in your browser — subclasses, feats, and spells are extracted and merged into your custom content. Duplicates of anything already present are skipped. Spells tagged for a subclass (e.g. “Warlock (Archfey)”) power that subclass's expanded or always-prepared spell list. Feature names are stored without rules text; your books remain the rules text.
            </div>
            <label style={{ ...btn(true), textAlign: "center", cursor: "pointer" }}>
              Choose XML file…
              <input type="file" accept=".xml,text/xml" onChange={onFile} style={{ display: "none" }} />
            </label>
            {importErr && <div style={{ color: T.blood, fontSize: 13 }}>{importErr}</div>}
            {parsed && (
              <div style={{ ...card, background: T.panel2, padding: 14 }}>
                <div style={{ color: T.gold, marginBottom: 6 }}>Ready to devour:</div>
                {Object.entries(parsed.subs).map(([c, arr]) => (
                  <div key={c} style={{ color: T.ink, fontSize: 13 }}>{c}: {arr.map((x) => x.name).join(", ")}</div>
                ))}
                <div style={{ color: T.ink, fontSize: 13, marginTop: 4 }}>{parsed.feats.length} new feats · {parsed.spells.length} new spells · {(parsed.items || []).length} new items</div>
                {parsed.skippedClasses?.length > 0 && <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>Skipped unknown base classes (not yet supported): {parsed.skippedClasses.join(", ")}</div>}
                {Object.keys(parsed.subs).length === 0 && parsed.feats.length === 0 && parsed.spells.length === 0 && (parsed.items || []).length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>Nothing new found — everything in this file already exists here, or no recognizable classes/feats were present.</div>}
                {(Object.keys(parsed.subs).length > 0 || parsed.feats.length > 0 || parsed.spells.length > 0 || (parsed.items || []).length > 0) && (
                  <button style={{ ...btn(true), marginTop: 10 }} onClick={doImport}>Import All</button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "io" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15, marginBottom: 4 }}>Or: JSON import / export</div>
              Paste JSON to bulk-load or back up your content. Shape:
              <pre style={{ background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 8, padding: 10, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: "100%", boxSizing: "border-box", color: T.ink }}>{`{
  "subs": {
    "Warlock": [
      { "name": "My Patron",
        "feats": { "1": ["Feature A"], "6": ["Feature B"] } }
    ]
  },
  "feats": [ { "name": "My Feat", "desc": "What it does" } ]
}`}</pre>
              Imports merge with existing content. Class names must match: {Object.keys(CLASSES).join(", ")}.
            </div>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8}
              placeholder="Paste JSON here…" style={{ ...inp, fontFamily: "monospace", fontSize: 12, resize: "vertical" }} />
            {importMsg && <div style={{ color: importMsg.ok ? T.green : T.blood, fontSize: 13 }}>{importMsg.text}</div>}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={btn(false)} onClick={() => {
                setImportText(JSON.stringify(customs, null, 2));
                setImportMsg({ ok: true, text: "Current custom content exported to the box above — copy it somewhere safe." });
              }}>Export current</button>
              <button style={{ ...btn(true), opacity: importText.trim() ? 1 : 0.4 }} disabled={!importText.trim()} onClick={() => {
                try {
                  const data = JSON.parse(importText);
                  const next = { subs: { ...customs.subs }, feats: [...customs.feats], spells: [...(customs.spells || [])], featureTexts: { ...(customs.featureTexts || {}), ...(data.featureTexts || {}) } };
                  let nSubs = 0, nFeats = 0;
                  if (data.subs) Object.entries(data.subs).forEach(([c, arr]) => {
                    if (!CLASSES[c] || !Array.isArray(arr)) return;
                    const clean = arr.filter((x) => x && typeof x.name === "string" && x.feats && typeof x.feats === "object")
                      .filter((x) => !(next.subs[c] || []).some((e) => e.name === x.name) && !CLASSES[c].subs.includes(x.name));
                    if (clean.length) { next.subs[c] = [...(next.subs[c] || []), ...clean]; nSubs += clean.length; }
                  });
                  if (Array.isArray(data.feats)) {
                    const clean = data.feats.filter((f) => f && typeof f.name === "string")
                      .filter((f) => !next.feats.some((e) => e.name === f.name) && !FEATS.some((e) => e.name === f.name))
                      .map((f) => ({ name: f.name, desc: f.desc || "" }));
                    next.feats = [...next.feats, ...clean]; nFeats = clean.length;
                  }
                  let nSpells = 0;
                  if (Array.isArray(data.spells)) {
                    const have = new Set(next.spells.map((x) => x.name));
                    const clean = data.spells.filter((x) => x && typeof x.name === "string" && !have.has(x.name))
                      .map((x) => ({ name: x.name, level: +x.level || 0, school: x.school || "", classes: x.classes || "" }));
                    next.spells = [...next.spells, ...clean]; nSpells = clean.length;
                  }
                  onSave(next);
                  setImportMsg({ ok: true, text: `Imported ${nSubs} subclass(es), ${nFeats} feat(s), ${nSpells} spell(s). Duplicates and unknown classes were skipped.` });
                  setImportText("");
                } catch (e) {
                  setImportMsg({ ok: false, text: "That JSON did not parse. Check for trailing commas and mismatched braces." });
                }
              }}>Import</button>
            </div>
          </div>
        )}

        {tab === "feat" && (
          <div style={{ display: "grid", gap: 10 }}>
            <input value={featName} onChange={(e) => setFeatName(e.target.value)} placeholder="Feat name" style={inp} />
            <input value={featDesc} onChange={(e) => setFeatDesc(e.target.value)} placeholder="Short rules summary" style={inp} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={{ ...btn(true), opacity: featName.trim() ? 1 : 0.4 }} disabled={!featName.trim()} onClick={saveFeat}>Forge Feat</button>
            </div>
          </div>
        )}

      </div>

      <div style={{ ...card, padding: 16, marginTop: 14 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 16, marginBottom: 8 }}>Your Forged Content</div>
        {Object.entries(customs.subs).flatMap(([c, arr]) => arr.map((s) => (
          <div key={c + s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.edge}` }}>
            <div>
              <span style={{ color: T.ink, fontWeight: 700 }}>{s.name}</span>
              <span style={{ color: T.dim, fontSize: 12 }}> — {c} · levels {Object.keys(s.feats).join(", ")}</span>
            </div>
            <button style={{ ...btn(false), borderColor: T.blood, color: T.blood, padding: "2px 10px" }} onClick={() => removeSub(c, s.name)}>✕</button>
          </div>
        )))}
        {customs.feats.map((f) => (
          <div key={f.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.edge}` }}>
            <div><span style={{ color: T.ink, fontWeight: 700 }}>{f.name}</span><span style={{ color: T.dim, fontSize: 12 }}> — {f.desc}</span></div>
            <button style={{ ...btn(false), borderColor: T.blood, color: T.blood, padding: "2px 10px" }} onClick={() => removeFeat(f.name)}>✕</button>
          </div>
        ))}
        {Object.keys(customs.subs).length === 0 && customs.feats.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>Nothing yet. The anvil awaits.</div>}
      </div>
    </div>
  );
}

/* ============ APP ============ */
export default function App() {
  const [chars, setChars] = useState(null);
  const [view, setView] = useState("roster");
  const [activeId, setActiveId] = useState(null);
  const [leveling, setLeveling] = useState(false);
  const [customs, setCustoms] = useState(EMPTY_CUSTOM);
  const [ioMsg, setIoMsg] = useState("");

  useEffect(() => { loadChars().then(setChars); loadCustom().then(setCustoms); }, []);
  const persistCustom = (next) => { setCustoms(next); saveCustom(next); };
  const persist = (next) => { setChars(next); saveChars(next); };

  if (chars === null) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontFamily: "Georgia, serif" }}>
      Unsealing the vault…
    </div>
  );

  const active = chars.find((c) => c.id === activeId);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif', overflowX: "hidden", paddingBottom: "calc(60px + env(safe-area-inset-bottom))", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes diceDrop {
          0% { transform: translateY(-90px) scale(0.7); opacity: 0; }
          55% { transform: translateY(0) scale(1.06); opacity: 1; }
          72% { transform: translateY(-14px) scale(0.98); }
          86% { transform: translateY(0) scale(1.02); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes diceTumbleA { from { transform: rotate3d(1, 0.7, 0.35, -1620deg); } to { transform: rotate3d(1, 0.7, 0.35, 0deg); } }
        @keyframes diceTumbleB { from { transform: rotate3d(0.6, 1, 0.45, 1440deg); } to { transform: rotate3d(0.6, 1, 0.45, 0deg); } }
        [data-lore] { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      `}</style>
      <div style={{ textAlign: "center", padding: "26px 14px 6px" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, color: T.gold, letterSpacing: 1 }}>The Adventurer's Ledger</div>
        <div style={{ color: T.dim, fontSize: 13 }}>5e SRD character forge · full multiclass rules · the dice remember</div>
      </div>

      {view === "roster" && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...btn(true), flex: 2, padding: 14, fontSize: 16 }} onClick={() => setView("create")}>＋ Forge a New Character</button>
            <button style={{ ...btn(false), flex: 1, padding: 14 }} onClick={() => setView("forge")}><Icon name="hammer" /> Homebrew Forge</button>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
            <button style={{ ...btn(false), fontSize: 13 }} onClick={() => exportLedger(chars, customs)} disabled={chars.length === 0 && customs.feats.length === 0 && customs.spells.length === 0}><Icon name="down" size={13} /> Export ledger</button>
            <label style={{ ...btn(false), fontSize: 13, display: "inline-block" }}>
              <Icon name="up" size={13} /> Import ledger
              <input type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    try {
                      const merged = mergeLedger(JSON.parse(r.result), chars, customs);
                      persist(merged.chars);
                      persistCustom(merged.customs);
                      setIoMsg(`Imported ${merged.added} character${merged.added === 1 ? "" : "s"}.`);
                    } catch (err) {
                      setIoMsg("Import failed — that file is not a ledger export.");
                    }
                  };
                  r.readAsText(f);
                }} />
            </label>
            {ioMsg && <span style={{ color: T.dim, fontSize: 13 }}>{ioMsg}</span>}
          </div>
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {chars.length === 0 && <div style={{ ...card, padding: 24, textAlign: "center", color: T.dim }}>The ledger is empty. Forge your first soul above.</div>}
            {chars.map((c) => (
              <div key={c.id} onClick={() => { setActiveId(c.id); setView("sheet"); }}
                style={{ ...card, padding: 14, display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}>
                <Portrait photo={c.photo} size={56} name={c.name} />
                <div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: T.gold }}>{c.name}</div>
                  <div style={{ color: T.dim, fontSize: 13 }}>{(() => {
                    const hpMax = effMaxHp(c), nFx = effectsOf(c).length;
                    return <>{c.race} · {c.classes.map((x, i) => <span key={x.name}>{i > 0 ? " / " : ""}<ClassTag name={x.name} size={12} /> {x.level}</span>)} · Level {totalLevel(c)} · {c.dmg ? `${Math.max(0, hpMax - c.dmg)}/` : ""}{hpMax} HP{nFx ? ` · ${nFx} active effect${nFx === 1 ? "" : "s"}` : ""}</>;
                  })()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "forge" && (
        <HomebrewForge customs={customs} onSave={persistCustom} onBack={() => setView("roster")} />
      )}

      {view === "create" && (
        <CreateWizard customs={customs} onCancel={() => setView("roster")} onDone={(ch) => { persist([...chars, ch]); setActiveId(ch.id); setView("sheet"); }} />
      )}

      {view === "sheet" && active && (
        <Sheet ch={active} customs={customs} onBack={() => setView("roster")}
          onUpdate={(patch) => persist(chars.map((c) => (c.id === active.id ? { ...c, ...patch } : c)))}
          onSpells={(sp) => persist(chars.map((c) => (c.id === active.id ? { ...c, spells: sp } : c)))}
          onNotes={(n) => persist(chars.map((c) => (c.id === active.id ? { ...c, notes: n } : c)))}
          onInvocations={(inv) => persist(chars.map((c) => (c.id === active.id ? { ...c, invocations: inv } : c)))} onLevelUp={() => setLeveling(true)}
          onDelete={() => { persist(chars.filter((c) => c.id !== active.id)); setView("roster"); }}
          onPhoto={(p) => persist(chars.map((c) => (c.id === active.id ? { ...c, photo: p } : c)))} />
      )}

      {leveling && active && (
        <LevelUp ch={active} customs={customs} onCancel={() => setLeveling(false)}
          onDone={(next) => { persist(chars.map((c) => (c.id === next.id ? next : c))); setLeveling(false); }} />
      )}

      <LoreSheet customs={customs} />
    </div>
  );
}
