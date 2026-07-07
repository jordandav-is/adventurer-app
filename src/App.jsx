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
function subSpellData(subclass) {
  if (!subclass) return null;
  const base = baseSubName(subclass);
  if (base === "Circle of the Land") {
    const m = subclass.match(/\(([^)]+)\)/);
    const terr = m && LAND_TERRAINS[m[1]];
    return terr ? { type: "granted", label: `Circle spells — ${m[1]} (always prepared)`, spells: terr } : null;
  }
  return SUB_SPELLS[base] || null;
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
/* A spell record's classes string mentions the base class name, e.g. "Bard, Cleric" or "Fighter (Eldritch Knight)" */
const spellFitsClass = (sp, clsName) => new RegExp(`(^|[,\\s])${clsName}(?![a-z])`, "i").test(sp.classes || "");

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

/* ============ ANIMATED DICE ============ */
const CUBE_LAND = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

function CubeDie({ final, delay, size = 68 }) {
  const [t, setT] = useState(null);
  useEffect(() => {
    const [rx, ry] = CUBE_LAND[final];
    const id = setTimeout(() => setT(`rotateX(${rx + 1080}deg) rotateY(${ry + 720}deg)`), 60 + delay);
    return () => clearTimeout(id);
  }, [final, delay]);
  const face = (v, tf) => (
    <div key={v} style={{
      position: "absolute", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(145deg, #d9b45e, #b8933f)", color: "#241a10", borderRadius: 10,
      border: "2px solid #8a6c2c", fontSize: size * 0.46, fontWeight: 800, fontFamily: "Georgia, serif",
      transform: tf + ` translateZ(${size / 2}px)`, backfaceVisibility: "hidden",
    }}>{v}</div>
  );
  return (
    <div style={{ width: size, height: size, perspective: 700, animation: `diceDrop 1.3s cubic-bezier(.22,1.6,.36,1) ${delay}ms both` }}>
      <div style={{
        width: size, height: size, position: "relative", transformStyle: "preserve-3d",
        transform: t || `rotateX(${-45 - Math.random() * 90}deg) rotateY(${45 + Math.random() * 90}deg)`,
        transition: t ? `transform ${1.15 + delay / 1000}s cubic-bezier(.18,.9,.26,1.04)` : "none",
      }}>
        {face(1, "rotateY(0deg)")}{face(6, "rotateY(180deg)")}{face(3, "rotateY(90deg)")}
        {face(4, "rotateY(-90deg)")}{face(5, "rotateX(-90deg)")}{face(2, "rotateX(90deg)")}
      </div>
    </div>
  );
}

function PolyDie({ sides, final, delay, size = 72 }) {
  const [face, setFace] = useState(1);
  const [done, setDone] = useState(false);
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    let alive = true;
    const start = Date.now();
    const dur = 1150 + delay;
    const tick = () => {
      if (!alive) return;
      const t = Date.now() - start;
      if (t >= dur) { setFace(final); setSpin(0); setDone(true); return; }
      setFace(1 + Math.floor(Math.random() * sides));
      setSpin((s) => s + 47 + Math.random() * 40);
      setTimeout(tick, 45 + Math.pow(t / dur, 2) * 220);
    };
    tick();
    return () => { alive = false; };
  }, [final, sides, delay]);
  const shape = sides === 20 ? "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
    : sides === 12 ? "polygon(50% 0%, 93% 31%, 77% 100%, 23% 100%, 7% 31%)"
    : sides === 10 ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
    : sides === 4 ? "polygon(50% 0%, 100% 100%, 0% 100%)" : "none";
  return (
    <div style={{ animation: `diceDrop 1.2s cubic-bezier(.22,1.6,.36,1) ${delay}ms both` }}>
      <div style={{
        width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? "linear-gradient(145deg, #d9b45e, #b8933f)" : T.panel2, color: done ? "#241a10" : T.gold,
        clipPath: shape, fontSize: size * 0.36, fontWeight: 800, fontFamily: "Georgia, serif",
        transform: done ? "rotate(0deg) scale(1)" : `rotate(${spin}deg) scale(0.9)`,
        transition: done ? "transform 260ms cubic-bezier(.2,1.8,.4,1), background 200ms" : "transform 60ms linear",
        filter: done ? "drop-shadow(0 0 14px #c9a44c66)" : "none",
      }}>{sides === 4 ? <span style={{ marginTop: size * 0.28 }}>{face}</span> : face}</div>
    </div>
  );
}

const Die = ({ sides, final, delay, size = 72 }) =>
  sides === 6 ? <CubeDie final={final} delay={delay} size={size} /> : <PolyDie sides={sides} final={final} delay={delay} size={size} />;

function DiceTray({ title, dice, dropLowest, onAccept, onReroll, acceptLabel = "Accept", note }) {
  // dice: [{sides, value}] — values pre-rolled; tray animates the reveal
  const [revealDone, setRevealDone] = useState(false);
  useEffect(() => {
    setRevealDone(false);
    const t = setTimeout(() => setRevealDone(true), 1300 + dice.length * 150);
    return () => clearTimeout(t);
  }, [dice]);
  const values = dice.map((d) => d.value);
  const lowIdx = dropLowest ? values.indexOf(Math.min(...values)) : -1;
  const total = values.reduce((s, v, i) => s + (i === lowIdx ? 0 : v), 0);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ ...card, padding: 28, textAlign: "center", minWidth: 320, maxWidth: "92vw" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold, marginBottom: 6 }}>{title}</div>
        {note && <div style={{ color: T.dim, fontSize: 13, marginBottom: 10 }}>{note}</div>}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", padding: "18px 0" }}>
          {dice.map((d, i) => (
            <div key={i} style={{ opacity: revealDone && i === lowIdx ? 0.3 : 1, transition: "opacity 400ms", position: "relative" }}>
              <Die sides={d.sides} final={d.value} delay={i * 150} />
              {revealDone && i === lowIdx && <div style={{ position: "absolute", top: -10, right: -6, color: T.blood, fontSize: 11, fontWeight: 700 }}>dropped</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 34, fontFamily: "Georgia, serif", color: revealDone ? T.ink : T.dim, minHeight: 44, transition: "color 300ms" }}>
          {revealDone ? total : "…"}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
          {onReroll && <button style={btn(false)} onClick={onReroll}>Roll Again</button>}
          <button style={{ ...btn(true), opacity: revealDone ? 1 : 0.4 }} disabled={!revealDone} onClick={() => onAccept(total, values)}>{acceptLabel}</button>
        </div>
      </div>
    </div>
  );
}
const roll = (sides) => 1 + Math.floor(Math.random() * sides);

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
const EMPTY_CUSTOM = { subs: {}, feats: [], spells: [] };
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
const allFeats = (customs) => FEATS.concat(customs?.feats || []);


