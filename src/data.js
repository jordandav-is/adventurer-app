// SRD 5.1 / 5.2 data (CC-BY-4.0)

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const RACES = {};
const LANGS = ["Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orc","Abyssal","Aquan","Auran","Celestial","Deep Speech","Draconic","Infernal","Primordial","Sylvan","Undercommon"];
const RACE_LANGS = {};
const ANCESTRIES = { Black: "Acid", Blue: "Lightning", Brass: "Fire", Bronze: "Lightning", Copper: "Acid", Gold: "Fire", Green: "Poison", Red: "Fire", Silver: "Cold", White: "Cold" };
const ALL_SKILLS = ["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"];
const BACKGROUNDS = {};
const ALIGNMENTS = ["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil"];
const PROF_TEXT = {
  Artificer: "Light & medium armor, shields, simple weapons, thieves' tools, tinker's tools, one type of artisan's tools",
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
const START_GOLD = { Artificer: [5, 10], Barbarian: [2, 10], Bard: [5, 10], Cleric: [5, 10], Druid: [2, 10], Fighter: [5, 10], Monk: [5, 1], Paladin: [5, 10], Ranger: [5, 10], Rogue: [4, 10], Sorcerer: [3, 10], Warlock: [4, 10], Wizard: [4, 10] };
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
  Artificer: {
    fixed: [["Thieves' Tools", 1], ["Dungeoneer's Pack", 1]],
    slots: [
      { name: "Weapon", options: [{ label: "Two simple weapons", pick: "simple", n: 2 }] },
      { name: "Armor", options: [{ label: "Studded Leather Armor", items: [["Studded Leather Armor", 1]] }, { label: "Scale Mail", items: [["Scale Mail", 1]] }] },
      { name: "Ranged", options: [{ label: "Light Crossbow & 20 bolts", items: [["Light Crossbow", 1], ["Crossbow Bolts", 20]] }] },
    ],
  },
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
const baseSubName = (sub) => (sub || "").replace(/\s*\([^)]*\)$/, "");
const normSub = (s) => {
  let x = (s || "").toLowerCase().trim();
  const prefix = /^(the|college of|circle of|oath of|way of|path of|school of)\s+/;
  while (prefix.test(x)) x = x.replace(prefix, "");
  return x.replace(/\s+domain$/, "").trim();
};
const GRANTED_SUB_CLASSES = { Cleric: "Domain spells", Paladin: "Oath spells", Druid: "Circle spells" };
const SKILL_ABIL = { Acrobatics: "dex", "Animal Handling": "wis", Arcana: "int", Athletics: "str", Deception: "cha", History: "int", Insight: "wis", Intimidation: "cha", Investigation: "int", Medicine: "wis", Nature: "int", Perception: "wis", Performance: "cha", Persuasion: "cha", Religion: "int", "Sleight of Hand": "dex", Stealth: "dex", Survival: "wis" };
const MC_PREREQ = {
  Artificer: [{ int: 13 }],
  Barbarian: [{ str: 13 }], Bard: [{ cha: 13 }], Cleric: [{ wis: 13 }], Druid: [{ wis: 13 }],
  Fighter: [{ str: 13 }, { dex: 13 }], Monk: [{ dex: 13, wis: 13 }], Paladin: [{ str: 13, cha: 13 }],
  Ranger: [{ wis: 13 }], Rogue: [{ dex: 13 }], Sorcerer: [{ cha: 13 }], Warlock: [{ cha: 13 }], Wizard: [{ int: 13 }],
};
const MC_PROFS = {
  Artificer: "Light & medium armor, shields, thieves' tools, tinker's tools",
  Barbarian: "Shields, simple & martial weapons", Bard: "Light armor, one skill, one instrument",
  Cleric: "Light & medium armor, shields", Druid: "Light & medium armor, shields (nonmetal)",
  Fighter: "Light & medium armor, shields, simple & martial weapons", Monk: "Simple weapons, shortswords",
  Paladin: "Light & medium armor, shields, simple & martial weapons",
  Ranger: "Light & medium armor, shields, simple & martial weapons, one skill",
  Rogue: "Light armor, one skill, thieves' tools", Sorcerer: "None", Warlock: "Light armor, simple weapons", Wizard: "None",
};
const MC_SKILL_GRANT = { Bard: 1, Ranger: 1, Rogue: 1 };
const ASI = "Ability Score Improvement";
const CLASSES = {};
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
const FEAT_MECHANICS = {
  "Alert": { init: true },
  "Tough": { hpPerLevel: 2 },
  "Medium Armor Master": { mediumDexCap: 3 },
  "Resilient": { saveFromBump: true },
  "Mobile": { speed: 10 },
  "Squat Nimbleness (Dexterity)": { speed: 5 },
  "Squat Nimbleness (Strength)": { speed: 5 },
  ...Object.fromEntries(ABILITIES.map((a) => [`Resilient (${ABIL_NAMES[a]})`, { save: a, bump: [a] }])),
};
const CASTER_LISTS = ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock", "Wizard"];
const FEAT_PICKS = {
  "Magic Initiate": { choice: { label: "Spell list", options: ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock", "Wizard"] }, spells: { cantrips: 2, level1: 1, class: "$choice" } },
  "Ritual Caster": { choice: { label: "Ritual book's list", options: ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock", "Wizard"] }, spells: { level1: 2, ritual: true, class: "$choice" } },
  "Elemental Adept": { choice: { label: "Damage type", options: ["Acid", "Cold", "Fire", "Lightning", "Thunder"] } },
  "Fey Touched": { spells: { level1: 1, schools: ["D", "EN"] } },
  "Fey-Touched": { spells: { level1: 1, schools: ["D", "EN"] } },
  "Shadow Touched": { spells: { level1: 1, schools: ["I", "N"] } },
  "Shadow-Touched": { spells: { level1: 1, schools: ["I", "N"] } },
  "Wood Elf Magic": { spells: { cantrips: 1 } },
  "Artificer Initiate": { spells: { cantrips: 1, level1: 1, class: "Artificer" } },
  "Fighting Initiate": { choice: { label: "Fighting Style", options: ["Archery", "Blind Fighting", "Defense", "Dueling", "Great Weapon Fighting", "Interception", "Protection", "Superior Technique", "Thrown Weapon Fighting", "Two-Weapon Fighting", "Unarmed Fighting"] } },
  "Metamagic Adept": { choice: { label: "Metamagic", options: ["Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell", "Quickened Spell", "Seeking Spell", "Subtle Spell", "Transmuted Spell", "Twinned Spell"] } },
  "Skilled": { skills: { n: 3 } },
  "Observant": { skills: { n: 1, from: ["Insight", "Investigation", "Perception"] } },
  "Boon of Skill": { allSkills: true, expertise: { n: 3 } },
  "Crafter": { note: "Pick your three artisan's tools at the table — the sheet doesn't track tool proficiencies." },
  "Musician": { note: "Pick your three instruments at the table — the sheet doesn't track instrument proficiencies." },
  ...Object.fromEntries(CASTER_LISTS.map((c) => [`Magic Initiate (${c})`, { spells: { cantrips: 2, level1: 1, class: c } }])),
  ...Object.fromEntries(CASTER_LISTS.map((c) => [`Ritual Caster (${c})`, { spells: { level1: 2, ritual: true, class: c } }])),
  "Martial Adept": { maneuvers: { n: 2 } },
  "Linguist": { langs: { n: 3 } },
  "Prodigy": { skills: { n: 1 }, langs: { n: 1 }, expertise: { n: 1 }, note: "Also grants one tool proficiency — note it at the table." },
  "Weapon Master (Strength)": { note: "Pick your four weapon proficiencies at the table — the sheet doesn't track them." },
  "Weapon Master (Dexterity)": { note: "Pick your four weapon proficiencies at the table — the sheet doesn't track them." },
  "Wood Elf Magic": { spells: { cantrips: 1, class: "Druid" } },
  "Fey Teleportation (Charisma)": { grantLangs: ["Sylvan"] },
  "Fey Teleportation (Intelligence)": { grantLangs: ["Sylvan"] },
  "Aberrant Dragonmark": { spells: { cantrips: 1, level1: 1, class: "Sorcerer" } },
};
const INVOCATIONS = (l) => (l >= 18 ? 8 : l >= 15 ? 7 : l >= 12 ? 6 : l >= 9 ? 5 : l >= 7 ? 4 : l >= 5 ? 3 : l >= 2 ? 2 : 0);
const CANTRIPS_KNOWN = {
  Artificer: (l) => (l >= 14 ? 4 : l >= 10 ? 3 : 2),
  Bard: (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2), Cleric: (l) => (l >= 10 ? 5 : l >= 4 ? 4 : 3),
  Druid: (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2), Sorcerer: (l) => (l >= 10 ? 6 : l >= 4 ? 5 : 4),
  Warlock: (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2), Wizard: (l) => (l >= 10 ? 5 : l >= 4 ? 4 : 3),
};
const SPELLS_KNOWN = {
  Bard: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22],
  Sorcerer: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],
  Warlock: [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
};
const RANGER_PREPARED = [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15];
const SPELL_ABILITY = { Artificer: "int", Bard: "cha", Cleric: "wis", Druid: "wis", Paladin: "cha", Ranger: "wis", Sorcerer: "cha", Warlock: "cha", Wizard: "int" };
const MC_SLOTS = [
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
const HALF_SLOTS = [
  [],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],
  [4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3],[4,3,3,3],[4,3,3,3,1],[4,3,3,3,2],
];
const HALF1_SLOTS = [
  [2],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],
  [4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2],
];
const PACT = (l) => (l >= 17 ? { n: 4, lvl: 5 } : l >= 11 ? { n: 3, lvl: 5 } : l >= 9 ? { n: 2, lvl: 5 } : l >= 7 ? { n: 2, lvl: 4 } : l >= 5 ? { n: 2, lvl: 3 } : l >= 3 ? { n: 2, lvl: 2 } : l >= 2 ? { n: 2, lvl: 1 } : { n: 1, lvl: 1 });
const CASTING_CLASSES = new Set(["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard", "Artificer"]);
const KENSEI_WEAPONS = ["Battleaxe", "Club", "Dagger", "Flail", "Glaive", "Greataxe", "Greatclub", "Greatsword", "Halberd", "Handaxe", "Javelin", "Light Hammer", "Longbow", "Longsword", "Mace", "Maul", "Morningstar", "Pike", "Quarterstaff", "Rapier", "Scimitar", "Shortbow", "Shortsword", "Sickle", "Spear", "Trident", "War Pick", "Warhammer", "Whip"];
const CHOICE_GROUPS = [
  { key: "Infusions", cls: "Artificer", source: { type: "AI" }, counts: { 2: 4, 6: 2, 10: 2, 14: 2, 18: 2 } },
  { key: "Maneuvers", cls: "Fighter", sub: "Battle Master", source: { type: "MV:B" }, counts: { 3: 3, 7: 2, 10: 2, 15: 2 } },
  { key: "Arcane Shot Options", cls: "Fighter", sub: "Arcane Archer", source: { type: "AS" }, counts: { 3: 2, 7: 1, 10: 1, 15: 1, 18: 1 } },
  { key: "Trick Shots", cls: "Fighter", sub: "Gunslinger", source: { spellTag: true }, counts: { 3: 2, 7: 1, 10: 1, 15: 1, 18: 1 } },
  { key: "Runes", cls: "Fighter", sub: "Rune Knight", source: { type: "RN" }, counts: { 3: 2, 7: 1, 10: 1, 15: 1 } },
  { key: "Elemental Disciplines", cls: "Monk", sub: "Way of the Four Elements", source: { type: "ED" }, counts: { 3: 1, 6: 1, 11: 1, 17: 1 } },
  { key: "Kensei Weapons", cls: "Monk", sub: "Way of the Kensei", source: { list: KENSEI_WEAPONS }, counts: { 3: 2, 6: 1, 11: 1, 17: 1 } },
  { key: "Totem Spirit", cls: "Barbarian", sub: "Path of the Totem Warrior", source: { featurePrefix: "Totem Spirit" }, counts: { 3: 1 } },
  { key: "Aspect of the Beast", cls: "Barbarian", sub: "Path of the Totem Warrior", source: { featurePrefix: "Aspect of the Beast" }, counts: { 6: 1 } },
  { key: "Totemic Attunement", cls: "Barbarian", sub: "Path of the Totem Warrior", source: { featurePrefix: "Totemic Attunement" }, counts: { 14: 1 } },
  { key: "Storm Aura", cls: "Barbarian", sub: "Path of the Storm Herald", source: { list: ["Storm Aura: Desert", "Storm Aura: Sea", "Storm Aura: Tundra"] }, counts: { 3: 1 } },
  { key: "Hunter's Prey", cls: "Ranger", sub: "Hunter", source: { list: ["Colossus Slayer", "Horde Breaker"] }, counts: { 3: 1 } },
  { key: "Defensive Tactics", cls: "Ranger", sub: "Hunter", source: { list: ["Escape the Horde", "Multiattack Defense"] }, counts: { 7: 1 } },
  { key: "Dragon Ancestor", cls: "Sorcerer", sub: "Draconic Bloodline", source: { featureSuffix: "Dragon Ancestor" }, counts: { 1: 1 } },
];
const CHOICE_KEYS = new Set(CHOICE_GROUPS.map((g) => g.key));
const ITEM_TYPES = { LA: "Light armor", MA: "Medium armor", HA: "Heavy armor", S: "Shield", M: "Melee weapon", R: "Ranged weapon", A: "Ammunition", G: "Adventuring gear", W: "Wondrous item", P: "Potion", RG: "Ring", WD: "Wand", ST: "Staff", SC: "Scroll", RD: "Rod", "$": "Currency" };
const DMG_TYPES = { S: "slashing", P: "piercing", B: "bludgeoning", R: "radiant", N: "necrotic", F: "fire", C: "cold", L: "lightning", T: "thunder", A: "acid", PS: "poison", PSY: "psychic", FC: "force" };
const WEAPON_PROPS = { A: "ammunition", F: "finesse", H: "heavy", L: "light", LD: "loading", R: "reach", S: "special", T: "thrown", "2H": "two-handed", V: "versatile", M: "martial" };
const SOURCE_ABBR = [
  ["Player's Handbook", "PHB"], ["Xanathar's Guide", "XGtE"], ["Sword Coast Adventurer's Guide", "SCAG"], ["Tasha's Cauldron", "TCoE"],
  ["Dungeon Master's Guide", "DMG"], ["Monster Manual", "MM"], ["Volo's Guide", "VGtM"], ["Mordenkainen's Tome", "MToF"],
  ["Elemental Evil", "EEPC"], ["Guildmasters' Guide", "GGtR"], ["Eberron", "ERLW"], ["Explorer's Guide to Wildemount", "EGtW"],
  ["Acquisitions Incorporated", "AI"], ["Curse of Strahd", "CoS"], ["Princes of the Apocalypse", "PotA"], ["Unearthed Arcana", "UA"], ["Wayfinder's Guide", "WGtE"],
];
const CLASS_GEAR_PROFS = {
  Artificer: { armor: ["LA", "MA", "S"], weapons: { simple: true } },
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
  Artificer: { armor: ["LA", "MA", "S"], weapons: {} },
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
const SIZE_RANK = { Tiny: 0, Small: 1, Medium: 2, Large: 3, Huge: 4, Gargantuan: 5 };
const DMG_WORD_CODE = { acid: "A", bludgeoning: "B", cold: "C", fire: "F", force: "FC", lightning: "L", necrotic: "N", piercing: "P", poison: "PS", psychic: "PSY", radiant: "R", slashing: "S", thunder: "T" };
const HEALING_TIERS = [[/supreme/i, { n: 10, sides: 4, plus: 20 }], [/superior/i, { n: 8, sides: 4, plus: 8 }], [/greater/i, { n: 4, sides: 4, plus: 4 }], [/./, { n: 2, sides: 4, plus: 2 }]];
const POTION_EFFECT_ALIAS = { speed: "haste", flying: "fly", growth: "enlarge", diminution: "reduce" };
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
const STD_ARRAY = [15, 14, 13, 12, 10, 8];
const PB_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const ABIL_MIN = 1, ABIL_MAX = 30;
const SCHOOL_NAMES = { A: "Abjuration", C: "Conjuration", D: "Divination", EN: "Enchantment", EV: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation" };
const ARCANUM_UNLOCK = { 6: 11, 7: 13, 8: 15, 9: 17 };
const PREP_ALL_CLASSES = ["Artificer", "Cleric", "Druid", "Paladin", "Ranger"];
export { ABILITIES, ABIL_NAMES, RACES, LANGS, RACE_LANGS, ANCESTRIES, ALL_SKILLS, BACKGROUNDS, ALIGNMENTS, PROF_TEXT, START_GOLD, GEAR_LISTS, STARTING_GEAR, LAND_TERRAINS, baseSubName, normSub, GRANTED_SUB_CLASSES, SKILL_ABIL, MC_PREREQ, MC_PROFS, MC_SKILL_GRANT, ASI, CLASSES, SRD_FOOT, CLASS_BLURB, FEAT_MECHANICS, FEAT_PICKS, INVOCATIONS, CANTRIPS_KNOWN, SPELLS_KNOWN, RANGER_PREPARED, SPELL_ABILITY, MC_SLOTS, HALF_SLOTS, HALF1_SLOTS, PACT, CASTING_CLASSES, CHOICE_GROUPS, CHOICE_KEYS, ITEM_TYPES, DMG_TYPES, WEAPON_PROPS, SOURCE_ABBR, CLASS_GEAR_PROFS, MC_GEAR_PROFS, SIZE_RANK, DMG_WORD_CODE, HEALING_TIERS, POTION_EFFECT_ALIAS, LANG_INFO, SKILL_INFO, ABILITY_INFO, CORE_FEATURE_INFO, STD_ARRAY, PB_COST, ABIL_MIN, ABIL_MAX, SCHOOL_NAMES, ARCANUM_UNLOCK, PREP_ALL_CLASSES };