/* ============ BUILD ADVISOR + LEVEL ROADMAP ============ */
const CLASS_GUIDES = {
  Barbarian: { role: "front-line brawler", primary: ["str"], secondary: ["con", "dex", "wis"], note: "Strength wins attacks, Constitution keeps Rage alive, Dexterity helps AC/initiative." },
  Bard: { role: "face / support caster", primary: ["cha"], secondary: ["dex", "con", "wis"], note: "Charisma drives spells and social pressure; Dexterity keeps you quick and alive." },
  Cleric: { role: "durable divine caster", primary: ["wis"], secondary: ["con", "str", "dex"], note: "Wisdom fuels prepared spells and save DCs; Constitution protects concentration." },
  Druid: { role: "controller / primal caster", primary: ["wis"], secondary: ["con", "dex"], note: "Wisdom is the engine; Constitution protects concentration on battlefield control." },
  Fighter: { role: "weapon specialist", primary: ["str"], secondary: ["con", "dex", "wis"], note: "Pick Strength for melee/heavy weapons or Dexterity for archery/finesse." },
  Monk: { role: "mobile skirmisher", primary: ["dex"], secondary: ["wis", "con"], note: "Dexterity and Wisdom both feed defense; Constitution keeps you from becoming paste." },
  Paladin: { role: "armored striker / aura anchor", primary: ["str"], secondary: ["cha", "con"], note: "Strength lands hits, Charisma later powers Aura of Protection and spells." },
  Ranger: { role: "scout / weapon caster", primary: ["dex"], secondary: ["wis", "con"], note: "Dexterity is the cleanest combat stat; Wisdom carries exploration and spellcasting." },
  Rogue: { role: "skill striker", primary: ["dex"], secondary: ["con", "wis", "cha"], note: "Dexterity drives attacks, AC, stealth, initiative, and most rogue nonsense." },
  Sorcerer: { role: "arcane blaster / controller", primary: ["cha"], secondary: ["con", "dex"], note: "Charisma sets your DC; Constitution guards concentration and your tiny hit die." },
  Warlock: { role: "short-rest arcane striker", primary: ["cha"], secondary: ["con", "dex"], note: "Charisma powers pact magic; Constitution and Dexterity prevent embarrassing collapse." },
  Wizard: { role: "prepared arcane problem-solver", primary: ["int"], secondary: ["con", "dex", "wis"], note: "Intelligence controls the spellbook; Constitution protects concentration." },
};
const uniqList = (arr) => arr.filter((x, i) => arr.indexOf(x) === i);
function guideForClass(clsName, styles = []) {
  const base = CLASS_GUIDES[clsName] || { role: "adventurer", primary: ["str"], secondary: ["con", "dex"], note: "Keep your attack or spell stat high and do not neglect Constitution." };
  if (clsName === "Fighter") {
    const dexStyle = styles.includes("Archery") || styles.includes("Two-Weapon Fighting");
    return dexStyle
      ? { ...base, primary: ["dex"], secondary: ["con", "wis", "str"], note: "Your style points toward Dexterity: ranged/finesse pressure, initiative, and AC." }
      : base;
  }
  return base;
}
function recommendedBaseScores(clsName, styles = []) {
  const guide = guideForClass(clsName, styles);
  const order = uniqList([...guide.primary, ...guide.secondary, "con", "dex", "wis", "str", "cha", "int"]);
  const next = {};
  order.slice(0, 6).forEach((a, i) => { next[a] = STD_ARRAY[i]; });
  ABILITIES.forEach((a) => { if (!next[a]) next[a] = 8; });
  return next;
}
function abilityGrade(score) {
  if (score >= 18) return { label: "excellent", color: T.green };
  if (score >= 16) return { label: "strong", color: T.gold };
  if (score >= 14) return { label: "workable", color: T.ink };
  return { label: "fragile", color: T.blood };
}
function acBaseline(clsName, subclass, abilities) {
  const dex = mod(abilities.dex);
  let val = 10 + dex;
  let label = "unarmored baseline";
  if (clsName === "Barbarian") { val = 10 + dex + mod(abilities.con); label = "Barbarian unarmored"; }
  if (clsName === "Monk") { val = 10 + dex + mod(abilities.wis); label = "Monk unarmored"; }
  if (clsName === "Sorcerer" && baseSubName(subclass) === "Draconic Bloodline") { val = 13 + dex; label = "Draconic Resilience"; }
  return { val, label };
}
function dominantClass(ch) {
  return ch.classes.reduce((best, c) => (c.level > best.level ? c : best), ch.classes[0]);
}
function slotSig(slots) {
  return slots && slots.length ? slots.map((n, i) => `${n}x${i + 1}`).join("|") : "";
}
function slotLabel(slots) {
  return slots && slots.length ? slots.map((n, i) => `L${i + 1}:${n}`).join(" · ") : "—";
}
function pactSig(classes) {
  const wl = classes.find((c) => c.name === "Warlock");
  if (!wl) return "";
  const p = PACT(wl.level);
  return `${p.n}x${p.lvl}`;
}
function pactLabel(classes) {
  const wl = classes.find((c) => c.name === "Warlock");
  if (!wl) return "";
  const p = PACT(wl.level);
  return `${p.n} pact slot${p.n === 1 ? "" : "s"} at level ${p.lvl}`;
}

function BuildAdvisor({ title = "Build Advisor", race, cls, level = 1, abilities, skills = [], styles = [], subclass, onApplyArray }) {
  const pb = profBonus(level);
  const guide = guideForClass(cls, styles);
  const primary = guide.primary[0];
  const spellStat = SPELL_ABILITY[cls];
  const spellM = spellStat ? mod(abilities[spellStat]) : null;
  const ac = acBaseline(cls, subclass, abilities);
  const nudges = [];
  if (abilities[primary] < 16) nudges.push(`Raise ${ABIL_NAMES[primary]} toward 16 before taking luxury feats.`);
  if (abilities.con < 14 && !["Rogue", "Monk"].includes(cls)) nudges.push("Constitution below 14 makes concentration and hit points feel cursed.");
  if (spellStat && abilities[spellStat] < 16) nudges.push(`${ABIL_NAMES[spellStat]} below 16 means softer spell DCs and spell attacks.`);
  if (!skills.includes("Perception")) nudges.push("Perception proficiency is not required, but it is the party's burglar alarm.");
  if (cls === "Paladin" && abilities.cha < 14) nudges.push("Plan to improve Charisma before Aura of Protection at Paladin 6.");
  if (nudges.length === 0) nudges.push("The bones are clean. Future ASIs can chase damage, DCs, or table flavor.");
  const grade = abilityGrade(abilities[primary]);
  return (
    <div style={{ ...card, padding: 16, marginTop: 14, borderColor: T.gold }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>{title}</div>
          <div style={{ color: T.dim, fontSize: 12, marginTop: 3 }}>{race ? `${race} · ` : ""}{cls} · {guide.role}</div>
        </div>
        {onApplyArray && <button style={{ ...btn(false), padding: "6px 12px", fontSize: 13, minHeight: 0 }} onClick={onApplyArray}>Apply recommended array</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8, marginTop: 12 }}>
        <div style={{ background: T.panel2, borderRadius: 8, padding: 10 }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Primary</div>
          <div style={{ color: grade.color, fontFamily: "Georgia, serif", fontSize: 21 }}>{ABIL_NAMES[primary]} {abilities[primary]}</div>
          <div style={{ color: T.dim, fontSize: 12 }}>{fmtMod(mod(abilities[primary]))} · {grade.label}</div>
        </div>
        <div style={{ background: T.panel2, borderRadius: 8, padding: 10 }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Attack Math</div>
          <div style={{ color: T.ink, fontFamily: "Georgia, serif", fontSize: 21 }}>{fmtMod(pb + mod(abilities[primary]))}</div>
          <div style={{ color: T.dim, fontSize: 12 }}>prof +{pb} + {primary.toUpperCase()} mod</div>
        </div>
        {spellStat && (
          <div style={{ background: T.panel2, borderRadius: 8, padding: 10 }}>
            <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Spell DC</div>
            <div style={{ color: T.ink, fontFamily: "Georgia, serif", fontSize: 21 }}>{8 + pb + spellM}</div>
            <div style={{ color: T.dim, fontSize: 12 }}>spell attack {fmtMod(pb + spellM)}</div>
          </div>
        )}
        <div style={{ background: T.panel2, borderRadius: 8, padding: 10 }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>AC Lens</div>
          <div style={{ color: T.ink, fontFamily: "Georgia, serif", fontSize: 21 }}>{ac.val}</div>
          <div style={{ color: T.dim, fontSize: 12 }}>{ac.label}</div>
        </div>
      </div>
      <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.65, marginTop: 10 }}>{guide.note}</div>
      <div style={{ display: "grid", gap: 5, marginTop: 10 }}>
        {nudges.slice(0, 3).map((n, i) => <div key={i} style={{ color: i === 0 && n.includes("Raise") ? T.gold : T.dim, fontSize: 13 }}>• {n}</div>)}
      </div>
    </div>
  );
}

function LevelRoadmap({ ch, customs }) {
  const lvl = totalLevel(ch);
  const [focus, setFocus] = useState(dominantClass(ch).name);
  const [target, setTarget] = useState(Math.min(20, lvl + 5));
  useEffect(() => { if (target <= lvl && lvl < 20) setTarget(Math.min(20, lvl + 1)); }, [lvl, target]);
  if (lvl >= 20) return null;

  const currentOk = ch.classes.every((c) => meetsPrereq(c.name, ch.abilities));
  const canTake = (name) => ch.classes.some((c) => c.name === name) || (currentOk && meetsPrereq(name, ch.abilities));
  const explainLock = (name) => {
    if (ch.classes.some((c) => c.name === name)) return "";
    if (!currentOk) return "current multiclass prerequisites unmet";
    return "requires " + MC_PREREQ[name].map((r) => Object.entries(r).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" & ")).join(" or ");
  };
  const focusOk = canTake(focus);
  const clampedTarget = Math.max(lvl + 1, target);
  let classes = ch.classes.map((c) => ({ ...c }));
  let prevSlots = slotSig(spellSlots(classes));
  let prevPact = pactSig(classes);
  const rows = [];
  if (focusOk) {
    for (let characterLevel = lvl + 1; characterLevel <= clampedTarget; characterLevel++) {
      let entry = classes.find((c) => c.name === focus);
      if (entry) entry.level += 1;
      else { entry = { name: focus, level: 1, subclass: null }; classes = [...classes, entry]; }
      const data = CLASSES[focus];
      const classLevel = entry.level;
      let bits = [];
      if (profBonus(characterLevel) !== profBonus(characterLevel - 1)) bits.push(`Proficiency +${profBonus(characterLevel)}`);
      bits = bits.concat(data.feats[classLevel] || []);
      if (data.asi.includes(classLevel)) bits.push(ASI);
      if (classLevel === data.subLvl && !entry.subclass) bits.push(`Choose ${data.subName}`);
      if (entry.subclass) bits = bits.concat(allSubFeats(entry.subclass, classLevel, customs));
      if (focus === "Rogue" && classLevel > 1 && classLevel % 2 === 1) bits.push(`Sneak Attack ${Math.ceil(classLevel / 2)}d6`);
      const nowSlots = slotSig(spellSlots(classes));
      if (nowSlots !== prevSlots) bits.push(`Spell slots ${slotLabel(spellSlots(classes))}`);
      prevSlots = nowSlots;
      const nowPact = pactSig(classes);
      if (nowPact !== prevPact) bits.push(`Pact Magic ${pactLabel(classes)}`);
      prevPact = nowPact;
      if (focus === "Warlock" && INVOCATIONS(classLevel) !== INVOCATIONS(classLevel - 1)) bits.push(`Invocations known ${INVOCATIONS(classLevel)}`);
      rows.push({ characterLevel, classLevel, bits: uniqList(bits).filter(Boolean) });
    }
  }

  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Level Roadmap</div>
          <div style={{ color: T.dim, fontSize: 12, marginTop: 3 }}>Preview the next seals before committing the level-up ritual.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 10 }}>
            {Object.keys(CLASSES).map((name) => <option key={name} value={name} disabled={!canTake(name)}>{name}{canTake(name) ? "" : " ⚿"}</option>)}
          </select>
          <label style={{ color: T.dim, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            target {clampedTarget}
            <input type="range" min={lvl + 1} max={20} value={clampedTarget} onChange={(e) => setTarget(+e.target.value)} />
          </label>
        </div>
      </div>
      {!focusOk ? (
        <div style={{ color: T.blood, fontSize: 13, marginTop: 12 }}>{focus} is locked: {explainLock(focus)}.</div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.characterLevel} style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: 10, alignItems: "start", background: T.panel2, borderRadius: 8, padding: 10 }}>
              <div>
                <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 18 }}>Lv {r.characterLevel}</div>
                <div style={{ color: T.dim, fontSize: 11 }}>{focus} {r.classLevel}</div>
              </div>
              <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.55 }}>{r.bits.length ? r.bits.join(" · ") : "HP, hit die, and the quiet accumulation of menace."}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


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
            🎲 Roll {rolled.length < 6 ? `score ${rolled.length + 1} of 6` : "complete"}
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
        <DiceTray title={`Rolling 4d6 — drop lowest`} dice={rolling.dice} dropLowest
          note="The bones tumble; the weakest is discarded."
          onReroll={startRoll}
          onAccept={(total) => { setRolled([...rolled, total]); setRolling(null); }} />
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

  const steps = ["Identity", "Race", "Origins", "Class", "Abilities", "Spells", "Confirm"];
  const langNeed = (RACE_LANGS[race].choose || 0) + 2; // race choice + Acolyte's two
  const wizCantrips = (customs?.spells || []).filter((x) => x.level === 0 && spellFitsClass(x, "Wizard"));
  const castsAt1 = !!CLASSES[cls].caster && CLASSES[cls].caster !== "half";
  const canCap1 = CANTRIPS_KNOWN[cls] ? CANTRIPS_KNOWN[cls](1) : 0;
  const spellCap1 = castsAt1 ? spellCapacity(cls, 1, finalScores).n : 0;
  const pool1 = (customs?.spells || []).filter((x) => spellFitsClass(x, cls));
  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? (race !== "Half-Elf" || halfElfPicks.length === 2) :
    step === 2 ? langPicks.length === langNeed && (bg !== "Custom" || bgSkills.length === 2) && (race !== "Dragonborn" || ancestry) && (race !== "Half-Elf" || heSkills.length === 2) && (race !== "High Elf" || heCantrip.trim()) :
    step === 3 ? skills.length === clsData.nSkills && (clsData.subLvl > 1 || subclass) && (cls !== "Fighter" || style) && (cls !== "Rogue" || rogueExp.length === 2) && (cls !== "Ranger" || (favEnemy && natTerrain)) :
    true;

  const finish = () => {
    onDone({
      id: uid(), name: name.trim(), photo, race, background: bg, alignment, gold: gold ?? 0,
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
      log: [`Created as ${race} ${cls} 1${style ? ` · ${style}` : ""} · ${bg} · ${alignment}`],
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
                <button key={l} style={{ ...btn(langPicks.includes(l)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
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
              <div key={c} onClick={() => { setCls(c); setSkills([]); setSubclass(null); setStyle(null); setRogueExp([]); setFavEnemy(null); setNatTerrain(null); setSpellPicks({ cantrips: [], spells: [] }); }}
                style={{ ...card, padding: 12, cursor: "pointer", borderColor: cls === c ? T.gold : T.edge, background: cls === c ? T.panel2 : T.panel }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: cls === c ? T.gold : T.ink }}>{c}</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>d{d.die} · saves {d.saves.map((s) => s.toUpperCase()).join("/")}{d.caster ? ` · ${d.caster} caster` : ""}</div>
              </div>
            ))}
          </div>
          {cls === "Fighter" && (
            <div style={{ ...card, padding: 14, marginBottom: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Fighting Style (level 1)</div>
              <div style={{ display: "grid", gap: 6 }}>
                {FIGHTING_STYLES.Fighter.map((f) => (
                  <div key={f} onClick={() => setStyle(f)} style={{ ...card, background: style === f ? T.panel : T.panel2, borderColor: style === f ? T.gold : T.edge, padding: "8px 12px", cursor: "pointer" }}>
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
              {allSubs(cls, customs).map((s) => (
                <button key={s} style={{ ...btn(subclass === s), padding: "6px 14px" }} onClick={() => setSubclass(s)}>{s}</button>
              ))}
            </div>
          )}
          <div style={{ ...card, padding: 14 }}>
            <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Choose {clsData.nSkills} skills ({skills.length}/{clsData.nSkills})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {clsData.skills.map((s) => (
                <button key={s} style={{ ...btn(skills.includes(s)), padding: "5px 10px", fontSize: 13 }}
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
        <>
          <AbilityStep scores={scores} setScores={setScores} method={method} setMethod={setMethod} />
          <BuildAdvisor
            title="Array Advisor" race={race} cls={cls} level={1} abilities={finalScores} skills={[...skills, ...heSkills, ...(bg === "Acolyte" ? ["Insight", "Religion"] : bgSkills)]}
            styles={style ? [style] : []} subclass={subclass}
            onApplyArray={() => { setScores(recommendedBaseScores(cls, style ? [style] : [])); setMethod("Standard Array"); }}
          />
        </>
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
                      <button key={x.name} style={{ ...btn(spellPicks.cantrips.includes(x.name)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
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
                      <button key={x.name} style={{ ...btn(spellPicks.spells.includes(x.name)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
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
            {gold === null ? (
              <button style={btn(false)} onClick={() => {
                const [n] = START_GOLD[cls];
                setGoldRoll({ dice: Array.from({ length: n }, () => ({ sides: 4, value: roll(4) })) });
              }}>🎲 Roll starting gold ({START_GOLD[cls][0]}d4{START_GOLD[cls][1] > 1 ? " × 10" : ""} gp)</button>
            ) : (
              <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 18 }}>Starting gold: {gold} gp</div>
            )}
          </div>
          {goldRoll && (
            <DiceTray title={`Starting wealth — ${START_GOLD[cls][0]}d4${START_GOLD[cls][1] > 1 ? " × 10" : ""}`} dice={goldRoll.dice}
              note="Your inheritance, such as it is." acceptLabel="Pocket it"
              onAccept={(total) => { setGold(total * START_GOLD[cls][1]); setGoldRoll(null); }} />
          )}
          <div style={{ marginTop: 14, color: T.ink }}>HP <b style={{ color: T.gold }}>{hp}</b> (max d{clsData.die} + CON{race === "Hill Dwarf" ? " + Dwarven Toughness" : ""}) · Speed {raceData.speed} ft · Prof +2</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button style={btn(false)} onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</button>
        <button style={{ ...btn(true), opacity: canNext ? 1 : 0.4 }} disabled={!canNext}
          onClick={() => (step === 6 ? finish() : setStep(step + 1))}>{step === 6 ? "Forge Character" : "Next"}</button>
      </div>
    </div>
  );
}

/* ============ LEVEL UP (with full multiclassing) ============ */
function LevelUp({ ch, onDone, onCancel, customs }) {
  const lvl = totalLevel(ch);
  const [stage, setStage] = useState("class"); // class -> hp -> extras -> done
  const [pick, setPick] = useState(null);
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

  if (lvl >= 20) return (
    <div style={{ ...card, padding: 24, textAlign: "center" }}>
      <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 20 }}>Level 20 — the summit is reached.</div>
      <button style={{ ...btn(false), marginTop: 12 }} onClick={onCancel}>Close</button>
    </div>
  );

  const existing = ch.classes.map((c) => c.name);
  const currentOk = ch.classes.every((c) => meetsPrereq(c.name, ch.abilities));

  const options = Object.keys(CLASSES).map((name) => {
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
    const skills = mcSkill ? [...ch.skills, mcSkill] : ch.skills;
    onDone({
      ...ch, classes, abilities, skills,
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
  const extrasNeeded = gainsASI || gainsSub || gainsMcSkill || gainsStyle || gainsExpertise || gainsMeta || gainsBoon;
  const extrasDone =
    (!gainsASI || (asiMode === "feat" && featPick && (!(allFeats(customs).find((f) => f.name === featPick)?.bump?.length) || featBump)) || (asiMode === "asi" && asiPicks.length === 2)) &&
    (!gainsSub || newSub) && (!gainsMcSkill || mcSkill) && (!gainsStyle || stylePick) && (!gainsTerrain || terrPick) &&
    (!gainsExpertise || expPicks.length === 2) && (!gainsMeta || metaPicks.length === metaNeed) && (!gainsBoon || boonPick);

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
                      {o.name} {e ? `${e.level} → ${e.level + 1}` : <span style={{ color: T.blood, fontSize: 12 }}>new</span>}
                    </div>
                    {!o.ok && <div style={{ color: T.blood, fontSize: 11, marginTop: 4 }}>{o.why}</div>}
                    {o.ok && o.isNew && <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>Grants: {MC_PROFS[o.name]}</div>}
                  </div>
                );
              })}
            </div>
            {pick && feats.length > 0 && (
              <div style={{ marginTop: 12, color: T.dim, fontSize: 13 }}>
                At {pick} {newClsLevel}: <span style={{ color: T.ink }}>{feats.join(", ")}</span>
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
              <button style={btn(true)} onClick={() => setRollingHp(true)}>🎲 Roll the d{pickData.die}</button>
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
            {gainsSub && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>{pickData.subName}</div>
                {allSubs(pick, customs).map((s) => <button key={s} style={{ ...btn(newSub === s), padding: "6px 14px" }} onClick={() => setNewSub(s)}>{s}</button>)}
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
                      <div key={f.name} onClick={() => { setFeatPick(f.name); setFeatBump(null); }}
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
            {gainsExpertise && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Expertise — double proficiency on two skills ({expPicks.length}/2)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {expPool.map((sk) => (
                    <button key={sk} style={{ ...btn(expPicks.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
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
                    <button key={m} style={{ ...btn(metaPicks.includes(m)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setMetaPicks(metaPicks.includes(m) ? metaPicks.filter((x) => x !== m) : metaPicks.length < metaNeed ? [...metaPicks, m] : metaPicks)}>{m}</button>
                  ))}
                </div>
              </div>
            )}
            {gainsBoon && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Pact Boon</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PACT_BOONS.map((b) => <button key={b} style={{ ...btn(boonPick === b), padding: "6px 14px" }} onClick={() => setBoonPick(b)}>{b}</button>)}
                </div>
              </div>
            )}
            {gainsMcSkill && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Multiclass skill ({pick} grants one)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CLASSES[pick].skills.filter((s) => !ch.skills.includes(s)).map((s) => (
                    <button key={s} style={{ ...btn(mcSkill === s), padding: "5px 10px", fontSize: 13 }} onClick={() => setMcSkill(s)}>{s}</button>
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
          <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
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
                <div key={n} onClick={() => { if (!ok) return; onInvocations([...mine, n]); setOpen(false); }}
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

function SpellManager({ ch, customs, onSpells }) {
  const casters = ch.classes.filter((c) => CLASSES[c.name].caster);
  const [adding, setAdding] = useState(null); // { cls, kind: 'cantrips'|'spells'|'arcanum', lvl? }
  const [q, setQ] = useState("");
  if (!casters.length) return null;
  const book = ch.spells || {};
  const pool = customs?.spells || [];

  const expandedFor = (clsName) => {
    const e = ch.classes.find((c) => c.name === clsName);
    const data = e && subSpellData(e.subclass);
    if (!data || data.type !== "expanded") return [];
    return Object.entries(data.spells).filter(([lvl]) => +lvl <= e.level)
      .flatMap(([, arr]) => arr).map((n) => pool.find((sp) => sp.name === n) || { name: n, level: SPELL_LVL_HINT[n] || 1, school: "", classes: clsName });
  };
  const listFor = (clsName, kind, arcLvl) => {
    const clsLevel = ch.classes.find((c) => c.name === clsName).level;
    const maxLvl = maxSpellLevel(clsName, clsLevel);
    const extra = kind === "spells" ? expandedFor(clsName).filter((x) => !pool.some((sp) => sp.name === x.name && spellFitsClass(sp, clsName))) : [];
    const taken = kind === "arcanum"
      ? Object.values(book[clsName]?.arcanum || {})
      : (book[clsName]?.[kind]) || [];
    return [...pool, ...extra]
      .filter((sp) => spellFitsClass(sp, clsName) || extra.includes(sp))
      .filter((sp) => (kind === "cantrips" ? sp.level === 0 : kind === "arcanum" ? sp.level === arcLvl : sp.level >= 1 && sp.level <= maxLvl))
      .filter((sp) => !taken.includes(sp.name))
      .filter((sp) => sp.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
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
        const subData = subSpellData(c.subclass);
        const grantedNow = subData?.type === "granted"
          ? Object.entries(subData.spells).filter(([lvl]) => +lvl <= c.level).flatMap(([, arr]) => arr) : [];
        const chip = (name, kind) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13 }}>
            {name}
            <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => setList(c.name, kind, mine[kind].filter((x) => x !== name))}>✕</span>
          </span>
        );
        return (
          <div key={c.name} style={{ marginBottom: 14 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}>{c.name} {c.level} <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>· max spell level {maxLvl || "—"}{c.name === "Warlock" && c.level >= 11 ? " · Mystic Arcanum below" : ""}</span></div>
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
                {subData.label}: <span style={{ color: T.ink }}>{grantedNow.join(", ")}</span>
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

      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setAdding(null)}>
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "75vh", display: "flex", flexDirection: "column", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", marginBottom: 8 }}>
              {adding.kind === "arcanum" ? `Choose ${adding.lvl}th-level Mystic Arcanum` : `Add ${adding.kind === "cantrips" ? "cantrip" : "spell"}`} — {adding.cls}
            </div>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 }} />
            <div style={{ overflowY: "auto" }}>
              {listFor(adding.cls, adding.kind, adding.lvl).slice(0, 60).map((sp) => (
                <div key={sp.name} onClick={() => {
                  if (adding.kind === "arcanum") { setArcanum(adding.cls, adding.lvl, sp.name); setAdding(null); return; }
                  const mine = (ch.spells || {})[adding.cls] || { cantrips: [], spells: [] };
                  setList(adding.cls, adding.kind, [...(mine[adding.kind] || []), sp.name]);
                  setAdding(null);
                }} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.edge}`, cursor: "pointer" }}>
                  <span style={{ color: T.ink }}>{sp.name}</span>
                  <span style={{ color: T.dim, fontSize: 12 }}> · {sp.level === 0 ? "cantrip" : `level ${sp.level}`}{sp.school ? ` · ${sp.school}` : ""}</span>
                </div>
              ))}
              {listFor(adding.cls, adding.kind, adding.lvl).length === 0 && <div style={{ color: T.dim, fontSize: 13, padding: 8 }}>No matching spells in your imported list.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ CHARACTER SHEET ============ */
function Sheet({ ch, onBack, onLevelUp, onDelete, onPhoto, onSpells, onNotes, onInvocations, onUpdate, customs }) {
  const lvl = totalLevel(ch);
  const pb = profBonus(lvl);
  const slots = spellSlots(ch.classes);
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const pact = wl ? PACT(wl.level) : null;
  const photoUpload = usePhotoUpload(onPhoto);
  const [confirmDel, setConfirmDel] = useState(false);

  /* ---- play state: damage taken, expended slots, rests ---- */
  const dmg = Math.max(0, Math.min(ch.dmg || 0, ch.maxHp));
  const curHp = ch.maxHp - dmg;
  const hpRatio = curHp / ch.maxHp;
  const hpColor = hpRatio > 0.5 ? T.green : hpRatio > 0.25 ? T.gold : "#d76a76";
  const [hpAmt, setHpAmt] = useState(1);
  const applyHp = (delta) => onUpdate({ dmg: Math.max(0, Math.min(ch.maxHp, dmg - delta)) });
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
  const shortRest = () => onUpdate({ usedPact: 0 });
  const longRest = () => onUpdate({ dmg: 0, usedSlots: [], usedPact: 0, usedArcanum: [] });
  const pip = (filled, color) => ({ cursor: "pointer", fontSize: 18, fontFamily: "Georgia, serif", color: filled ? color : T.dim, opacity: filled ? 1 : 0.45, userSelect: "none", padding: "0 1px" });

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
          <div style={{ color: T.ink }}>{ch.race} · {ch.classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`).join(" / ")}</div>
          <div style={{ color: T.dim, fontSize: 13 }}>Character level {lvl} · Proficiency +{pb} · {ch.background}{ch.alignment ? ` · ${ch.alignment}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <button style={{ ...btn(true), opacity: lvl >= 20 ? 0.4 : 1 }} disabled={lvl >= 20} onClick={onLevelUp}>⬆ Level Up</button>
          {!confirmDel
            ? <button style={{ ...btn(false), borderColor: T.blood, color: T.blood }} onClick={() => setConfirmDel(true)}>Delete</button>
            : <button style={{ ...btn(false), background: T.blood, color: T.ink, borderColor: T.blood }} onClick={onDelete}>Confirm delete?</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginTop: 14 }}>
        {ABILITIES.map((a) => {
          const saveProf = ch.classes[0] && CLASSES[ch.classes[0].name].saves.includes(a);
          return (
            <div key={a} style={{ ...card, padding: 12, textAlign: "center" }}>
              <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{ABIL_NAMES[a]}</div>
              <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}>{ch.abilities[a]}</div>
              <div style={{ color: T.gold }}>{fmtMod(mod(ch.abilities[a]))}</div>
              <div style={{ color: saveProf ? T.green : T.dim, fontSize: 11, marginTop: 4 }}>save {fmtMod(mod(ch.abilities[a]) + (saveProf ? pb : 0))}{saveProf ? " ●" : ""}</div>
            </div>
          );
        })}
      </div>
      <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>● save proficiencies from first class only, per multiclass rules ({ch.classes[0].name}: {CLASSES[ch.classes[0].name].saves.map(s=>s.toUpperCase()).join(", ")})</div>

      {(() => {
        const lead = dominantClass(ch);
        return <BuildAdvisor race={ch.race} cls={lead.name} level={lvl} abilities={ch.abilities} skills={ch.skills} styles={ch.styles || []} subclass={lead.subclass} />;
      })()}

      <LevelRoadmap ch={ch} customs={customs} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 14 }}>
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Hit Points</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: hpColor }}>{curHp}<span style={{ fontSize: 15, color: T.dim }}> / {ch.maxHp}</span></div>
          <div style={{ height: 4, borderRadius: 2, background: T.panel2, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${hpRatio * 100}%`, background: hpColor, transition: "width 240ms ease" }} />
          </div>
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Initiative</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}>{fmtMod(mod(ch.abilities.dex))}</div>
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Speed</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.ink }}>{RACES[ch.race].speed}</div>
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
        <button style={{ ...btn(false), borderColor: T.blood, color: "#d76a76" }} onClick={() => applyHp(-hpAmt)} disabled={curHp <= 0}>− Damage</button>
        <input type="number" min={1} value={hpAmt}
          onChange={(e) => setHpAmt(Math.max(1, parseInt(e.target.value, 10) || 1))}
          style={{ width: 58, textAlign: "center", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 4px", fontSize: 16 }} />
        <button style={{ ...btn(false), borderColor: T.green, color: T.green }} onClick={() => applyHp(hpAmt)} disabled={dmg === 0}>+ Heal</button>
        <div style={{ flex: 1 }} />
        {pact && <button style={btn(false)} onClick={shortRest} disabled={usedPact === 0} title="Recover pact slots">☾ Short Rest</button>}
        <button style={btn(false)} onClick={longRest} disabled={dmg === 0 && usedSlots.every((n) => !n) && usedPact === 0 && usedArc.length === 0} title="Full HP, all slots recovered">☀ Long Rest</button>
      </div>

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
              <div style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid #b48ead55` }}>
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
              <div style={{ color: "#b48ead", fontSize: 13 }}>Pact Magic is separate from spell slots · recharges on short rest</div>
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

      <SpellManager ch={ch} customs={customs} onSpells={onSpells} />
      <InvocationManager ch={ch} onInvocations={onInvocations} />

      <div style={{ ...card, padding: 16, marginTop: 14 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Class Features</div>
        {ch.classes.map((c) => (
          <div key={c.name} style={{ marginBottom: 10 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}>{c.name} {c.level}{c.subclass ? ` — ${c.subclass}` : ""}</div>
            <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.7 }}>
              {Array.from({ length: c.level }, (_, i) => i + 1)
                .flatMap((l) => (CLASSES[c.name].feats[l] || [])
                  .concat(allSubFeats(c.subclass, l, customs))
                  .concat(CLASSES[c.name].asi.includes(l) ? [ASI] : []))
                .join(" · ") || "—"}
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
              const m = mod(ch.abilities[SKILL_ABIL[sk]]) + (prof ? pb : 0) + (exp ? pb : 0);
              return (
                <div key={sk} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, background: prof ? T.panel2 : "transparent", fontSize: 13 }}>
                  <span style={{ color: prof ? T.ink : T.dim }}>{exp ? "★ " : prof ? "● " : ""}{sk}</span>
                  <span style={{ color: exp ? T.gold : prof ? T.ink : T.dim, fontWeight: prof ? 700 : 400 }}>{fmtMod(m)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>● proficient · ★ expertise (double proficiency)</div>
          {ch.feats?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Feats: {ch.feats.join(", ")}</div>}
          {ch.metamagic?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Metamagic: {ch.metamagic.join(", ")}</div>}
          {ch.rangerChoices && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Favored Enemy: {ch.rangerChoices.favEnemy} · Natural Explorer: {ch.rangerChoices.natTerrain}</div>}
          {ch.styles?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Fighting Styles: {ch.styles.map((f) => `${f} (${STYLE_DESC[f]})`).join(" · ")}</div>}
          <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Proficiencies ({ch.classes[0].name}): {PROF_TEXT[ch.classes[0].name]}{ch.classes.length > 1 ? " — plus multiclass grants (see Chronicle)" : ""}</div>
          {ch.languages?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Languages: {ch.languages.join(", ")}</div>}
          <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Racial traits: {RACES[ch.race].traits.join(" · ")}{ch.racialChoices?.ancestry ? ` · ${ch.racialChoices.ancestry} dragon ancestry (${ANCESTRIES[ch.racialChoices.ancestry]})` : ""}{ch.racialChoices?.cantrip ? ` · Cantrip: ${ch.racialChoices.cantrip}` : ""}</div>
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
    </div>
  );
}



/* ============ COMPENDIUM XML IMPORT ============ */
function parseCompendiumXML(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not valid XML");
  const out = { subs: {}, feats: [], spells: [], skippedClasses: [] };
  const splitColon = (x) => { const m = x.match(/^([^:]+):\s*(.+)$/); return m ? [m[1].trim(), m[2].trim()] : null; };
  const splitParen = (x) => { const m = x.match(/^(.+?)\s*\(([^()]+)\)$/); return m ? [m[1].trim(), m[2].trim()] : null; };

  doc.querySelectorAll("compendium > class").forEach((clsEl) => {
    const clsName = clsEl.querySelector(":scope > name")?.textContent?.trim();
    if (!clsName) return;
    if (!CLASSES[clsName]) { out.skippedClasses.push(clsName); return; }
    const rows = [];
    clsEl.querySelectorAll(":scope > autolevel").forEach((al) => {
      const lvl = +al.getAttribute("level") || 1;
      al.querySelectorAll(":scope > feature > name").forEach((n) => {
        const t = n.textContent.trim();
        if (t) rows.push({ lvl, n: t });
      });
    });
    // Introducers: "A: Y". Members: "Y: F" or "F (Y)".
    const colonPairs = rows.map((r) => ({ ...r, m: splitColon(r.n) })).filter((r) => r.m);
    const parenPairs = rows.map((r) => ({ ...r, m: splitParen(r.n) })).filter((r) => r.m);
    const memberCount = (y) =>
      colonPairs.filter((r) => r.m[0] === y).length + parenPairs.filter((r) => r.m[1] === y).length;
    let cands = new Set(colonPairs.map((r) => r.m[1]).filter((y) => memberCount(y) > 0));
    // Drop nested groups: every introducer of Y has a prefix that is itself a candidate
    cands = new Set([...cands].filter((y) => colonPairs.some((r) => r.m[1] === y && !cands.has(r.m[0]))));

    const known = new Set(CLASSES[clsName].subs);
    cands.forEach((subName) => {
      if (known.has(subName)) return;
      const grouped = {};
      colonPairs.forEach((r) => { if (r.m[0] === subName) (grouped[r.lvl] = grouped[r.lvl] || []).push(r.m[1]); });
      parenPairs.forEach((r) => { if (r.m[1] === subName) (grouped[r.lvl] = grouped[r.lvl] || []).push(r.m[0]); });
      if (Object.keys(grouped).length) (out.subs[clsName] = out.subs[clsName] || []).push({ name: subName, feats: grouped });
    });
  });

  doc.querySelectorAll("compendium > spell").forEach((sp) => {
    const name = sp.querySelector(":scope > name")?.textContent?.trim();
    if (!name) return;
    const level = +(sp.querySelector(":scope > level")?.textContent || 0);
    const school = sp.querySelector(":scope > school")?.textContent?.trim() || "";
    const classes = sp.querySelector(":scope > classes")?.textContent?.trim() || "";
    out.spells.push({ name, level, school, classes });
  });

  doc.querySelectorAll("compendium > feat").forEach((fe) => {
    const name = fe.querySelector(":scope > name")?.textContent?.trim();
    if (!name) return;
    const full = [...fe.querySelectorAll(":scope > text")].map((t) => t.textContent.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ");
    const prereq = fe.querySelector(":scope > prerequisite")?.textContent?.trim() || "";
    const bm = full.match(/increase your ([^.]{3,60}?) score by 1/i);
    const bump = bm ? ABILITIES.filter((a) => new RegExp(ABIL_NAMES[a], "i").test(bm[1])) : [];
    out.feats.push({ name, desc: full.slice(0, 160), prereq, bump });
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
        const existingFeats = new Set([...FEATS, ...customs.feats].map((f) => f.name));
        res.feats = res.feats.filter((f) => !existingFeats.has(f.name));
        const existingSpells = new Set((customs.spells || []).map((x) => x.name));
        res.spells = res.spells.filter((x) => !existingSpells.has(x.name));
        setParsed(res);
      } catch (err) { setImportErr(err.message || "Could not parse this file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const doImport = () => {
    const subs = { ...customs.subs };
    Object.entries(parsed.subs).forEach(([c, arr]) => { subs[c] = [...(subs[c] || []), ...arr]; });
    onSave({ subs, feats: [...customs.feats, ...parsed.feats], spells: [...(customs.spells || []), ...parsed.spells] });
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
              Feed me a compendium XML file (FightClub5 format) from your own collection. Parsing happens entirely in your browser — subclasses and feats are extracted by feature-name convention and merged into your custom content. Duplicates of anything already present are skipped. Only feature names are stored; your books remain the rules text.
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
                <div style={{ color: T.ink, fontSize: 13, marginTop: 4 }}>{parsed.feats.length} new feats · {parsed.spells.length} new spells</div>
                {parsed.skippedClasses?.length > 0 && <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>Skipped unknown base classes (not yet supported): {parsed.skippedClasses.join(", ")}</div>}
                {Object.keys(parsed.subs).length === 0 && parsed.feats.length === 0 && parsed.spells.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>Nothing new found — everything in this file already exists here, or no recognizable classes/feats were present.</div>}
                {(Object.keys(parsed.subs).length > 0 || parsed.feats.length > 0 || parsed.spells.length > 0) && (
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
                  const next = { subs: { ...customs.subs }, feats: [...customs.feats], spells: [...(customs.spells || [])] };
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
      `}</style>
      <div style={{ textAlign: "center", padding: "26px 14px 6px" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, color: T.gold, letterSpacing: 1 }}>The Adventurer's Ledger</div>
        <div style={{ color: T.dim, fontSize: 13 }}>5e SRD character forge · full multiclass rules · the dice remember</div>
      </div>

      {view === "roster" && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...btn(true), flex: 2, padding: 14, fontSize: 16 }} onClick={() => setView("create")}>＋ Forge a New Character</button>
            <button style={{ ...btn(false), flex: 1, padding: 14 }} onClick={() => setView("forge")}>🔨 Homebrew Forge</button>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
            <button style={{ ...btn(false), fontSize: 13 }} onClick={() => exportLedger(chars, customs)} disabled={chars.length === 0 && customs.feats.length === 0 && customs.spells.length === 0}>⬇ Export ledger</button>
            <label style={{ ...btn(false), fontSize: 13, display: "inline-block" }}>
              ⬆ Import ledger
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
                  <div style={{ color: T.dim, fontSize: 13 }}>{c.race} · {c.classes.map((x) => `${x.name} ${x.level}`).join(" / ")} · Level {totalLevel(c)} · {c.dmg ? `${Math.max(0, c.maxHp - c.dmg)}/` : ""}{c.maxHp} HP</div>
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
    </div>
  );
}
