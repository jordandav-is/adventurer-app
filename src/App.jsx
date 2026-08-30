import React, { useState, useEffect, useRef, useCallback } from "react";
import { SYNC_URL } from "./sync-config.js";

/* ============ SRD 5.1 DATA (CC-BY-4.0) ============ */

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const mod = (s) => Math.floor((s - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);
const profBonus = (lvl) => Math.ceil(lvl / 4) + 1;

const RACES = {
  "Hill Dwarf": { bonus: { con: 2, wis: 1 }, speed: 25, traits: ["Darkvision 60 ft", "Dwarven Resilience (adv. vs poison)", "Dwarven Toughness (+1 HP/level)", "Stonecunning"] },
  "High Elf": { bonus: { dex: 2, int: 1 }, speed: 30, traits: ["Darkvision 60 ft", "Fey Ancestry", "Trance", "Keen Senses (Perception)", "One wizard cantrip"] },
  "Lightfoot Halfling": { bonus: { dex: 2, cha: 1 }, speed: 25, traits: ["Halfling Luck (reroll 1s)", "Brave", "Halfling Nimbleness", "Naturally Stealthy"] },
  "Human": { bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, traits: ["+1 to all ability scores"] },
  "Dragonborn": { bonus: { str: 2, cha: 1 }, speed: 30, traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance (ancestry type)"] },
  "Rock Gnome": { bonus: { int: 2, con: 1 }, speed: 25, traits: ["Darkvision 60 ft", "Gnome Cunning (adv. on Int/Wis/Cha saves vs magic)", "Artificer's Lore", "Tinker"] },
  "Half-Elf": { bonus: { cha: 2 }, choose: 2, chooseNot: ["cha"], skills: 2, speed: 30, traits: ["Darkvision 60 ft", "Fey Ancestry", "Two extra skills", "+1 to two abilities of your choice"] },
  "Half-Orc": { bonus: { str: 2, con: 1 }, speed: 30, traits: ["Darkvision 60 ft", "Relentless Endurance", "Savage Attacks", "Menacing (Intimidation)"] },
  "Tiefling": { bonus: { cha: 2, int: 1 }, speed: 30, traits: ["Darkvision 60 ft", "Hellish Resistance (fire)", "Infernal Legacy (thaumaturgy)"] },
  /* ---- Lineages that trade fixed racial bonuses for a feat at 1st level. Not SRD:
     these are optional rules many tables run, so they are offered alongside the SRD
     folk and marked as such wherever the sheet names their source. ---- */
  "Variant Human": { bonus: {}, choose: 2, chooseAmt: 1, skills: 1, feat: true, speed: 30, optional: true,
    traits: ["+1 to two different ability scores", "One extra skill proficiency", "One feat of your choice at 1st level"] },
  "Custom Lineage": { bonus: {}, choose: 1, chooseAmt: 2, feat: true, lineageTrait: true, speed: 30, optional: true,
    traits: ["+2 to one ability score of your choice", "Darkvision 60 ft or one extra skill", "One feat of your choice at 1st level", "Size Small or Medium (your choice)"] },

  /* ---- Expanded races (Volo's, the Elemental Evil folk, Tortle, Eberron), 2014
     printings. Not SRD, but the compendium already carries that era in full. Beyond
     the shared fields, these can carry: grantSkills (fixed proficiencies),
     skillsFrom (a restricted pool for `skills` picks), grantSpells (innate casting,
     keyed by the character level it arrives), natArmor (base + Dex), natArmorFlat
     (a fixed AC, Dex ignored), and acBonus (always-on AC). ---- */
  "Aasimar (Protector)": { bonus: { cha: 2, wis: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Light"] },
    traits: ["Darkvision 60 ft", "Celestial Resistance (necrotic, radiant)", "Healing Hands", "Light Bearer (light cantrip)", "Radiant Soul (from 3rd level)"] },
  "Aasimar (Scourge)": { bonus: { cha: 2, con: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Light"] },
    traits: ["Darkvision 60 ft", "Celestial Resistance (necrotic, radiant)", "Healing Hands", "Light Bearer (light cantrip)", "Radiant Consumption (from 3rd level)"] },
  "Aasimar (Fallen)": { bonus: { cha: 2, str: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Light"] },
    traits: ["Darkvision 60 ft", "Celestial Resistance (necrotic, radiant)", "Healing Hands", "Light Bearer (light cantrip)", "Necrotic Shroud (from 3rd level)"] },
  "Firbolg": { bonus: { wis: 2, str: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Detect Magic", "Disguise Self"] },
    traits: ["Firbolg Magic (detect magic & disguise self, 1/rest)", "Hidden Step", "Powerful Build", "Speech of Beast and Leaf"] },
  "Goliath": { bonus: { str: 2, con: 1 }, speed: 30, group: "expanded", grantSkills: ["Athletics"],
    traits: ["Natural Athlete (Athletics)", "Stone's Endurance", "Powerful Build", "Mountain Born"] },
  "Kenku": { bonus: { dex: 2, wis: 1 }, speed: 30, group: "expanded", skills: 2, skillsFrom: ["Acrobatics", "Deception", "Stealth", "Sleight of Hand"],
    traits: ["Expert Forgery", "Kenku Training (two skills)", "Mimicry"] },
  "Lizardfolk": { bonus: { con: 2, wis: 1 }, speed: 30, group: "expanded", natArmor: 13, skills: 2, skillsFrom: ["Animal Handling", "Nature", "Perception", "Stealth", "Survival"],
    traits: ["Swim 30 ft", "Bite (1d6 + Str)", "Cunning Artisan", "Hold Breath (15 min)", "Natural Armor (13 + Dex)", "Hungry Jaws"] },
  "Tabaxi": { bonus: { dex: 2, cha: 1 }, speed: 30, group: "expanded", grantSkills: ["Perception", "Stealth"],
    traits: ["Darkvision 60 ft", "Feline Agility", "Cat's Claws (climb 20 ft, 1d4 claws)", "Cat's Talent (Perception & Stealth)"] },
  "Triton": { bonus: { str: 1, con: 1, cha: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Fog Cloud"], 3: ["Gust of Wind"], 5: ["Wall of Water"] },
    traits: ["Swim 30 ft", "Amphibious", "Control Air and Water", "Emissary of the Sea", "Guardians of the Depths (cold resistance)"] },
  "Bugbear": { bonus: { str: 2, dex: 1 }, speed: 30, group: "expanded", grantSkills: ["Stealth"],
    traits: ["Darkvision 60 ft", "Long-Limbed (+5 ft melee reach on your turn)", "Powerful Build", "Sneaky (Stealth)", "Surprise Attack"] },
  "Goblin": { bonus: { dex: 2, con: 1 }, speed: 30, group: "expanded",
    traits: ["Darkvision 60 ft", "Fury of the Small", "Nimble Escape", "Small size"] },
  "Hobgoblin": { bonus: { con: 2, int: 1 }, speed: 30, group: "expanded",
    traits: ["Darkvision 60 ft", "Martial Training (two martial weapons, light armor)", "Saving Face"] },
  "Kobold": { bonus: { dex: 2, str: -2 }, speed: 30, group: "expanded",
    traits: ["Darkvision 60 ft", "Grovel, Cower, and Beg", "Pack Tactics", "Sunlight Sensitivity", "Small size"] },
  "Orc": { bonus: { str: 2, con: 1, int: -2 }, speed: 30, group: "expanded", grantSkills: ["Intimidation"],
    traits: ["Darkvision 60 ft", "Aggressive", "Menacing (Intimidation)", "Powerful Build"] },
  "Yuan-ti Pureblood": { bonus: { cha: 2, int: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Poison Spray", "Animal Friendship"], 3: ["Suggestion"] },
    traits: ["Darkvision 60 ft", "Innate Spellcasting", "Magic Resistance (adv. on saves vs spells)", "Poison Immunity"] },
  "Air Genasi": { bonus: { con: 2, dex: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Levitate"] },
    traits: ["Unending Breath", "Mingle with the Wind (levitate, 1/long rest)"] },
  "Earth Genasi": { bonus: { con: 2, str: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Pass Without Trace"] },
    traits: ["Earth Walk", "Merge with Stone (pass without trace, 1/long rest)"] },
  "Fire Genasi": { bonus: { con: 2, int: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Produce Flame"], 3: ["Burning Hands"] },
    traits: ["Darkvision 60 ft", "Fire Resistance", "Reach to the Blaze"] },
  "Water Genasi": { bonus: { con: 2, wis: 1 }, speed: 30, group: "expanded", grantSpells: { 1: ["Shape Water"], 3: ["Create or Destroy Water"] },
    traits: ["Swim 30 ft", "Acid Resistance", "Amphibious", "Call to the Wave"] },
  "Aarakocra": { bonus: { dex: 2, wis: 1 }, speed: 25, group: "expanded",
    traits: ["Flight 50 ft (no medium or heavy armor)", "Talons (1d4 + Str)"] },
  "Tortle": { bonus: { str: 2, wis: 1 }, speed: 30, group: "expanded", natArmorFlat: 17, grantSkills: ["Survival"],
    traits: ["Claws (1d4 + Str)", "Hold Breath (1 hour)", "Natural Armor (AC 17, Dex ignored; shield allowed)", "Shell Defense", "Survival Instinct (Survival)"] },
  "Changeling": { bonus: { cha: 2 }, choose: 1, chooseNot: ["cha"], speed: 30, group: "expanded", skills: 2, skillsFrom: ["Deception", "Insight", "Intimidation", "Persuasion"],
    traits: ["Shapechanger", "Changeling Instincts (two skills)", "+1 to one other ability of your choice"] },
  "Warforged": { bonus: { con: 2 }, choose: 1, chooseNot: ["con"], speed: 30, group: "expanded", skills: 1, acBonus: 1,
    traits: ["Constructed Resilience (adv. vs poison; no need to eat, drink, breathe, or sleep)", "Sentry's Rest", "Integrated Protection (+1 AC)", "Specialized Design (one skill)", "+1 to one other ability of your choice"] },
};

const LANGS = ["Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orc","Abyssal","Aquan","Auran","Celestial","Deep Speech","Draconic","Infernal","Primordial","Sylvan","Undercommon"];
const RACE_LANGS = {
  "Hill Dwarf": { fixed: ["Common", "Dwarvish"], choose: 0 }, "High Elf": { fixed: ["Common", "Elvish"], choose: 1 },
  "Lightfoot Halfling": { fixed: ["Common", "Halfling"], choose: 0 }, "Human": { fixed: ["Common"], choose: 1 },
  "Dragonborn": { fixed: ["Common", "Draconic"], choose: 0 }, "Rock Gnome": { fixed: ["Common", "Gnomish"], choose: 0 },
  "Half-Elf": { fixed: ["Common", "Elvish"], choose: 1 }, "Half-Orc": { fixed: ["Common", "Orc"], choose: 0 },
  "Tiefling": { fixed: ["Common", "Infernal"], choose: 0 },
  "Variant Human": { fixed: ["Common"], choose: 1 }, "Custom Lineage": { fixed: ["Common"], choose: 1 },
  "Aasimar (Protector)": { fixed: ["Common", "Celestial"], choose: 0 }, "Aasimar (Scourge)": { fixed: ["Common", "Celestial"], choose: 0 },
  "Aasimar (Fallen)": { fixed: ["Common", "Celestial"], choose: 0 },
  "Firbolg": { fixed: ["Common", "Elvish", "Giant"], choose: 0 }, "Goliath": { fixed: ["Common", "Giant"], choose: 0 },
  "Kenku": { fixed: ["Common", "Auran"], choose: 0 }, "Lizardfolk": { fixed: ["Common", "Draconic"], choose: 0 },
  "Tabaxi": { fixed: ["Common"], choose: 1 }, "Triton": { fixed: ["Common", "Primordial"], choose: 0 },
  "Bugbear": { fixed: ["Common", "Goblin"], choose: 0 }, "Goblin": { fixed: ["Common", "Goblin"], choose: 0 },
  "Hobgoblin": { fixed: ["Common", "Goblin"], choose: 0 }, "Kobold": { fixed: ["Common", "Draconic"], choose: 0 },
  "Orc": { fixed: ["Common", "Orc"], choose: 0 }, "Yuan-ti Pureblood": { fixed: ["Common", "Abyssal", "Draconic"], choose: 0 },
  "Air Genasi": { fixed: ["Common", "Primordial"], choose: 0 }, "Earth Genasi": { fixed: ["Common", "Primordial"], choose: 0 },
  "Fire Genasi": { fixed: ["Common", "Primordial"], choose: 0 }, "Water Genasi": { fixed: ["Common", "Primordial"], choose: 0 },
  "Aarakocra": { fixed: ["Common", "Auran"], choose: 0 }, "Tortle": { fixed: ["Common", "Aquan"], choose: 0 },
  "Changeling": { fixed: ["Common"], choose: 2 }, "Warforged": { fixed: ["Common"], choose: 1 },
};
const ANCESTRIES = { Black: "Acid", Blue: "Lightning", Brass: "Fire", Bronze: "Lightning", Copper: "Acid", Gold: "Fire", Green: "Poison", Red: "Fire", Silver: "Cold", White: "Cold" };
const ALL_SKILLS = ["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"];

/* ---- Backgrounds: two granted skills, bonus languages, tool proficiencies (kept as a
   reminder — the sheet doesn't track tools), a signature feature, and the purse that
   comes with the standard starting kit ---- */
const BACKGROUNDS = {
  Acolyte: { skills: ["Insight", "Religion"], langs: 2, tools: null, gold: 15,
    flavor: "A life given over to the service of a temple, its rites, and its god.",
    feature: "Shelter of the Faithful",
    featureText: "You and your companions can expect free healing and care at temples and shrines of your faith, and you may call on its priests for aid. You also keep ties to a home temple where you could reside in exchange for offerings and service." },
  Charlatan: { skills: ["Deception", "Sleight of Hand"], langs: 0, tools: "disguise kit, forgery kit", gold: 15,
    flavor: "You have always had a way with people — and with their money.",
    feature: "False Identity",
    featureText: "You maintain a second identity — documents, established acquaintances, disguises — that you can slip into at need. You can also forge documents, including official papers and personal letters, as long as you have seen an example." },
  Criminal: { skills: ["Deception", "Stealth"], langs: 0, tools: "one gaming set, thieves' tools", gold: 15,
    flavor: "A past of breaking the law — and contacts still in the business.",
    feature: "Criminal Contact",
    featureText: "You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals. You know how to get messages to and from your contact, even over great distances." },
  Entertainer: { skills: ["Acrobatics", "Performance"], langs: 0, tools: "disguise kit, one musical instrument", gold: 15,
    flavor: "You thrive in front of an audience — music, dance, drama, spectacle.",
    feature: "By Popular Demand",
    featureText: "You can always find a place to perform. There you receive free lodging and food of a modest or comfortable standard, and your performances make you something of a local figure." },
  "Folk Hero": { skills: ["Animal Handling", "Survival"], langs: 0, tools: "one type of artisan's tools, vehicles (land)", gold: 10,
    flavor: "You come from humble stock, and your people count you their champion.",
    feature: "Rustic Hospitality",
    featureText: "Common folk will happily shelter you: they will hide you, let you rest, or assist your escape from the law — though they will not risk their lives for you." },
  "Guild Artisan": { skills: ["Insight", "Persuasion"], langs: 1, tools: "one type of artisan's tools", gold: 15,
    flavor: "A skilled maker, and a member of a guild that protects its own.",
    feature: "Guild Membership",
    featureText: "Your guild offers lodging and food when necessary, will pay for your funeral, and wields political influence on your behalf — including access to powerful figures, if you are a member in good standing. Dues are 5 gp a month." },
  Hermit: { skills: ["Medicine", "Religion"], langs: 1, tools: "herbalism kit", gold: 5,
    flavor: "Years of seclusion, spent in search of quiet, solitude, or answers.",
    feature: "Discovery",
    featureText: "Your seclusion granted you a unique and powerful discovery — a great truth, a hidden site, a long-forgotten fact. Work out its exact nature with your DM." },
  Noble: { skills: ["History", "Persuasion"], langs: 1, tools: "one gaming set", gold: 25,
    flavor: "Wealth, power, and privilege — your family name opens doors.",
    feature: "Position of Privilege",
    featureText: "People are inclined to think the best of you. You are welcome in high society, common folk make every effort to accommodate you, and you can secure an audience with local nobility if needed." },
  Outlander: { skills: ["Athletics", "Survival"], langs: 1, tools: "one musical instrument", gold: 10,
    flavor: "You grew up in the wilds, far from cities and their comforts.",
    feature: "Wanderer",
    featureText: "You have an excellent memory for maps and geography and can always recall the general layout of the land around you. You can also find food and fresh water for yourself and up to five other people each day, where the land allows." },
  Sage: { skills: ["Arcana", "History"], langs: 2, tools: null, gold: 10,
    flavor: "Years among books and scrolls, chasing the lore of the multiverse.",
    feature: "Researcher",
    featureText: "When you attempt to learn or recall a piece of lore and fail, you often know where and from whom you could obtain it — a library, scriptorium, university, sage, or other learned creature." },
  Sailor: { skills: ["Athletics", "Perception"], langs: 0, tools: "navigator's tools, vehicles (water)", gold: 10,
    flavor: "Years crewing ships: storms weathered, ports brawled in.",
    feature: "Ship's Passage",
    featureText: "You can secure free passage on a sailing ship for yourself and your companions. In return the crew expects a hand with the work, and the route is up to the captain." },
  Soldier: { skills: ["Athletics", "Intimidation"], langs: 0, tools: "one gaming set, vehicles (land)", gold: 10,
    flavor: "Trained, drilled, and blooded in an army, militia, or mercenary company.",
    feature: "Military Rank",
    featureText: "Soldiers loyal to your former organization still recognize your rank. You can invoke it to influence them, requisition simple equipment or horses, and gain entrance to friendly military encampments and fortresses." },
  Urchin: { skills: ["Sleight of Hand", "Stealth"], langs: 0, tools: "disguise kit, thieves' tools", gold: 10,
    flavor: "Raised poor and alone on city streets, surviving on wit and speed.",
    feature: "City Secrets",
    featureText: "You know the secret patterns and flow of cities. When not in combat, you and companions you lead can travel between any two locations in a city twice as fast as your speed would otherwise allow." },
};

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
  "Fey Wanderer": { type: "granted", label: "Fey Wanderer spells (always prepared)", spells: { 3: ["Charm Person"], 5: ["Misty Step"], 9: ["Summon Fey"], 13: ["Dimension Door"], 17: ["Mislead"] } },
  "Gloom Stalker": { type: "granted", label: "Gloom Stalker spells (always prepared)", spells: { 3: ["Disguise Self"], 5: ["Rope Trick"], 9: ["Fear"], 13: ["Greater Invisibility"], 17: ["Seeming"] } },
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
  Ranger: [{ wis: 13 }], Rogue: [{ dex: 13 }], Sorcerer: [{ cha: 13 }], Warlock: [{ cha: 13 }], Wizard: [{ int: 13 }],
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
  /* Ranger runs on the 2024 PHB (SRD 5.2): a prepared caster from 1st level whose
     Favored Enemy is Hunter's Mark. The other classes keep their 2014 tables. */
  Ranger: { die: 10, saves: ["str", "dex"], caster: "half1", subLvl: 3, subName: "Ranger Subclass", subs: ["Hunter", "Beast Master", "Fey Wanderer", "Gloom Stalker"],
    skills: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"], nSkills: 3,
    asi: [4, 8, 12, 16, 19],
    feats: { 1: ["Spellcasting", "Favored Enemy", "Weapon Mastery"], 2: ["Deft Explorer", "Fighting Style"], 3: ["Ranger Archetype"], 5: ["Extra Attack"], 6: ["Roving"], 7: ["Archetype feature"], 9: ["Expertise"], 10: ["Tireless"], 11: ["Archetype feature"], 13: ["Relentless Hunter"], 14: ["Nature's Veil"], 15: ["Archetype feature"], 17: ["Precise Hunter"], 18: ["Feral Senses"], 19: ["Epic Boon"], 20: ["Foe Slayer"] } },
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
  "Hunter": { 3: ["Hunter's Lore", "Hunter's Prey"], 7: ["Defensive Tactics"], 11: ["Superior Hunter's Prey"], 15: ["Superior Hunter's Defense"] },
  "Beast Master": { 3: ["Primal Companion"], 7: ["Exceptional Training"], 11: ["Bestial Fury"], 15: ["Share Spells"] },
  "Fey Wanderer": { 3: ["Dreadful Strikes", "Otherworldly Glamour"], 7: ["Beguiling Twist"], 11: ["Fey Reinforcements"], 15: ["Misty Wanderer"] },
  "Gloom Stalker": { 3: ["Dread Ambusher", "Umbral Sight"], 7: ["Iron Mind"], 11: ["Stalker's Flurry"], 15: ["Shadowy Dodge"] },
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
  /* racial traits that would otherwise collide with a feat of the same name */
  "Halfling Luck": "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll. (This is the halfling trait, not the Lucky feat — the sheet applies it to every d20 automatically.)",
  "Darkvision 60 ft": "Within 60 feet you can see in dim light as if it were bright light, and in darkness as if it were dim light — discerning shapes and movement, though only in shades of grey.",
  /* expanded-race traits (2014 printings) */
  "Celestial Resistance": "You have resistance to necrotic damage and radiant damage.",
  "Healing Hands": "As an action, touch a creature to restore hit points equal to your level. Once per long rest.",
  "Light Bearer": "You know the light cantrip. Charisma is your spellcasting ability for it.",
  "Radiant Soul": "From 3rd level, as an action you can unleash your celestial nature for 1 minute: luminous wings sprout (flying speed 30 ft), and once on each of your turns one attack or spell deals extra radiant damage equal to your level. Once per long rest.",
  "Radiant Consumption": "From 3rd level, as an action you sear with holy light for 1 minute: bright light in 10 ft, each creature within 10 ft (you included) takes half-your-level radiant damage at the end of your turns, and once on each of your turns one attack or spell deals extra radiant damage equal to your level. Once per long rest.",
  "Necrotic Shroud": "From 3rd level, as an action your eyes turn to black pits and skeletal wings sprout for 1 minute: creatures within 10 ft must pass a Charisma save or be frightened until the end of your next turn, and once on each of your turns one attack or spell deals extra necrotic damage equal to your level. Once per long rest.",
  "Firbolg Magic": "You can cast detect magic and disguise self once each per short or long rest, using Wisdom (your disguise can appear up to 3 feet shorter).",
  "Hidden Step": "As a bonus action, turn invisible until the start of your next turn or until you attack, deal damage, or force a saving throw. Once per short or long rest.",
  "Powerful Build": "You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.",
  "Speech of Beast and Leaf": "You can communicate simple ideas to beasts and plants (they can't respond in words), and you have advantage on Charisma checks to influence them.",
  "Natural Athlete": "You have proficiency in the Athletics skill.",
  "Stone's Endurance": "When you take damage, use your reaction to roll a d12 + your Constitution modifier and reduce the damage by that total. Once per short or long rest.",
  "Mountain Born": "You're acclimated to high altitude and cold climates.",
  "Expert Forgery": "You can duplicate other creatures' handwriting and craftwork, with advantage on checks to make forgeries or duplicates.",
  "Kenku Training": "You are proficient in two skills chosen from Acrobatics, Deception, Stealth, and Sleight of Hand.",
  "Mimicry": "You can mimic sounds you have heard, including voices — heard as genuine unless a Wisdom (Insight) check beats your Charisma (Deception).",
  "Cunning Artisan": "In a short rest, harvest a slain creature into a shield, club, javelin, or 1d4 darts or blowgun needles.",
  "Hold Breath": "You can hold your breath far longer than most — 15 minutes for a lizardfolk, an hour for a tortle.",
  "Natural Armor": "Your hide is armor enough: a lizardfolk's unarmored AC is 13 + Dex; a tortle's shell fixes AC at 17 (Dexterity neither helps nor hinders; a shield still stacks).",
  "Hungry Jaws": "As a bonus action, bite with the fury of the swamp: on a hit, gain temporary hit points equal to your Constitution modifier (min 1). Once per short or long rest.",
  "Feline Agility": "When you move on your turn in combat, you can double your speed until the end of the turn. You can't use it again until you spend a turn moving 0 feet.",
  "Cat's Claws": "You have a climbing speed of 20 feet, and your claws are natural weapons dealing 1d4 + Strength slashing damage.",
  "Cat's Talent": "You have proficiency in the Perception and Stealth skills.",
  "Amphibious": "You can breathe air and water.",
  "Control Air and Water": "Innate casting on Charisma: fog cloud at 1st level, gust of wind from 3rd, wall of water from 5th — each once per long rest.",
  "Emissary of the Sea": "Beasts that breathe water can understand your speech (though you can't understand them).",
  "Guardians of the Depths": "Adapted to the deep: you have resistance to cold damage.",
  "Long-Limbed": "On your turn, your reach with melee attacks is 5 feet greater than normal.",
  "Sneaky": "You have proficiency in the Stealth skill.",
  "Surprise Attack": "If you hit a surprised creature with an attack on your first turn of combat, it takes an extra 2d6 damage.",
  "Fury of the Small": "When you damage a creature larger than you, deal extra damage equal to your level. Once per short or long rest.",
  "Nimble Escape": "You can take the Disengage or Hide action as a bonus action on each of your turns.",
  "Small size": "You are Small. You can't wield heavy weapons without disadvantage.",
  "Martial Training": "You are proficient with two martial weapons of your choice and with light armor.",
  "Saving Face": "If you miss an attack or fail a check or save, add +1 for each ally within 30 ft who can see you (max +5). Once per short or long rest.",
  "Grovel, Cower, and Beg": "As an action, distract foes with theatrical panic: each ally within 10 ft has advantage on attacks against creatures within 10 ft of you until the end of your next turn. Once per short or long rest.",
  "Pack Tactics": "You have advantage on attack rolls against a creature if at least one ally is within 5 feet of it and isn't incapacitated.",
  "Sunlight Sensitivity": "In direct sunlight, you have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight.",
  "Aggressive": "As a bonus action, move up to your speed toward a hostile creature you can see.",
  "Menacing": "You have proficiency in the Intimidation skill.",
  "Innate Spellcasting": "Yuan-ti magic on Charisma: poison spray at will, animal friendship at will (snakes only), and suggestion once per long rest from 3rd level.",
  "Magic Resistance": "You have advantage on saving throws against spells and other magical effects.",
  "Poison Immunity": "You are immune to poison damage and the poisoned condition.",
  "Unending Breath": "You can hold your breath indefinitely while not incapacitated.",
  "Mingle with the Wind": "You can cast levitate once per long rest (Constitution, no material components).",
  "Earth Walk": "You can move across difficult terrain of earth or stone without extra movement.",
  "Merge with Stone": "You can cast pass without trace once per long rest (Constitution, no material components).",
  "Fire Resistance": "You have resistance to fire damage.",
  "Reach to the Blaze": "You know the produce flame cantrip; from 3rd level you can cast burning hands once per long rest (Constitution).",
  "Acid Resistance": "You have resistance to acid damage.",
  "Call to the Wave": "You know the shape water cantrip; from 3rd level you can cast create or destroy water (as a 2nd-level spell) once per long rest (Constitution).",
  "Flight 50 ft": "You have a flying speed of 50 feet while not wearing medium or heavy armor.",
  "Talons": "Your talons are natural weapons dealing 1d4 + Strength slashing damage.",
  "Claws": "Your claws are natural weapons dealing 1d4 + Strength slashing damage.",
  "Shell Defense": "As an action, withdraw into your shell: +4 AC, advantage on Strength and Constitution saves — but prone, speed 0, disadvantage on Dexterity saves, and no actions but a bonus action to emerge.",
  "Survival Instinct": "You have proficiency in the Survival skill.",
  "Shapechanger": "As an action, change your appearance and voice to any humanoid of your size you've seen (clothing and equipment unchanged). You revert if you die.",
  "Changeling Instincts": "You are proficient in two skills chosen from Deception, Insight, Intimidation, and Persuasion.",
  "Constructed Resilience": "Advantage on saves against poison and resistance to poison damage; no need to eat, drink, breathe, or sleep, and magic can't put you to sleep.",
  "Sentry's Rest": "In a long rest you remain conscious, spending six hours motionless instead of sleeping.",
  "Integrated Protection": "You gain a +1 bonus to AC. Donning or doffing armor takes you an hour, as it integrates into your body — and it can't be removed against your will.",
  "Specialized Design": "You gain one skill proficiency and one tool proficiency of your choice.",
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
  "Favored Enemy": "You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.\nChoose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead. Alternatively, you can select two races of humanoid (such as gnolls and orcs) as favored enemies.\nYou have advantage on Wisdom (Survival) checks to track your favored enemies, as well as on Intelligence checks to recall information about them. When you gain this feature, you also learn one language of your choice that is spoken by your favored enemies, if they speak one at all.\nYou choose one additional favored enemy, as well as an associated language, at 6th and 14th level.\nYou also always have the Hunter's Mark spell prepared, castable for free a number of times tracked under Feature Uses (2, rising to 3/4/5/6 at ranger levels 5/9/13/17).",
  "Weapon Mastery": "Your training lets you use the mastery properties of two kinds of weapons of your choice with which you have proficiency. Whenever you finish a long rest, you can change the kinds of weapons you chose. (Mastery properties are rules text on each weapon — the sheet doesn't automate them.)",
  "Deft Explorer": "Thanks to your travels, you gain Expertise in one of your skill proficiencies, and you learn two languages of your choice.",
  "Roving": "Your speed increases by 10 feet while you aren't wearing heavy armor, and you gain a climb speed and a swim speed equal to your speed.",
  "Tireless": "As a magic action, give yourself temporary hit points equal to 1d8 + your Wisdom modifier (minimum 1), a number of times equal to your Wisdom modifier (minimum once) per long rest. In addition, whenever you finish a short rest, your exhaustion level, if any, decreases by 1.",
  "Relentless Hunter": "Taking damage can't break your concentration on Hunter's Mark.",
  "Nature's Veil": "As a bonus action, you invoke spirits of nature to become invisible until the start of your next turn. You can use this a number of times equal to your Wisdom modifier (minimum once), regaining all uses on a long rest.",
  "Precise Hunter": "You have advantage on attack rolls against the creature currently marked by your Hunter's Mark.",
  "Epic Boon": "You gain an Epic Boon feat, or another feat of your choice for which you qualify — take it through this level's Ability Score Improvement panel.",
  "Favored Enemy improvement": "Choose an additional favored enemy type (and an associated language).",
  "Natural Explorer": "Choose a favored terrain. There, doubled proficiency on related Intelligence and Wisdom checks, difficult terrain doesn't slow your group, you can't become lost except by magic, you stay alert while doing other activities, you can stealth alone at a normal pace, you find twice as much food foraging, and tracking reveals exact numbers, sizes, and how long ago they passed.",
  "Natural Explorer improvement": "Choose an additional favored terrain.",
  "Favored Enemy & Natural Explorer improvements": "Choose one additional favored enemy (with a language) and one additional favored terrain.",
  "Primeval Awareness": "As an action, expend a spell slot to sense for 1 minute per slot level whether any aberrations, celestials, dragons, elementals, fey, fiends, or undead are present within 1 mile (6 miles in favored terrain) — but not their number or location.",
  "Land's Stride": "Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed or harmed by them. You also have advantage on saving throws against magically created or manipulated plants that impede movement.",
  "Hide in Plain Sight": "Spend 1 minute creating camouflage and press yourself against a solid surface: while you remain there without moving or acting, you gain +10 to Dexterity (Stealth) checks.",
  "Vanish": "You can use the Hide action as a bonus action, and you can't be tracked by nonmagical means unless you choose to leave a trail.",
  "Feral Senses": "Your connection to the wilderness grants you blindsight with a range of 30 feet.",
  "Foe Slayer": "The damage die of your Hunter's Mark is a d10 rather than a d6.",
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
    flavor: "You stalk prey in the wilds and elsewhere, using your abilities as a Hunter to protect nature and people everywhere from forces that would destroy them. (2024)",
    features: {
      3: [
        { n: "Hunter's Lore", t: "You can call on the forces of nature to reveal certain strengths and weaknesses of your prey. While a creature is marked by your Hunter's Mark, you know whether that creature has any immunities, resistances, or vulnerabilities — and if it has any, you know what they are." },
        { n: "Hunter's Prey", t: "Choose one; you can swap it whenever you finish a short or long rest. Colossus Slayer — when you hit a creature with a weapon, it takes an extra 1d8 damage if it's missing any hit points, once per turn. Horde Breaker — once on each of your turns when you attack with a weapon, make another attack with it against a different creature within 5 feet of the original target (in range, not yet attacked by you this turn)." },
      ],
      7: [{ n: "Defensive Tactics", t: "Choose one; swap on any short or long rest. Escape the Horde — opportunity attacks against you have disadvantage. Multiattack Defense — when a creature hits you with an attack roll, it has disadvantage on all its other attack rolls against you this turn." }],
      11: [{ n: "Superior Hunter's Prey", t: "Once per turn when you deal damage to a creature marked by your Hunter's Mark, you can also deal the spell's extra damage to a different creature you can see within 30 feet of the first." }],
      15: [{ n: "Superior Hunter's Defense", t: "When you take damage, you can use your reaction to give yourself resistance to that damage — and to any other damage of the same type — until the end of the current turn." }],
    } },
  "Beast Master": { cls: "Ranger",
    flavor: "A bond with a primal beast — fang, fin, or wing — fighting as one with you. (2024)",
    features: {
      3: [{ n: "Primal Companion", t: "You magically summon a primal beast: choose the Beast of the Land, Beast of the Sea, or Beast of the Sky stat block (muster it from Minions & Summons — its AC, HP, and damage scale with your ranger level and Wisdom). It obeys you, shares your initiative, and acts on your turn; it can move and use its reaction freely, but takes only the Dodge action unless you use a bonus action to command another. If you're incapacitated it acts on its own. If it dies, you can revive it: touch it within the hour and expend a spell slot to restore it after 1 minute, fully healed. On a long rest you may summon a different beast." }],
      7: [{ n: "Exceptional Training", t: "When you take a bonus action to command your beast, you can also command it to Dash, Disengage, Dodge, or Help with its bonus action. In addition, when the beast hits with an attack, it can deal force damage in place of its normal damage type." }],
      11: [{ n: "Bestial Fury", t: "When you command your beast to take the Attack action, it can make two attacks. The first time each turn it hits a creature marked by your Hunter's Mark, it also deals the spell's extra damage." }],
      15: [{ n: "Share Spells", t: "When you cast a spell targeting yourself, you can also affect your beast with the spell if it is within 30 feet of you." }],
    } },
  "Fey Wanderer": { cls: "Ranger",
    flavor: "A fey mystique clings to you — a gift of the Feywild that beguiles courts and scars minds. (2024)",
    features: {
      3: [
        { n: "Dreadful Strikes", t: "When you hit a creature with a weapon, you can deal an extra 1d4 psychic damage to it — once per turn per creature. The extra damage becomes 1d6 at ranger level 11." },
        { n: "Otherworldly Glamour", t: "Add your Wisdom modifier (minimum +1) to every Charisma check you make — the sheet folds it in. You also gain proficiency in Deception, Performance, or Persuasion (chosen when you take this subclass)." },
      ],
      7: [{ n: "Beguiling Twist", t: "You have advantage on saving throws to avoid or end the charmed or frightened condition. And whenever you or a creature you can see within 120 feet succeeds on a save against being charmed or frightened, you can use your reaction to force a different creature you can see within 120 feet to make a Wisdom save against your spell save DC — on a failure it is charmed or frightened (your choice) for 1 minute, repeating the save at the end of each of its turns." }],
      11: [{ n: "Fey Reinforcements", t: "You always have Summon Fey prepared, and can cast it once per long rest without a spell slot. When you begin casting it, you can cast it without concentration — its duration then becomes 1 minute." }],
      15: [{ n: "Misty Wanderer", t: "You can cast Misty Step without a spell slot a number of times equal to your Wisdom modifier (minimum once), regaining all uses on a long rest. Whenever you cast Misty Step, you can bring along one willing creature within 5 feet — it teleports to an unoccupied space within 5 feet of your destination." }],
    } },
  "Gloom Stalker": { cls: "Ranger",
    flavor: "At home in the darkest places, you hunt what lurks where others fear to tread. (2024)",
    features: {
      3: [
        { n: "Dread Ambusher", t: "Ambusher's Leap: at the start of your first turn of each combat, your speed increases by 10 feet until the end of that turn. Dreadful Strike: when you hit a creature with a weapon, deal an extra 2d6 psychic damage — usable a number of times equal to your Wisdom modifier (minimum once), regained on a long rest. Initiative Bonus: add your Wisdom modifier to your initiative rolls (the sheet folds it in)." },
        { n: "Umbral Sight", t: "You gain darkvision to 60 feet — or 60 more, if you already have it. And while entirely in darkness, you are invisible to any creature that relies on darkvision to see you." },
      ],
      7: [{ n: "Iron Mind", t: "You gain proficiency in Wisdom saving throws (the sheet applies it). If you already have that proficiency, take Intelligence or Charisma saves instead." }],
      11: [{ n: "Stalker's Flurry", t: "Once per turn when you miss with an attack roll, you can make another attack roll against the same or a different target." }],
      15: [{ n: "Shadowy Dodge", t: "Whenever a creature makes an attack roll against you, you can use your reaction to impose disadvantage on that roll. Whether it hits or misses, you can then teleport up to 30 feet to an unoccupied space you can see." }],
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
const TEXT_2024 = new Set([
  "Favored Enemy", "Feral Senses", "Foe Slayer", "Hunter's Prey", "Defensive Tactics", "Superior Hunter's Defense",
  "Hunter's Lore", "Superior Hunter's Prey", "Primal Companion", "Exceptional Training", "Bestial Fury", "Share Spells",
  "Dreadful Strikes", "Otherworldly Glamour", "Beguiling Twist", "Fey Reinforcements", "Misty Wanderer",
  "Roving", "Tireless", "Deft Explorer", "Nature's Veil", "Relentless Hunter", "Precise Hunter", "Weapon Mastery",
  "Dread Ambusher", "Umbral Sight", "Iron Mind", "Stalker's Flurry", "Shadowy Dodge",
]);
function featureBody(rawName, cls, customs) {
  const name = String(rawName || "").trim();
  const strip = baseSubName(name);
  const ft = customs?.featureTexts || {};
  if (TEXT_2024.has(strip)) return FEATURE_TEXT[strip] || FEATURE_TEXT[name] || ft[name] || ft[strip];
  return ft[name] || ft[strip]
    || (cls && (FEATURE_TEXT[`${cls}:${name}`] || FEATURE_TEXT[`${cls}:${strip}`]))
    || FEATURE_TEXT[name] || FEATURE_TEXT[strip]
    || CORE_FEATURE_INFO[strip]
    || (/\bfeature\b$/i.test(strip) ? "Granted by your subclass at this level — read its entry for the details." : null);
}

/* ============ FEATS (CC-BY: SRD 5.1 + the full SRD 5.2 feat chapter) ============
   Every entry carries what the sheet can actually act on, not just prose:

     cat      Origin | General | Fighting Style | Epic Boon — how the picker groups them
     desc     one line for the list; text is the full rules entry the lore panel shows
     prereq   the printed prerequisite, always displayed
     min      { str: 13 } — ALL of these ability minimums must be met
     minAny   { str: 13, dex: 13 } — ANY one of them suffices ("Strength or Dexterity 13+")
     lvl      minimum character level; caster — needs the Spellcasting feature
     bump     abilities the feat's own +1 may be spent on (the picker asks, then applies it)
     pick     further choices the feat forces — { skills: { n, from } }
     fx       what the sheet derives from holding it: hpPerLevel, speed, init,
              saveFromBump, mediumDexCap, style. Anything absent here is rules text
              the player applies at the table (see featEffects below). */
const FEATS = [
  /* ---- Origin feats: no prerequisite, and the usual fare for a 1st-level lineage feat ---- */
  { name: "Alert", cat: "Origin", desc: "Add your proficiency bonus to initiative; swap initiative with a willing ally", fx: { init: true },
    text: "Initiative Proficiency. When you roll Initiative, you can add your Proficiency Bonus to the roll.\nInitiative Swap. Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can't make this swap if you or the ally has the Incapacitated condition." },
  { name: "Crafter", cat: "Origin", desc: "Three artisan's tool proficiencies, a 20% discount on gear, and faster crafting",
    text: "Tool Proficiency. You gain proficiency with three different Artisan's Tools of your choice.\nDiscount. Whenever you buy a nonmagical item, you receive a 20 percent discount on it.\nFast Crafting. When you finish a Long Rest, you can craft one piece of gear from the Fast Crafting table, provided you have the tool proficiency the item requires and have the raw materials to hand. The item lasts until you finish another Long Rest, when it falls apart unless you spend the materials again." },
  { name: "Healer", cat: "Origin", desc: "Revive a downed ally, and heal with a Healer's Kit as a Utilize action",
    text: "Battle Medic. If you have a Healer's Kit, you can expend one use of it and tend to a creature within 5 feet as a Utilize action. That creature can spend one Hit Point Die: roll the die, add your Proficiency Bonus, and the creature regains that many Hit Points.\nHealing Rerolls. Whenever you roll a die to determine the number of Hit Points you restore with a spell or with this feat's Battle Medic, you can reroll the die if it rolls a 1, and you must use the new roll." },
  { name: "Lucky", cat: "Origin", desc: "Luck Points equal to your proficiency bonus: buy advantage, or impose disadvantage on an attacker",
    text: "Luck Points. You have a number of Luck Points equal to your Proficiency Bonus and can spend them as described below. You regain all expended Luck Points when you finish a Long Rest.\nAdvantage. When you roll a d20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.\nDisadvantage. When a creature rolls a d20 Test against you, you can spend 1 Luck Point to impose Disadvantage on that roll." },
  { name: "Magic Initiate", cat: "Origin", desc: "Two cantrips and one 1st-level spell from a chosen class list — add them in the Grimoire",
    text: "Choose one class: Cleric, Druid, or Wizard. You learn two cantrips of your choice from that class's spell list, and choose one 1st-level spell from the same list. You always have that spell prepared; you can cast it once without a spell slot, regaining that use on a Long Rest, and can also cast it using any spell slots you have. Your spellcasting ability for these spells is the one used by the chosen class.\nWhenever you gain a new level, you can replace one of these spells with another of the same level from that list.\n(Add the cantrips and the spell to your sheet from the Grimoire — the ledger tracks them like any other known spell.)" },
  { name: "Musician", cat: "Origin", desc: "Three instrument proficiencies; play after a rest to grant allies Heroic Inspiration",
    text: "Instrument Training. You gain proficiency with three Musical Instruments of your choice.\nEncouraging Song. As you finish a Short or Long Rest, you can play a song on a Musical Instrument you have proficiency with and give Heroic Inspiration to allies who hear the song. The number of allies you can affect equals your Proficiency Bonus." },
  { name: "Savage Attacker", cat: "Origin", desc: "Once per turn, roll your melee weapon's damage dice twice and keep either result",
    text: "You've trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll against the target." },
  { name: "Skilled", cat: "Origin", desc: "Proficiency in any three skills or tools", pick: { skills: { n: 3 } },
    text: "You gain proficiency in any combination of three skills or tools of your choice.\n(The sheet asks you for three skills and marks them proficient. If you'd rather take a tool, pick fewer skills here and note the tool on your sheet — the ledger doesn't track tool proficiencies.)" },
  { name: "Tavern Brawler", cat: "Origin", desc: "d4 unarmed strikes with damage rerolls, a push on a hit, and improvised-weapon proficiency", bump: ["str", "con"],
    text: "Ability Score Increase. Increase your Strength or Constitution by 1, to a maximum of 20.\nDamage Rerolls. Whenever you roll a damage die for your Unarmed Strike, you can reroll the die if it rolls a 1, and you must use the new roll.\nImproved Unarmed Strike. Your Unarmed Strike uses a d4 for damage.\nPush. When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can deal damage and also push the target 5 feet, once per turn.\nProficiency. You have proficiency with improvised weapons." },
  { name: "Tough", cat: "Origin", desc: "Your hit point maximum increases by 2 per character level", fx: { hpPerLevel: 2 },
    text: "Your Hit Point maximum increases by an amount equal to twice your character level when you gain this feat. Whenever you gain a level thereafter, your Hit Point maximum increases by an additional 2 Hit Points.\n(The sheet applies the full amount for your current level automatically, and keeps it in step as you level.)" },

  /* ---- General feats: level 4+, and each carries its own +1 ---- */
  { name: "Actor", cat: "General", desc: "Advantage on Deception & Performance when passing as someone else; mimic voices", prereq: "Level 4+, Charisma 13+", lvl: 4, min: { cha: 13 }, bump: ["cha"],
    text: "Ability Score Increase. Increase your Charisma by 1, to a maximum of 20.\nImpersonation. While you're disguised as a real or fictional person, you have Advantage on Charisma (Deception or Performance) checks to convince others that you are that person.\nMimicry. You can mimic the sounds of other creatures, including speech. A creature that hears the mimicry must succeed on a Wisdom (Insight) check against a DC of 8 plus your Charisma modifier and Proficiency Bonus to determine the sounds are faked." },
  { name: "Athlete", cat: "General", desc: "Stand from prone cheaply, climb at full speed, and run long jumps off 5 feet", prereq: "Level 4+, Strength or Dexterity 13+", lvl: 4, minAny: { str: 13, dex: 13 }, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nStand Up. When you have the Prone condition, you can right yourself with only 5 feet of movement.\nClimb Speed. You gain a Climb Speed equal to your Speed.\nLong Jump and High Jump. You can make a running Long or High Jump after moving only 5 feet." },
  { name: "Charger", cat: "General", desc: "Dash then Shove for 10 feet, or add damage to a charging attack", prereq: "Level 4+, Strength or Dexterity 13+", lvl: 4, minAny: { str: 13, dex: 13 }, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nImproved Dash. When you take the Dash action, your Speed increases by 10 feet for that action.\nCharge Attack. If you move at least 10 feet in a straight line immediately before hitting with a melee attack as part of the Attack action, choose one: the target takes extra damage equal to your Proficiency Bonus, or you push the target up to 10 feet away if it is Large or smaller. You can use this once per turn." },
  { name: "Chef", cat: "General", desc: "Cook meals that grant temporary hit points, and treats that speed a short rest", prereq: "Level 4+", lvl: 4, bump: ["con", "wis"],
    text: "Ability Score Increase. Increase your Constitution or Wisdom by 1, to a maximum of 20.\nCook's Utensils. You gain proficiency with Cook's Utensils if you don't already have it.\nReplenishing Meal. As part of a Short Rest, you can cook special food if you have Cook's Utensils and suitable ingredients. Up to five creatures who eat the food and spend Hit Point Dice regain an extra 1d8 Hit Points.\nBolstering Treats. With 1 hour of cooking, you can make a number of treats equal to your Proficiency Bonus. They last 8 hours; a creature can eat one as a Bonus Action to gain Temporary Hit Points equal to your Proficiency Bonus." },
  { name: "Crossbow Expert", cat: "General", desc: "Ignore Loading, no disadvantage in melee, and a bonus-action hand crossbow shot", prereq: "Level 4+, proficiency with a martial weapon", lvl: 4, bump: ["dex"],
    text: "Ability Score Increase. Increase your Dexterity by 1, to a maximum of 20.\nIgnore Loading. The Loading property doesn't reduce the number of attacks you can make with a crossbow you're proficient with.\nFiring in Melee. Being within 5 feet of an enemy doesn't impose Disadvantage on your attack rolls with a crossbow.\nDual Wielding. When you make an extra attack with the Light property, you can add your ability modifier to that attack's damage if the weapon is a hand crossbow." },
  { name: "Crusher", cat: "General", desc: "Shove a creature 5 feet on bludgeoning damage; crits give attackers advantage on it", prereq: "Level 4+", lvl: 4, bump: ["str", "con"],
    text: "Ability Score Increase. Increase your Strength or Constitution by 1, to a maximum of 20.\nPush. Once per turn, when you hit a creature with an attack that deals Bludgeoning damage, you can move it 5 feet to an unoccupied space if it is no more than one size larger than you.\nEnhanced Critical. When you score a Critical Hit that deals Bludgeoning damage, attack rolls against that creature have Advantage until the start of your next turn." },
  { name: "Defensive Duelist", cat: "General", desc: "Reaction with a finesse weapon: add your proficiency bonus to AC against one melee hit", prereq: "Level 4+, Dexterity 13+", lvl: 4, min: { dex: 13 }, bump: ["dex"],
    text: "Ability Score Increase. Increase your Dexterity by 1, to a maximum of 20.\nParry. If you're holding a Finesse weapon you're proficient with and another creature hits you with a melee attack, you can take a Reaction to add your Proficiency Bonus to your Armor Class against that attack, possibly turning the hit into a miss.\n(Toggle the Defensive Duelist effect on your sheet when you parry — the AC bonus is applied for you.)" },
  { name: "Dual Wielder", cat: "General", desc: "Two-weapon fighting with any light-or-not weapons, plus a quick extra draw", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nEnhanced Dual Wielding. When you take the Attack action on your turn and attack with a weapon that has the Light property, you can make one extra attack as a Bonus Action later that turn with a different weapon, which doesn't need the Light property. That attack adds your ability modifier to its damage.\nQuick Draw. You can draw or stow two weapons when you would normally draw or stow only one." },
  { name: "Durable", cat: "General", desc: "Spend Hit Point Dice as a bonus action to heal in the thick of it", prereq: "Level 4+", lvl: 4, bump: ["con"],
    text: "Ability Score Increase. Increase your Constitution by 1, to a maximum of 20.\nHeroic Rally. As a Bonus Action, you can expend one of your Hit Point Dice and roll it, regaining Hit Points equal to the roll plus your Constitution modifier (minimum 1 Hit Point)." },
  { name: "Elemental Adept", cat: "General", desc: "Your spells of one damage type ignore resistance and never roll a 1 for damage", prereq: "Level 4+, Spellcasting or Pact Magic feature", lvl: 4, caster: true, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nEnergy Mastery. Choose one damage type: Acid, Cold, Fire, Lightning, or Thunder. Spells you cast ignore Resistance to that damage type. In addition, when you roll damage for a spell and the roll is a 1, you treat it as a 2.\nYou can take this feat more than once, choosing a different damage type each time." },
  { name: "Fey-Touched", cat: "General", desc: "Misty Step plus one 1st-level Divination or Enchantment spell, free once a day", prereq: "Level 4+", lvl: 4, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nFey Magic. Choose one 1st-level spell from the Divination or Enchantment school. You always have that spell and the Misty Step spell prepared. You can cast each of them once without a spell slot, regaining that use on a Long Rest, and can also cast them using spell slots you have. Your spellcasting ability for them is the ability you increased with this feat.\n(Add both spells from the Grimoire so the sheet tracks them.)" },
  { name: "Grappler", cat: "General", desc: "Advantage on attacks against creatures you grapple, and grapple as part of the Attack action", prereq: "Level 4+, Strength or Dexterity 13+", lvl: 4, minAny: { str: 13, dex: 13 }, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nGrapple Attack. You have Advantage on attack rolls against a creature you have Grappled.\nFast Wrestle. You can use the Unarmed Strike (Grapple) option in place of one of the attacks granted by the Attack action.\nPunch and Grab. When you hit a creature with an Unarmed Strike, you can use both the Damage and the Grapple option, but only once per turn." },
  { name: "Great Weapon Master", cat: "General", desc: "Heavy-weapon crits and kills grant a bonus attack; take −5 to hit for +10 damage", prereq: "Level 4+, proficiency with a martial weapon", lvl: 4, bump: ["str"],
    text: "Ability Score Increase. Increase your Strength by 1, to a maximum of 20.\nHeavy Weapon Mastery. When you hit a creature with a weapon that has the Heavy property as part of the Attack action on your turn, you can cause the weapon to deal extra damage — take a −5 penalty to the attack roll for +10 damage.\nPush Your Luck. Immediately after you score a Critical Hit or reduce a creature to 0 Hit Points with a Heavy weapon, you can make one attack with that weapon as a Bonus Action.\n(Toggle the Great Weapon Master effect on your sheet when you take the −5.)" },
  { name: "Heavily Armored", cat: "General", desc: "Proficiency with heavy armor", prereq: "Level 4+, proficiency with medium armor", lvl: 4, bump: ["str"],
    text: "Ability Score Increase. Increase your Strength by 1, to a maximum of 20.\nArmor Training. You gain training with Heavy armor." },
  { name: "Heavy Armor Master", cat: "General", desc: "In heavy armor, reduce most weapon damage by your proficiency bonus", prereq: "Level 4+, proficiency with heavy armor", lvl: 4, bump: ["str", "con"],
    text: "Ability Score Increase. Increase your Strength or Constitution by 1, to a maximum of 20.\nDamage Reduction. While you're wearing Heavy armor, you have Resistance-like protection: Bludgeoning, Piercing, and Slashing damage you take from weapons is reduced by an amount equal to your Proficiency Bonus." },
  { name: "Inspiring Leader", cat: "General", desc: "A 10-minute speech grants temporary hit points to your whole party", prereq: "Level 4+", lvl: 4, bump: ["wis", "cha"],
    text: "Ability Score Increase. Increase your Wisdom or Charisma by 1, to a maximum of 20.\nBolstering Performance. When you finish a Short or Long Rest, you can give an inspiring speech, performance, or prayer. Choose up to six allies (which can include yourself) within 30 feet who can see or hear you. Each gains Temporary Hit Points equal to your character level plus the ability modifier you increased with this feat. A creature can't gain them again from this feat until it finishes a rest." },
  { name: "Keen Mind", cat: "General", desc: "Study as a bonus action; perfect recall of the last month", prereq: "Level 4+", lvl: 4, bump: ["int"],
    text: "Ability Score Increase. Increase your Intelligence by 1, to a maximum of 20.\nBonus Action Study. You can take the Study action as a Bonus Action.\nRecall. You always know which way is north and the number of hours left before the next sunrise or sunset, and you can accurately recall anything you have seen or heard within the past month." },
  { name: "Lightly Armored", cat: "General", desc: "Proficiency with light armor", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nArmor Training. You gain training with Light armor." },
  { name: "Mage Slayer", cat: "General", desc: "Punish concentration, and turn advantage on your saves against spells", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nConcentration Breaker. When you damage a creature that is concentrating, it has Disadvantage on the saving throw it makes to maintain Concentration.\nGuarded Mind. If you fail a saving throw against a spell, you can end one effect on yourself as a Reaction, at the cost of taking damage equal to your character level." },
  { name: "Martial Weapon Training", cat: "General", desc: "Proficiency with all martial weapons", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nWeapon Proficiency. You gain proficiency with all Martial weapons." },
  { name: "Medium Armor Master", cat: "General", desc: "Medium armor allows a Dex bonus up to +3 and never hampers Stealth", prereq: "Level 4+, proficiency with medium armor", lvl: 4, bump: ["str", "dex"], fx: { mediumDexCap: 3 },
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nDexterous Wearer. While wearing Medium armor, you can add 3, rather than 2, to your Armor Class if you have a Dexterity of 16 or higher, and wearing Medium armor doesn't impose Disadvantage on your Dexterity (Stealth) checks.\n(The sheet raises the Dex cap on your AC automatically.)" },
  { name: "Moderately Armored", cat: "General", desc: "Proficiency with medium armor and shields", prereq: "Level 4+, proficiency with light armor", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nArmor Training. You gain training with Medium armor and Shields." },
  { name: "Mounted Combatant", cat: "General", desc: "Advantage against unmounted foes, and redirect attacks aimed at your mount", prereq: "Level 4+", lvl: 4, bump: ["str", "dex", "wis"],
    text: "Ability Score Increase. Increase your Strength, Dexterity, or Wisdom by 1, to a maximum of 20.\nMounted Strike. While mounted, you have Advantage on attack rolls against any unmounted creature within 5 feet of your mount that is smaller than the mount.\nLeap Aside. If your mount is subjected to an effect that allows it to make a Dexterity saving throw for half damage, it instead takes no damage on a success and half on a failure — provided it isn't Incapacitated.\nVeer. While mounted, you can force an attack that hits your mount to hit you instead." },
  { name: "Observant", cat: "General", desc: "Search as a bonus action; proficiency in Insight, Investigation, or Perception", prereq: "Level 4+", lvl: 4, bump: ["int", "wis"], pick: { skills: { n: 1, from: ["Insight", "Investigation", "Perception"] } },
    text: "Ability Score Increase. Increase your Intelligence or Wisdom by 1, to a maximum of 20.\nSkill Proficiency. You gain proficiency in one of the following skills of your choice: Insight, Investigation, or Perception.\nQuick Search. You can take the Search action as a Bonus Action." },
  { name: "Piercer", cat: "General", desc: "Reroll one piercing damage die per turn; crits add an extra die", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nPuncture. Once per turn, when you hit a creature with an attack that deals Piercing damage, you can reroll one of the attack's damage dice, and you must use the new roll.\nEnhanced Critical. When you score a Critical Hit that deals Piercing damage, you can roll one additional damage die when determining the extra Piercing damage the target takes." },
  { name: "Poisoner", cat: "General", desc: "Coat a weapon in potent poison; ignore poison resistance", prereq: "Level 4+", lvl: 4, bump: ["dex", "int"],
    text: "Ability Score Increase. Increase your Dexterity or Intelligence by 1, to a maximum of 20.\nPoison Proficiency. You gain proficiency with the Poisoner's Kit.\nPotent Poison. When you make a damage roll that deals Poison damage, it ignores Resistance to that damage type.\nApply Poison. As a Bonus Action, you can apply poison from a Poisoner's Kit to a weapon or piece of ammunition. A creature you hit takes an extra 2d8 Poison damage and must succeed on a Constitution saving throw (DC 8 plus your Proficiency Bonus and the ability modifier you increased) or gain the Poisoned condition until the end of your next turn." },
  { name: "Polearm Master", cat: "General", desc: "A bonus-action butt-end strike, and reach weapons that punish approach", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nPole Strike. Immediately after you take the Attack action and attack with a Quarterstaff, a Spear, or a weapon with the Heavy and Reach properties, you can use a Bonus Action to make a melee attack with the opposite end of the weapon, dealing 1d4 Bludgeoning damage plus your ability modifier.\nReactive Strike. While holding such a weapon, you can take an Opportunity Attack when a creature enters the reach you have with it." },
  { name: "Resilient", cat: "General", desc: "+1 to one ability and proficiency in its saving throws", prereq: "Level 4+", lvl: 4, bump: ["str", "dex", "con", "int", "wis", "cha"], fx: { saveFromBump: true },
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 20.\nSaving Throw Proficiency. You gain proficiency in saving throws using the chosen ability.\n(The sheet grants the save proficiency to whichever ability you raise.)" },
  { name: "Ritual Caster", cat: "General", desc: "A ritual book of spells you can cast as rituals, growing as you find more", prereq: "Level 4+, Spellcasting or Pact Magic feature", lvl: 4, caster: true, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nRitual Book. You have a book holding ritual spells. Choose two 1st-level spells that have the Ritual tag from the Cleric, Druid, or Wizard spell list; they are copied into the book. When you find a spell with the Ritual tag of a level you can cast, you can copy it into the book over a period of hours and a cost in materials.\nRitual Casting. You can cast the spells in your book as Rituals — and only as Rituals. Your spellcasting ability for them is the ability you increased with this feat." },
  { name: "Sentinel", cat: "General", desc: "Opportunity attacks that stop movement, and punish foes who ignore you", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nGuardian. Immediately after a creature within 5 feet of you takes the Disengage action, or hits a target other than you with an attack, you can make an Opportunity Attack against it.\nHalt. When you hit a creature with an Opportunity Attack, that creature's Speed becomes 0 for the rest of the turn." },
  { name: "Shadow-Touched", cat: "General", desc: "Invisibility plus one 1st-level Illusion or Necromancy spell, free once a day", prereq: "Level 4+", lvl: 4, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nShadow Magic. Choose one 1st-level spell from the Illusion or Necromancy school. You always have that spell and the Invisibility spell prepared. You can cast each of them once without a spell slot, regaining that use on a Long Rest, and can also cast them using spell slots you have. Your spellcasting ability for them is the ability you increased with this feat.\n(Add both spells from the Grimoire so the sheet tracks them.)" },
  { name: "Sharpshooter", cat: "General", desc: "Ignore cover and long-range penalties; take −5 to hit for +10 damage", prereq: "Level 4+, proficiency with a martial weapon", lvl: 4, bump: ["dex"],
    text: "Ability Score Increase. Increase your Dexterity by 1, to a maximum of 20.\nBypass Cover. Your ranged attacks with weapons ignore Half Cover and Three-Quarters Cover.\nFiring in Melee. Being within 5 feet of an enemy doesn't impose Disadvantage on your ranged attack rolls with weapons.\nLong Shots. Attacking at long range doesn't impose Disadvantage on your ranged attack rolls with weapons, and you can take a −5 penalty to the attack roll for +10 damage.\n(Toggle the Sharpshooter effect on your sheet when you take the −5.)" },
  { name: "Shield Master", cat: "General", desc: "Shove with your shield, interpose it against Dex saves, and dive behind it", prereq: "Level 4+, proficiency with shields", lvl: 4, bump: ["str"],
    text: "Ability Score Increase. Increase your Strength by 1, to a maximum of 20.\nShield Bash. If you take the Attack action on your turn while holding a Shield, you can use a Bonus Action to try to shove one creature within 5 feet with the Shield. The target must succeed on a Strength saving throw (DC 8 plus your Strength modifier and Proficiency Bonus) or take 1d4 Bludgeoning damage and either be pushed 5 feet or gain the Prone condition.\nInterpose Shield. If you're subjected to an effect that allows a Dexterity saving throw for half damage, you can take a Reaction to add your Shield's AC bonus to that save.\nShield Cover. While holding a Shield, you gain Half Cover against attacks and effects originating from the opposite side." },
  { name: "Skulker", cat: "General", desc: "Hide lightly obscured, attack from hiding without giving yourself away", prereq: "Level 4+, Dexterity 13+", lvl: 4, min: { dex: 13 }, bump: ["dex"],
    text: "Ability Score Increase. Increase your Dexterity by 1, to a maximum of 20.\nBlindsense. If you can hear, you have Blindsight with a range of 10 feet.\nSniper. If you make an attack roll while Hidden and the roll misses, making the attack doesn't reveal your position.\nSudden Strike. Once per turn when you make an attack, you can move up to half your Speed immediately before or after the attack without provoking Opportunity Attacks." },
  { name: "Slasher", cat: "General", desc: "Slashing damage slows your target; crits give it disadvantage on attacks", prereq: "Level 4+", lvl: 4, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.\nHamstring. Once per turn when you hit a creature with an attack that deals Slashing damage, you can reduce its Speed by 10 feet until the start of your next turn.\nEnhanced Critical. When you score a Critical Hit that deals Slashing damage, the target has Disadvantage on attack rolls until the start of your next turn." },
  { name: "Speedy", cat: "General", desc: "+10 feet of speed, and Dashing through difficult terrain costs nothing extra", prereq: "Level 4+, Dexterity 13+", lvl: 4, min: { dex: 13 }, bump: ["dex", "con"], fx: { speed: 10 },
    text: "Ability Score Increase. Increase your Dexterity or Constitution by 1, to a maximum of 20.\nDash Over Difficult Terrain. When you take the Dash action on your turn, Difficult Terrain doesn't cost you extra movement for the rest of that turn.\nAgile Movement. Your Speed increases by 10 feet.\nSurprise Withdrawal. When you take the Dash action, you don't provoke an Opportunity Attack from the first creature you move away from.\n(The sheet adds the 10 feet to your Speed automatically.)" },
  { name: "Spell Sniper", cat: "General", desc: "Double the range of your attack spells and ignore cover with them", prereq: "Level 4+, Spellcasting or Pact Magic feature", lvl: 4, caster: true, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nCareful Aim. Once per turn when you make an attack roll for a spell, you can treat a d20 roll of 9 or lower as a 10.\nIncreased Range. When you cast a spell that requires an attack roll, the spell's range increases by 60 feet.\nThrough Cover. Your attack rolls for spells ignore Half Cover and Three-Quarters Cover." },
  { name: "Telekinetic", cat: "General", desc: "Mage Hand at will, and a bonus-action shove by force of mind", prereq: "Level 4+", lvl: 4, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nTelekinetic Shove. As a Bonus Action, you can try to telekinetically shove one creature you can see within 30 feet. The target must succeed on a Strength saving throw (DC 8 plus your Proficiency Bonus and the ability modifier you increased) or be moved 5 feet toward or away from you.\nMage Hand. You always have the Mage Hand spell prepared. You can cast it without Verbal or Somatic components, and you can make the hand Invisible." },
  { name: "Telepathic", cat: "General", desc: "Speak mind to mind at 60 feet, and Detect Thoughts once a day", prereq: "Level 4+", lvl: 4, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nTelepathic Utterance. You can speak telepathically to any creature you can see within 60 feet. Your telepathic utterances are in a language you know, and the creature understands you only if it knows that language. Your communication doesn't give the creature the ability to respond to you telepathically.\nDetect Thoughts. You always have the Detect Thoughts spell prepared. You can cast it once without a spell slot, regaining that use on a Long Rest, and can also cast it using spell slots you have. Your spellcasting ability for it is the ability you increased with this feat." },
  { name: "War Caster", cat: "General", desc: "Advantage on concentration saves, somatic casting with full hands, and spell opportunity attacks", prereq: "Level 4+, Spellcasting or Pact Magic feature", lvl: 4, caster: true, bump: ["int", "wis", "cha"],
    text: "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.\nConcentration. You have Advantage on Constitution saving throws that you make to maintain Concentration.\nReactive Spell. When a creature provokes an Opportunity Attack from you, you can take that Reaction to cast a spell rather than making an Opportunity Attack. The spell must take an action to cast and must target only that creature.\nSomatic Components. You can perform the Somatic components of spells even when you have weapons or a Shield in one or both hands." },

  /* ---- Fighting Style feats: the same styles a Fighter picks, taken as a feat ---- */
  { name: "Fighting Style: Archery", cat: "Fighting Style", desc: "+2 to ranged weapon attack rolls", prereq: "Fighting Style feature", fx: { style: "Archery" },
    text: "You gain a +2 bonus to attack rolls you make with Ranged weapons.\n(The sheet folds this into every ranged attack line.)" },
  { name: "Fighting Style: Blind Fighting", cat: "Fighting Style", desc: "Blindsight 10 ft — you see anything not behind total cover, even while blinded", prereq: "Fighting Style feature",
    text: "You have Blindsight with a range of 10 feet. Within that range, you can effectively see anything that isn't behind Total Cover, even if you have the Blinded condition or are in Darkness. Moreover, in that radius you can see something that has the Invisible condition." },
  { name: "Fighting Style: Defense", cat: "Fighting Style", desc: "+1 AC while wearing armor", prereq: "Fighting Style feature", fx: { style: "Defense" },
    text: "While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.\n(The sheet adds it to your AC whenever armor is equipped.)" },
  { name: "Fighting Style: Dueling", cat: "Fighting Style", desc: "+2 damage with a one-handed melee weapon", prereq: "Fighting Style feature", fx: { style: "Dueling" },
    text: "When you're wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon." },
  { name: "Fighting Style: Great Weapon Fighting", cat: "Fighting Style", desc: "Reroll 1s and 2s on two-handed weapon damage", prereq: "Fighting Style feature", fx: { style: "Great Weapon Fighting" },
    text: "When you roll damage for an attack you make with a melee weapon that you are holding with two hands, you can treat any roll of 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit." },
  { name: "Fighting Style: Interception", cat: "Fighting Style", desc: "Reaction: reduce damage to a nearby ally by 1d10 + your proficiency bonus", prereq: "Fighting Style feature",
    text: "When a creature you can see hits a target, other than you, within 5 feet of you with an attack, you can take a Reaction to reduce the damage the target takes by 1d10 plus your Proficiency Bonus (to a minimum of 0 damage). You must be wielding a Shield or a Simple or Martial weapon to use this Reaction." },
  { name: "Fighting Style: Protection", cat: "Fighting Style", desc: "Reaction with a shield: impose disadvantage on an attack against a nearby ally", prereq: "Fighting Style feature", fx: { style: "Protection" },
    text: "When a creature you can see attacks a target other than you that is within 5 feet of you, you can take a Reaction to interpose your Shield and impose Disadvantage on the attack roll. You must be wielding a Shield." },
  { name: "Fighting Style: Thrown Weapon Fighting", cat: "Fighting Style", desc: "Draw a thrown weapon free of cost and add +2 to its damage", prereq: "Fighting Style feature",
    text: "When you hit with a ranged attack roll using a weapon that has the Thrown property, you gain a +2 bonus to the damage roll. You can also draw such a weapon as part of the attack." },
  { name: "Fighting Style: Two-Weapon Fighting", cat: "Fighting Style", desc: "Add your ability modifier to off-hand damage", prereq: "Fighting Style feature", fx: { style: "Two-Weapon Fighting" },
    text: "When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack." },
  { name: "Fighting Style: Unarmed Fighting", cat: "Fighting Style", desc: "d6 unarmed strikes (d8 with hands free), and damage to those you grapple", prereq: "Fighting Style feature",
    text: "Your Unarmed Strikes deal 1d6 Bludgeoning damage on a hit — 1d8 if you aren't wielding any weapons or a Shield. In addition, at the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature you have Grappled." },

  /* ---- Epic Boons: the rewards of 19th level ---- */
  { name: "Boon of Combat Prowess", cat: "Epic Boon", desc: "Once per turn, turn a miss into an automatic hit", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nPeerless Aim. When you miss with an attack roll against a creature, you can hit instead. Once you use this benefit, you can't use it again until the start of your next turn." },
  { name: "Boon of Dimensional Travel", cat: "Epic Boon", desc: "Teleport 30 feet after taking an action, once per turn", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nBlink Steps. Immediately after you take a Magic action or an Attack action, you can teleport up to 30 feet to an unoccupied space you can see. Once you use this benefit, you can't use it again until the start of your next turn." },
  { name: "Boon of Fate", cat: "Epic Boon", desc: "Add 2d4 to another creature's d20 Test, or subtract it", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nA Hand in Fate. When you or another creature within 60 feet of you succeeds or fails on a d20 Test, you can roll 2d4 and apply the total as a bonus or penalty to that roll. Once you use this benefit, you can't use it again until you roll Initiative or finish a Short or Long Rest." },
  { name: "Boon of Irresistible Offense", cat: "Epic Boon", desc: "Your weapon and unarmed hits pierce all resistance; crits add your ability score", prereq: "Level 19+", lvl: 19, bump: ["str", "dex"],
    text: "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 30.\nOvercome Defenses. The Bludgeoning, Piercing, and Slashing damage you deal always ignores Resistance.\nOverwhelming Strike. When you roll a 20 on the d20 for an attack roll, you can deal extra damage to the target equal to the ability score increased by this feat. The extra damage is the same type dealt by the attack." },
  { name: "Boon of Recovery", cat: "Epic Boon", desc: "Drop to half your hit points instead of 0, and heal on a rest", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nLast Stand. As a Bonus Action, you can regain a number of Hit Points equal to half your Hit Point maximum. Once you use this benefit, you can't use it again until you finish a Long Rest.\nRise Again. When you would be reduced to 0 Hit Points, you can drop to half your Hit Point maximum instead, and you use Last Stand's rest requirement for it." },
  { name: "Boon of Skill", cat: "Epic Boon", desc: "Proficiency in every skill, and expertise in three", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nEnhanced Versatility. You gain proficiency in all skills, and you gain Expertise in three skills of your choice.\n(Mark the skills on your sheet — the ledger doesn't grant them for you.)" },
  { name: "Boon of Speed", cat: "Epic Boon", desc: "+30 feet of speed, and Disengage as a bonus action", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"], fx: { speed: 30 },
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nQuickness. Your Speed increases by 30 feet.\nNimbleness. You can take the Disengage action as a Bonus Action.\n(The sheet adds the 30 feet to your Speed automatically.)" },
  { name: "Boon of the Night Spirit", cat: "Epic Boon", desc: "Become invisible in dim light or darkness, and strike from it", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nMerge with Shadows. While entirely within Dim Light or Darkness, you can give yourself the Invisible condition as a Magic action. It ends immediately after you make an attack roll, deal damage, or cast a spell.\nShadowy Form. While Invisible in this way, you have Resistance to all damage except Psychic and Radiant, and you can move through creatures and objects as if they were Difficult Terrain." },
  { name: "Boon of Truesight", cat: "Epic Boon", desc: "Truesight out to 60 feet", prereq: "Level 19+", lvl: 19, bump: ["str", "dex", "con", "int", "wis", "cha"],
    text: "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.\nTruesight. You have Truesight with a range of 60 feet." },
];
const FEAT_INDEX = new Map(FEATS.map((f) => [f.name, f]));
const FEAT_CATS = ["Origin", "General", "Fighting Style", "Epic Boon", "Imported"];

/* What the sheet actually computes from a feat, keyed by the feat's exact name — so it
   covers the built-in catalogue AND the names an imported compendium uses for the same
   ground (the 2014 books split a feat's ability choice into "Resilient (Constitution)"
   and friends, and carry feats like Mobile that the SRD has under another name). */
const FEAT_MECHANICS = {
  ...Object.fromEntries(FEATS.filter((f) => f.fx).map((f) => [f.name, f.fx])),
  /* ---- names that only an imported compendium brings ---- */
  "Mobile": { speed: 10 },
  "Squat Nimbleness (Dexterity)": { speed: 5 },
  "Squat Nimbleness (Strength)": { speed: 5 },
  // the importer can't read "increase the chosen ability score" out of Resilient's prose,
  // so the variant's own name supplies both the +1 and the save proficiency
  ...Object.fromEntries(ABILITIES.map((a) => [`Resilient (${ABIL_NAMES[a]})`, { save: a, bump: [a] }])),
};

/* A feat's own choices live on the character as featChoices[name] = { bump, skills } */
const featChoiceOf = (ch, name) => (ch?.featChoices || {})[name] || {};

/* Everything the sheet derives from the feats a character holds. Only mechanics the
   ledger can compute honestly live here — the rest is rules text on the feat itself.
   `customs` is optional: pass it and the numbers follow the entry the player actually
   reads, which is how Alert lands on +5 from a 2014 compendium and on the proficiency
   bonus from the SRD 5.2 entry. */
function featEffects(ch, customs) {
  const out = { hpPerLevel: 0, speed: 0, init: null, saves: [], mediumDexCap: 2, styles: [], sources: [] };
  const defs = customs ? new Map(allFeats(customs).map((f) => [f.name, f])) : FEAT_INDEX;
  (ch?.feats || []).forEach((n) => {
    const f = FEAT_MECHANICS[n];
    if (!f) return;
    if (f.hpPerLevel) { out.hpPerLevel += f.hpPerLevel; out.sources.push(n); }
    if (f.speed) { out.speed += f.speed; out.sources.push(n); }
    if (f.mediumDexCap) out.mediumDexCap = Math.max(out.mediumDexCap, f.mediumDexCap);
    if (f.style) out.styles.push(f.style);
    if (f.save) out.saves.push({ abil: f.save, from: n });
    if (f.saveFromBump) { const b = featChoiceOf(ch, n).bump; if (b) out.saves.push({ abil: b, from: n }); }
    if (f.init) {
      // the 2014 wording hands out a flat +5; the SRD 5.2 wording hands out your proficiency bonus
      const flat = (defs.get(n)?.text || "").match(/\+\s*(\d+)\s*bonus to initiative/i);
      out.init = { label: n, value: flat ? +flat[1] : profBonus(totalLevel(ch)) };
    }
  });
  return out;
}
/* A fighting style is yours whether a class granted it or a feat bought it */
const hasStyle = (ch, name) => (ch?.styles || []).includes(name) || (ch?.feats || []).includes(`Fighting Style: ${name}`);
/* Tough and its kin read the same in every edition, so max HP needs no compendium */
const featHpBonus = (ch) => featEffects(ch).hpPerLevel * totalLevel(ch);

/* Structured prerequisites the picker can actually enforce; everything else stays advisory */
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
/* ---- Battle Master maneuvers, for Martial Adept (and anyone reading the archetype) ---- */
const MANEUVERS = {
  "Commander's Strike": "Forgo one of your attacks and use a bonus action to direct an ally: they use their reaction to make one weapon attack, adding your superiority die to the damage roll.",
  "Disarming Attack": "On a weapon hit, add the superiority die to damage; the target must pass a Strength save or drop one held item of your choice at its feet.",
  "Distracting Strike": "On a weapon hit, add the superiority die to damage; the next attack roll against the target by anyone but you has advantage until the start of your next turn.",
  "Evasive Footwork": "While moving, add the superiority die to your AC until you stop moving.",
  "Feinting Attack": "Bonus action: feint against one creature within 5 feet. You have advantage on your next attack against it this turn, adding the superiority die to the damage on a hit.",
  "Goading Attack": "On a weapon hit, add the superiority die to damage; the target must pass a Wisdom save or have disadvantage on attacks against anyone but you until the end of your next turn.",
  "Lunging Attack": "Increase your reach by 5 feet for one melee attack; on a hit, add the superiority die to the damage.",
  "Maneuvering Attack": "On a weapon hit, add the superiority die to damage; an ally can use their reaction to move half their speed without provoking opportunity attacks from the target.",
  "Menacing Attack": "On a weapon hit, add the superiority die to damage; the target must pass a Wisdom save or be frightened of you until the end of your next turn.",
  "Parry": "Reaction when hit by a melee attack: reduce the damage by the superiority die + your Dexterity modifier.",
  "Precision Attack": "Add the superiority die to a weapon attack roll, before or after rolling — but before effects apply.",
  "Pushing Attack": "On a weapon hit, add the superiority die to damage; a Large-or-smaller target must pass a Strength save or be pushed up to 15 feet away.",
  "Rally": "Bonus action: bolster one ally who can see or hear you — they gain temporary hit points equal to the superiority die + your Charisma modifier.",
  "Riposte": "Reaction when a creature misses you with a melee attack: make one melee weapon attack against it, adding the superiority die to the damage on a hit.",
  "Sweeping Attack": "On a melee hit, deal damage equal to the superiority die roll to a second creature within 5 feet of the first that you could also hit.",
  "Trip Attack": "On a weapon hit, add the superiority die to damage; a Large-or-smaller target must pass a Strength save or be knocked prone.",
};

/* ============ FEAT SELECTIONS ============
   Structured sub-choices and fixed grants, keyed by the feat's exact name so both the
   built-in catalogue and the bundled compendium's 2014 names resolve. Shapes:
     skills    { n, from? }         — proficiencies to pick (marked on the sheet)
     expertise { n }                — skills to double (from those you're proficient in)
     langs     { n }                — languages to pick (added to the sheet)
     choice    { label, options }   — one named choice (a class list, a damage type)
     spells    { cantrips?, level1?, class? ("$choice" reads the choice above),
                 schools?, ritual?, grant? }  — spell picks and fixed grants; grant is
                 a flat list, or { level: [names] } for marks that grow with character level
     maneuvers { n }                — Battle Master maneuvers
     allSkills true                 — proficiency in every skill (Boon of Skill)
     note      "…"                  — grants the sheet can't track (tools, instruments) */
const CASTER_LISTS = ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock", "Wizard"];
const FEAT_PICKS = {
  /* SRD 5.2 built-ins */
  "Magic Initiate": { choice: { label: "Spell list", options: ["Cleric", "Druid", "Wizard"] }, spells: { cantrips: 2, level1: 1, class: "$choice" } },
  "Ritual Caster": { choice: { label: "Ritual book's list", options: ["Cleric", "Druid", "Wizard"] }, spells: { level1: 2, ritual: true, class: "$choice" } },
  "Elemental Adept": { choice: { label: "Damage type", options: ["Acid", "Cold", "Fire", "Lightning", "Thunder"] } },
  "Fey-Touched": { spells: { level1: 1, schools: ["D", "EN"], grant: ["Misty Step"] } },
  "Shadow-Touched": { spells: { level1: 1, schools: ["I", "N"], grant: ["Invisibility"] } },
  "Telekinetic": { spells: { grant: ["Mage Hand"] } },
  "Telepathic": { spells: { grant: ["Detect Thoughts"] } },
  "Skilled": { skills: { n: 3 } },
  "Observant": { skills: { n: 1, from: ["Insight", "Investigation", "Perception"] } },
  "Boon of Skill": { allSkills: true, expertise: { n: 3 } },
  "Crafter": { note: "Pick your three artisan's tools at the table — the sheet doesn't track tool proficiencies." },
  "Musician": { note: "Pick your three instruments at the table — the sheet doesn't track instrument proficiencies." },
  /* 2014 compendium names */
  ...Object.fromEntries(CASTER_LISTS.map((c) => [`Magic Initiate (${c})`, { spells: { cantrips: 2, level1: 1, class: c } }])),
  ...Object.fromEntries(CASTER_LISTS.map((c) => [`Ritual Caster (${c})`, { spells: { level1: 2, ritual: true, class: c } }])),
  "Martial Adept": { maneuvers: { n: 2 } },
  "Linguist": { langs: { n: 3 } },
  "Prodigy": { skills: { n: 1 }, langs: { n: 1 }, expertise: { n: 1 }, note: "Also grants one tool proficiency — note it at the table." },
  "Weapon Master (Strength)": { note: "Pick your four weapon proficiencies at the table — the sheet doesn't track them." },
  "Weapon Master (Dexterity)": { note: "Pick your four weapon proficiencies at the table — the sheet doesn't track them." },
  /* racial spell-granting feats (2014) */
  "Wood Elf Magic": { spells: { cantrips: 1, class: "Druid", grant: ["Longstrider", "Pass without Trace"] } },
  "Drow High Magic": { spells: { grant: ["Detect Magic", "Levitate", "Dispel Magic"] } },
  "Fey Teleportation (Charisma)": { spells: { grant: ["Misty Step"] }, grantLangs: ["Sylvan"] },
  "Fey Teleportation (Intelligence)": { spells: { grant: ["Misty Step"] }, grantLangs: ["Sylvan"] },
  "Svirfneblin Magic": { spells: { grant: ["Nondetection", "Blindness/Deafness", "Blur", "Disguise Self"] } },
  "Aberrant Dragonmark": { spells: { cantrips: 1, level1: 1, class: "Sorcerer" } },
  "Dragon Wings": {}, // flight is rules text; nothing to pick
  /* Eberron dragonmarks: fixed spells that grow at character levels 5 and 9 */
  "Dragonmark of Detection": { spells: { grant: { 1: ["Detect Magic", "Mage Hand"], 5: ["Detect Thoughts"], 9: ["Clairvoyance"] } } },
  "Dragonmark of Finding": { spells: { grant: { 1: ["Identify", "Mage Hand"], 5: ["Locate Object"], 9: ["Clairvoyance"] } } },
  "Dragonmark of Handling": { spells: { grant: { 1: ["Druidcraft", "Speak with Animals"], 5: ["Beast Sense"], 9: ["Conjure Animals"] } } },
  "Dragonmark of Healing": { spells: { grant: { 1: ["Cure Wounds", "Spare the Dying"], 5: ["Lesser Restoration"], 9: ["Revivify"] } } },
  "Dragonmark of Hospitality": { spells: { grant: { 1: ["Friends", "Unseen Servant"], 5: ["Rope Trick"], 9: ["Leomund's Tiny Hut"] } } },
  "Dragonmark of Making": { spells: { grant: { 1: ["Identify", "Mending"], 5: ["Magic Weapon"], 9: ["Fabricate"] } } },
  "Dragonmark of Passage": { spells: { grant: { 1: ["Expeditious Retreat", "Light"], 5: ["Misty Step"], 9: ["Teleportation Circle"] } } },
  "Dragonmark of Scribing": { spells: { grant: { 1: ["Comprehend Languages", "Message"], 5: ["Sending"], 9: ["Tongues"] } } },
  "Dragonmark of Sentinel": { spells: { grant: { 1: ["Blade Ward", "Compelled Duel"], 5: ["Blur"], 9: ["Protection from Energy"] } } },
  "Dragonmark of Shadow": { spells: { grant: { 1: ["Dancing Lights", "Disguise Self"], 5: ["Darkness"], 9: ["Nondetection"] } } },
  "Dragonmark of Storm": { spells: { grant: { 1: ["Fog Cloud", "Shocking Grasp"], 5: ["Gust of Wind"], 9: ["Sleet Storm"] } } },
  "Dragonmark of Warding": { spells: { grant: { 1: ["Alarm", "Resistance"], 5: ["Arcane Lock"], 9: ["Magic Circle"] } } },
};
const featPickOf = (name, def) => FEAT_PICKS[name] || def?.pick || null;

/* Fixed spells a feat hands the character at a given character level */
function featGrantedSpells(name, level = 20, def) {
  const g = featPickOf(name, def)?.spells?.grant;
  if (!g) return [];
  if (Array.isArray(g)) return g;
  return Object.entries(g).filter(([l]) => level >= +l).flatMap(([, arr]) => arr);
}
/* Innate spells the character's race grants at their current level */
function raceGrantedSpells(ch) {
  const g = RACES[ch?.race]?.grantSpells;
  if (!g) return [];
  const lvl = totalLevel(ch);
  return Object.entries(g).filter(([l]) => lvl >= +l).flatMap(([, arr]) => arr);
}

/* Every spell a held feat contributes — fixed grants plus the player's own picks */
function featSpellsOf(ch) {
  const lvl = totalLevel(ch);
  return (ch?.feats || []).map((n) => {
    const c = featChoiceOf(ch, n);
    return { feat: n, names: [...featGrantedSpells(n, lvl), ...(c.cantrips || []), ...(c.spells || [])] };
  }).filter((e) => e.names.length);
}

/* A feat is only fully chosen once its own sub-choices are made */
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
};
/* 2024 Ranger prepared-spell counts, index = class level - 1 */
const RANGER_PREPARED = [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15];
const SPELL_ABILITY = { Bard: "cha", Cleric: "wis", Druid: "wis", Paladin: "cha", Ranger: "wis", Sorcerer: "cha", Warlock: "cha", Wizard: "int" };
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
/* Source XMLs list domain/oath/circle spells twice: "Bless" (Cleric, Paladin) and a starred
   twin "Bless*" carrying only the subclass tags (Cleric (Life), …) plus a footnote. The twin
   is pure metadata — fold its class tokens into the plain entry and drop it, so no picker
   ever offers the same spell twice. Spells starred without a plain twin pass through untouched. */
function foldStarredSpells(spells) {
  const tok = (s) => (s || "").split(",").map((t) => t.trim()).filter(Boolean);
  const plainNames = new Set(spells.filter((sp) => !sp.name.endsWith("*")).map((sp) => sp.name));
  const extras = new Map(); // plain name -> subclass tokens carried only by the starred twin
  const kept = [];
  spells.forEach((sp) => {
    const plain = sp.name.replace(/\*+$/, "");
    if (plain !== sp.name && plainNames.has(plain)) {
      extras.set(plain, [...(extras.get(plain) || []), ...tok(sp.classes)]);
      return;
    }
    kept.push(sp);
  });
  if (!extras.size) return spells; // nothing to fold — hand back the same array
  return kept.map((sp) => {
    const ex = extras.get(sp.name);
    if (!ex) return sp;
    const have = tok(sp.classes);
    const add = [...new Set(ex)].filter((t) => !have.includes(t));
    return add.length ? { ...sp, classes: [...have, ...add].join(", ") } : sp;
  });
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
/* Native single-class half-caster table (Paladin, 2014-style), index = class level - 1 */
const HALF_SLOTS = [
  [],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],
  [4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3],[4,3,3,3],[4,3,3,3,1],[4,3,3,3,2],
];
/* 2024 half-caster (Ranger): slots from 1st level, effectively caster level ⌈L/2⌉ */
const HALF1_SLOTS = [
  [2],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],
  [4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2],
];
const PACT = (l) => (l >= 17 ? { n: 4, lvl: 5 } : l >= 11 ? { n: 3, lvl: 5 } : l >= 9 ? { n: 2, lvl: 5 } : l >= 7 ? { n: 2, lvl: 4 } : l >= 5 ? { n: 2, lvl: 3 } : l >= 3 ? { n: 2, lvl: 2 } : l >= 2 ? { n: 2, lvl: 1 } : { n: 1, lvl: 1 });

function spellSlots(classes) {
  const casters = classes.filter((c) => ["full", "half", "half1"].includes(CLASSES[c.name].caster));
  if (!casters.length) return null;
  if (casters.length === 1 && CLASSES[casters[0].name].caster === "half") return HALF_SLOTS[casters[0].level - 1];
  if (casters.length === 1 && CLASSES[casters[0].name].caster === "half1") return HALF1_SLOTS[casters[0].level - 1];
  // a 2024 half-caster rounds its contribution up; the 2014 kind still rounds down
  const cl = casters.reduce((s, c) => s + (CLASSES[c.name].caster === "full" ? c.level : CLASSES[c.name].caster === "half1" ? Math.ceil(c.level / 2) : Math.floor(c.level / 2)), 0);
  return cl > 0 ? MC_SLOTS[Math.min(cl, 20) - 1] : null;
}

const totalLevel = (ch) => ch.classes.reduce((s, c) => s + c.level, 0);
const uid = () => Math.random().toString(36).slice(2, 10);

/* ============ SOURCEBOOK PREFERENCES ============ */
/* Which books feed the pickers. A disabled source vanishes from spell pick lists and
   summon musters — but never from a character: known spells still cast, mustered
   creatures keep their stat blocks, lore still answers. */
let __SRC_OFF = new Set();
let __BESTIARY = []; // SRD + sourcebook stat blocks, riding in the base compendium
const SRD_SRC = "5e SRD";
const spellSrcOf = (sp) => (((sp.text || "").match(/Source:\s*([^,\n]+)/) || [])[1] || "").trim() || "Homebrew & unsourced";
const creatureSrcOf = (b) => b.src || SRD_SRC;
const srcSpells = (list) => (__SRC_OFF.size ? list.filter((sp) => !__SRC_OFF.has(spellSrcOf(sp))) : list);

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
/* The sheet's quiet corner buttons — share and the golden ?, exactly as tall as Roster */
const cornerBtn = {
  flex: "0 0 auto", width: 44, borderRadius: 12, cursor: "pointer", boxSizing: "border-box",
  border: `1px solid ${T.edge}`, background: T.panel, color: T.gold, lineHeight: 1,
  display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85,
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
};
/* One page shell and one stylesheet, worn by the app and by shared sheets alike,
   so a sheet opened from a link is pixel-for-pixel the sheet its owner sees */
const SHELL_STYLE = {
  minHeight: "100vh", background: T.bg, color: T.ink,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  overflowX: "hidden", paddingBottom: "calc(60px + env(safe-area-inset-bottom))", WebkitFontSmoothing: "antialiased",
};
const GLOBAL_CSS = `
  @keyframes diceDrop {
    0% { transform: translateY(-90px) scale(0.7); opacity: 0; }
    55% { transform: translateY(0) scale(1.06); opacity: 1; }
    72% { transform: translateY(-14px) scale(0.98); }
    86% { transform: translateY(0) scale(1.02); }
    100% { transform: translateY(0) scale(1); }
  }
  @keyframes diceTumbleA { from { transform: rotate3d(1, 0.7, 0.35, -1620deg); } to { transform: rotate3d(1, 0.7, 0.35, 0deg); } }
  @keyframes diceTumbleB { from { transform: rotate3d(0.6, 1, 0.45, 1440deg); } to { transform: rotate3d(0.6, 1, 0.45, 0deg); } }
  @keyframes sheetVeil { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sheetRise { from { transform: translateY(100%); } to { transform: translateY(0); } }
  /* dvh tracks the true visible viewport on mobile (vh hides under browser chrome); the vh line is the fallback */
  .sheet-tall { height: min(82vh, 700px); height: min(82dvh, 700px); }
  .sheet-cap { max-height: min(88vh, 700px); max-height: min(88dvh, 700px); }
  .sheet-body { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  /* the horizon: a Bierstadt sunset at the page's foot, revealed as if the sky curtain
     were drawn back — the page's own dark bleeds down through most of the painting so
     only the glowing horizon and its lone rider surface, faint and atmospheric */
  .horizon { position: fixed; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0;
    height: clamp(150px, 24vh, 250px); opacity: 0.72;
    background-image: linear-gradient(to bottom, ${T.bg} 0%, ${T.bg}f7 20%, ${T.bg}cc 42%, ${T.bg}80 64%, ${T.bg}33 85%, ${T.bg}00 100%), url('./horizon.jpg');
    background-size: cover; background-position: center 62%;
    animation: horizonIn 2.6s ease-out both; }
  @media (min-width: 700px) { .horizon { height: clamp(200px, 32vh, 360px); } }
  @keyframes horizonIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 0.72; transform: none; } }
  [data-lore] { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .lore-lock, .lore-lock * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
`;

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
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.56 1.03Z" /></>,
  axe: <><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" /><path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  holy: <><path d="M12 2v20" /><path d="M5 8h14" /><path d="M7.5 21h9" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  swords: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /><path d="M9.5 6.5 21 18v3h-3L6.5 9.5" /></>,
  zen: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></>,
  paw: <><circle cx="5.3" cy="10.2" r="1.8" /><circle cx="9.2" cy="6.4" r="1.9" /><circle cx="14.8" cy="6.4" r="1.9" /><circle cx="18.7" cy="10.2" r="1.8" /><path d="M12 10.8c-2.7 0-5.4 2.7-5.4 5.4 0 1.9 1.4 3.1 3.1 3.1 1 0 1.5-.4 2.3-.4s1.3.4 2.3.4c1.7 0 3.1-1.2 3.1-3.1 0-2.7-2.7-5.4-5.4-5.4z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
  dagger: <><path d="M3 21l5-5" /><path d="m8 16 9.5-9.5a2.83 2.83 0 0 0-4-4L4 12l4 4Z" /><path d="M14 4l6 6" /></>,
  flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  share: <><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="m8 6 4-4 4 4" /><path d="M12 2v13" /></>,
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
    ironMind: clsLv("Ranger") >= 7 && hasSub(ch, "Gloom Stalker"),           // WIS save proficiency (2024)
    critRange: champLvl >= 15 ? 18 : champLvl >= 3 ? 19 : 20,                // Improved/Superior Critical
    archery: hasStyle(ch, "Archery") ? 2 : 0,
    barbarian: clsLv("Barbarian"),
    savageAttacks: ch.race === "Half-Orc",
    savageAttacker: hasFeat(ch, "Savage Attacker"),
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
    if (ch.race === "Yuan-ti Pureblood") n.push("Magic Resistance: advantage on saves against spells and magical effects");
    if (f.barbarian >= 1 && abil === "str" && !hasEffect(ch, "rage")) n.push("Rage: advantage on Strength saves while raging");
    if (f.barbarian >= 2 && abil === "dex") n.push("Danger Sense: advantage vs. effects you can see");
  }
  if (kind === "check" || kind === "skill") {
    if (f.barbarian >= 1 && abil === "str" && !hasEffect(ch, "rage")) n.push("Rage: advantage on Strength checks while raging");
    if ((abil === "wis" || abil === "int") && classLevel(ch, "Ranger") >= 1) {
      const foes = [ch.rangerChoices?.favEnemy, ...(ch.rangerChoices?.extraEnemies || [])].filter(Boolean);
      if (foes.length) n.push(`Favored Enemy: advantage on Survival checks to track and Intelligence checks to recall — ${foes.join(", ")}`);
    }
  }
  if (kind === "attack") {
    if (f.barbarian >= 2 && abil === "str" && !hasEffect(ch, "reckless-attack")) n.push("Reckless Attack: take advantage now, grant it until your next turn");
    if (f.savageAttacks) n.push("Savage Attacks: one extra damage die on a melee crit");
    if (f.savageAttacker) n.push("Savage Attacker: once per turn, roll the weapon's damage dice twice and keep either");
    if (ch.race === "Kobold") { n.push("Pack Tactics: advantage if an ally is within 5 ft of the target"); n.push("Sunlight Sensitivity: disadvantage in direct sunlight"); }
    if (ch.race === "Bugbear") n.push("Surprise Attack: +2d6 damage against a surprised creature on your first turn");
  }
  /* Feats the dice can't spend for you */
  if (hasFeat(ch, "Lucky")) n.push("Lucky: you may spend a Luck Point on this roll — long-press the feat for your table's wording");
  if (kind === "save" && abil === "con" && hasFeat(ch, "War Caster")) n.push("War Caster: advantage on Constitution saves to maintain Concentration");
  const fx = fxMods(ch);
  /* Effect notes are plain strings, or { t, abil } scoped to the ability being rolled */
  (fx.notes[kind === "skill" ? "check" : kind] || []).forEach((note) => {
    if (typeof note === "string") n.push(note);
    else if (!note.abil || !abil || [].concat(note.abil).includes(abil)) n.push(note.t);
  });
  return n;
}

/* minion: the bones belong to a summoned creature — the character's own features
   (Lucky, Reliable Talent, expanded crits) and effect notes stay out of its roll */
function RollTray({ title, mode, parts, kind, abil, proficient, extra, ch, minion, onClose, onDamage }) {
  const f = minion ? { critRange: 20 } : rollFeatures(ch);
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
  const notes = [...res.notes, ...(minion ? [] : rollNotes(ch, kind, abil)), ...(extra || [])];
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
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
          {onDamage ? (
            <>
              <button style={btn(false)} onClick={onClose}>{kind === "attack" ? "Miss — done" : "Done"}</button>
              <button style={{ ...btn(true), opacity: done ? 1 : 0.4 }} disabled={!done} onClick={onDamage}>Roll damage →</button>
            </>
          ) : (
            <button style={{ ...btn(true), opacity: done ? 1 : 0.4 }} disabled={!done} onClick={onClose}>Done</button>
          )}
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
  /* 2024 Hunter: two swappable options apiece, and no 11th/15th-level choices */
  { key: "Hunter's Prey", cls: "Ranger", sub: "Hunter", source: { list: ["Colossus Slayer", "Horde Breaker"] }, counts: { 3: 1 } },
  { key: "Defensive Tactics", cls: "Ranger", sub: "Hunter", source: { list: ["Escape the Horde", "Multiattack Defense"] }, counts: { 7: 1 } },
  { key: "Dragon Ancestor", cls: "Sorcerer", sub: "Draconic Bloodline", source: { featureSuffix: "Dragon Ancestor" }, counts: { 1: 1 } },
];
const CHOICE_KEYS = new Set(CHOICE_GROUPS.map((g) => g.key));

const choiceCum = (g, level) => Object.entries(g.counts).reduce((s, [l, n]) => s + (level >= +l ? n : 0), 0);
const groupMatches = (g, clsName, subclass) => g.cls === clsName && (!g.sub || (subclass && subTokens(subclass).includes(normSub(g.sub))));
function choiceOptionsFor(g, customs) {
  if (g.source.list) return g.source.list.map((n) => ({ name: n }));
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
/* Every cantrip the character knows, from any source: class lists, Pact of the Tome,
   racial pick, and the feats that teach one (picked or granted outright) */
const GRANT_CANTRIPS = new Set(["Mage Hand", "Druidcraft", "Spare the Dying", "Friends", "Light", "Message", "Blade Ward", "Dancing Lights", "Shocking Grasp", "Resistance", "Mending", "Poison Spray", "Produce Flame", "Shape Water"]);
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
/* Shillelagh swings on the spellcasting ability of whichever class knows it (Druid Wis,
   a Tome warlock Cha, a Nature cleric Wis…) — Wisdom is only the fallback */
const shillAbil = (ch) => {
  for (const [cls, book] of Object.entries(ch.spells || {})) {
    if (SPELL_ABILITY[cls] && ["cantrips", "spells"].some((k) => (book?.[k] || []).includes("Shillelagh"))) return SPELL_ABILITY[cls];
  }
  // A Pact of the Tome warlock's Shillelagh lives in the Book of Shadows, cast with Charisma
  if ((ch.tomeCantrips || []).includes("Shillelagh") && ch.classes.some((c) => c.name === "Warlock")) return SPELL_ABILITY.Warlock;
  return "wis";
};

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

  /* ---- Class features & actions in play ---- */
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

/* Raising an effect is the same bargain everywhere: your own concentration evicts its rival
   (refunding any max-HP grant the loser carried), duplicates refresh rather than stack,
   stacking conditions deepen, and temp HP keeps the larger pool. One patch, shared by the
   Effects card and the use prompt. */
function applyEffectPatch(ch, inst, grantTemp) {
  const effects = effectsOf(ch);
  let next = effects, dropped = [];
  const def = effDefOf(inst);
  if (isConcInst(inst)) { dropped = next.filter(isConcInst); next = next.filter((e) => !isConcInst(e)); }
  if (def?.stacks && next.some((e) => e.key === inst.key)) next = next.map((e) => (e.key === inst.key ? { ...e, stacks: Math.min(def.stacks, (e.stacks || 1) + 1) } : e));
  else if (inst.key !== "custom" && next.some((e) => e.key === inst.key)) { /* refreshed, not stacked */ }
  else next = [...next, inst];
  const refund = dropped.reduce((s, e) => s + instMaxHp(e, ch), 0);
  return {
    effects: next,
    ...(grantTemp ? { tempHp: Math.max(Math.max(0, ch.tempHp || 0), grantTemp) } : {}),
    ...(refund ? { dmg: Math.max(0, Math.max(0, ch.dmg || 0) - refund) } : {}),
  };
}

/* Aggregate every active effect into the numbers and reminders the sheet consumes */
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

/* Effective max HP: base + feats that scale with level (Tough) + effect increases,
   halved by deep exhaustion. Feat HP is derived, never banked into ch.maxHp, so it
   stays correct the moment you level — or if the feat is ever taken back. */
function effMaxHp(ch, fx = fxMods(ch)) {
  const t = ch.maxHp + featHpBonus(ch) + fx.maxHp;
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
  if (classLevel(ch, "Ranger") >= 6 && (!armor || armor.type !== "HA")) { v += 10; parts.push("Roving +10"); }
  const fe = featEffects(ch, customs);
  if (fe.speed) { v += fe.speed; parts.push(`feats +${fe.speed}`); }
  fx.speedAdd.forEach((s) => { v += s.value; parts.push(`${s.label} ${fmtMod(s.value)}`); });
  if (fx.speedMult !== 1) { v = Math.floor(v * fx.speedMult); parts.push(fx.speedMult > 1 ? `×${fx.speedMult}` : "halved"); }
  if (fx.speedZero) { v = 0; parts.push("held at 0"); }
  return { v: Math.max(0, v), parts, modified: parts.length > 1 };
}

/* ============ LIMITED-USE FEATURES — the ledger of daily heroics ============ */
/* Everything with a per-rest budget gets spell-slot-style pips (or a pool counter when the
   numbers run big). `when` decides who owns it, `max` how many, `per` when it refills;
   `effect` links a tracker to its EFFECT_LIB entry so expending a use activates the buff.
   Unlimited-at-20 features (Rage, Wild Shape) simply stop tracking at that level. */
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
/* Beyond the curated list, ANY feature whose rules text names its own recharge earns a
   tracker automatically — imported subclasses included. "Once you use this feature, you
   can't use it again until you finish a short or long rest" is machine-readable, so the
   sheet reads it: Fey Presence, Hexblade's Curse, Wrath of the Storm, invocation daily
   castings — if the text says it recharges, it gets pips. */
function parseLimitedUse(text, ch) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  // the sentence that forbids re-use AND names the rest that lifts the ban
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
  // compare with trailing parentheticals stripped: "Bardic Inspiration (d6)" and its (d8)
  // sibling are the same feature as the curated "Bardic Inspiration", not three trackers
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
/* The trackers a character actually owns right now: curated, text-derived, and hand-forged */
function useTrackersFor(ch, customs) {
  const built = USE_TRACKERS.filter((t) => t.when(ch)).map((t) => ({ ...t, max: t.max(ch), per: typeof t.per === "function" ? t.per(ch) : t.per, die: typeof t.die === "function" ? t.die(ch) : t.die, dieBonus: typeof t.dieBonus === "function" ? t.dieBonus(ch) : t.dieBonus }));
  const custom = (Array.isArray(ch.customTrackers) ? ch.customTrackers : []).map((t) => ({ key: `custom-${t.id}`, name: t.name, max: Math.max(1, t.max || 1), per: t.per === "short" ? "short" : "long", pool: (t.max || 1) > 12, custom: true, id: t.id }));
  return [...built, ...derivedTrackers(ch, customs), ...custom];
}

/* ============ MINIONS & SUMMONS — every creature that answers the call ============ */
/* A minion is a tracked creature the character brought to the table: a conjured wolf pack,
   a raised skeleton, a familiar, a beast companion, a wild shape form. Each instance keeps
   its own HP the same way the character does — maxHp recorded, dmg counted up, temp HP
   soaked first — plus a role so the table remembers what each body is for.
   Instance shape: { id, key, kind, name, role, source, maxHp, dmg, tempHp, ac, ends, note } */
const minionsOf = (ch) => (Array.isArray(ch.minions) ? ch.minions : []);

/* ---- The bestiary: full stat blocks, riding in the base compendium ----
   Loaded once by fetchBaseCompendium alongside spells and items. Summon sources
   query it by creature type and CR; long-pressing any creature reads its block. */
const SIZE_RANK = { Tiny: 0, Small: 1, Medium: 2, Large: 3, Huge: 4, Gargantuan: 5 };
const crShow = (cr) => (cr === 0.125 ? "⅛" : cr === 0.25 ? "¼" : cr === 0.5 ? "½" : String(cr));
const creatureByName = (n) => {
  const q = String(n || "").trim().toLowerCase();
  return (q && __BESTIARY.find((c) => c.name.toLowerCase() === q)) || null;
};
/* The stat block, typeset the way the books do it: tapered blood-red rules, the
   ability array in its own row of cards, bold-italic trait names running into their
   text, and section headings for Actions and their kin. The grid wraps 6 → 3 ability
   cards as the sheet narrows, so it reads as well on a phone as on a desktop. */
function StatBlock({ c }) {
  const Rule = () => <div style={{ height: 2, margin: "10px 0", borderRadius: 1, background: `linear-gradient(90deg, ${T.blood}, ${T.blood}66 65%, transparent)` }} />;
  const Prop = ({ label, children }) => (
    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: T.ink, margin: "1px 0" }}>
      <span style={{ color: T.gold, fontWeight: 700 }}>{label} </span>{children}
    </div>
  );
  const Entry = ({ e }) => {
    const [first, ...rest] = String(e.t).split(/\n+/);
    return (
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.ink, marginTop: 9 }}>
        <span style={{ fontWeight: 700, fontStyle: "italic" }}>{e.n}. </span>{first}
        {rest.map((p, i) => <div key={i} style={{ marginTop: 4, paddingLeft: p.startsWith("• ") ? 14 : 0 }}>{p}</div>)}
      </div>
    );
  };
  const Section = ({ title, list }) => (!list?.length ? null : (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: T.gold, borderBottom: `1px solid ${T.blood}aa`, paddingBottom: 3 }}>{title}</div>
      {list.map((e, i) => <Entry key={i} e={e} />)}
    </div>
  ));
  const props = [
    c.saves && ["Saving Throws", c.saves], c.skills && ["Skills", c.skills],
    c.vuln && ["Damage Vulnerabilities", c.vuln], c.res && ["Damage Resistances", c.res],
    c.imm && ["Damage Immunities", c.imm], c.cond && ["Condition Immunities", c.cond],
    c.sen && ["Senses", c.sen], ["Languages", c.lang || "—"],
    c.cr != null && ["Challenge", `${crShow(c.cr)}${c.xp ? ` (${c.xp.toLocaleString()} XP)` : ""}`],
  ].filter(Boolean);
  return (
    <div>
      <Rule />
      <Prop label="Armor Class">{c.acS || `${c.ac}${c.acN ? ` (${c.acN})` : ""}`}</Prop>
      <Prop label="Hit Points">{c.hpS || `${c.hp}${c.hd ? ` (${c.hd})` : ""}`}</Prop>
      <Prop label="Speed">{c.spd}</Prop>
      <Rule />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))", gap: 6 }}>
        {ABILITIES.map((a) => (
          <div key={a} style={{ background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "6px 2px", textAlign: "center" }}>
            <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1.5 }}>{a.toUpperCase()}</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: T.ink }}>{c.ab[a]} <span style={{ color: T.gold, fontSize: 12 }}>({fmtMod(mod(c.ab[a]))})</span></div>
          </div>
        ))}
      </div>
      <Rule />
      {props.map(([l, v]) => <Prop key={l} label={l}>{v}</Prop>)}
      {(c.traits || []).length > 0 && <><Rule />{c.traits.map((e, i) => <Entry key={i} e={e} />)}</>}
      <Section title="Actions" list={c.acts} />
      <Section title="Reactions" list={c.reacts} />
      <Section title="Legendary Actions" list={c.leg} />
    </div>
  );
}
/* The creatures a summon source can call: named picks or a type/CR query against the
   bestiary, each carrying its real HP and AC; the hand-listed forms only stand in
   when the compendium hasn't loaded (offline first visit). */
function summonFormsFor(def) {
  if (__BESTIARY.length) {
    let hits = null;
    if (def.pickNames) hits = def.pickNames.map(creatureByName).filter(Boolean);
    else if (def.pick) hits = __BESTIARY.filter((c) =>
      (!def.pick.types || def.pick.types.some((t) => c.type.startsWith(t)))
      && (def.pick.maxCr == null || c.cr <= def.pick.maxCr)
      && (def.pick.maxSize == null || SIZE_RANK[c.size] <= SIZE_RANK[def.pick.maxSize]));
    if (hits && __SRC_OFF.size) hits = hits.filter((c) => !__SRC_OFF.has(creatureSrcOf(c)));
    if (hits && hits.length) return hits
      .map((c) => ({ name: c.name, hp: c.hp, ac: c.ac, cr: c.cr, stat: true }))
      .sort((a, b) => ((a.cr ?? 99) - (b.cr ?? 99)) || a.name.localeCompare(b.name));
  }
  return def.forms;
}
/* `ends` follows the effects convention: "short" summons dissolve on any rest (the
   concentration menagerie), "long" outlast an hour's breather but not the night,
   "manual" creatures (familiars, steeds, the walking dead) stay until dismissed. */
const SM = (kind, source, def) => ({ key: slugFx(source), kind, source, ...def });
const SUMMON_LIB = [
  /* ---- Spells: the conjurer's bestiary ---- */
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
  /* ---- Class features & pact boons ---- */
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
  /* ---- The Summon-spirit family (Tasha's, Fizban's): one spirit whose AC and HP
     scale with the slot — `slot` is the base level, AC = acPlus + slot level,
     HP = the form's base + hpStep per slot level above the base. ---- */
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
  /* ---- The whole bestiary, for everything else: feats, magic items, DM gifts ---- */
  SM("Bestiary", "Any creature", { ends: "manual", role: "Companion", pick: {}, brief: "Every SRD stat block — muster anything a feat, item, or DM's whim can grant", forms: [["Creature", 10, 10]] }),
].map((d) => ({ ...d, forms: d.forms.map((f) => (Array.isArray(f) ? { name: f[0], hp: f[1], ac: f[2] } : f)) }));
/* Match a tapped spell/feature name to its summon entry — "(Ritual Only)" twins included */
const summonDefFor = (name) => {
  const n = baseSubName(String(name || "").trim());
  return SUMMON_LIB.find((d) => d.source === n || d.source === String(name || "").trim()) || null;
};
/* Spirit arithmetic: the Summon-spirit spells build their creature from the slot */
const spiritHp = (def, form, slot) => (form.hp || 1) + (def.hpStep || 0) * Math.max(0, (slot || def.slot) - def.slot);
const spiritAc = (def, form, slot) => (form.acPlus ?? def.acPlus) + (slot || def.slot);
/* An imported summon spell the catalog doesn't know still gets a muster if its own
   text carries the spirit formulas ("AC 11 + the level of the spell", "40 + 10 for
   each spell level above 4th") — the whole def is conjured from the spell. */
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
/* ---- Reading the dice out of a stat block ----
   An attack action names its to-hit bonus and its damage dice in prose; every
   parenthesized dice group in the Hit clause rolls together (a bite's piercing
   plus its venom). Spirit attacks that scale with the slot keep a reminder note. */
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
/* A spirit swings with its summoner's spell attack: proficiency plus the casting
   ability of whichever class knows the source spell (first caster as a fallback). */
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
/* Saves use the block's listed proficiencies where they exist, the bare modifier
   elsewhere; skills come straight off the block's own line. */
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

/* Damage a minion the same way the character takes it: temp HP soaks first, then the wound
   is recorded; healing unwinds recorded damage and never overshoots the maximum. */
const minionHp = (m) => Math.max(0, (m.maxHp || 1) - Math.max(0, m.dmg || 0));
function minionApplyHp(m, delta) {
  if (delta >= 0) return { ...m, dmg: Math.max(0, Math.max(0, m.dmg || 0) - delta) };
  const d = -delta, temp = Math.max(0, m.tempHp || 0);
  const fromTemp = Math.min(temp, d);
  return { ...m, tempHp: temp - fromTemp, dmg: Math.min(m.maxHp || 1, Math.max(0, m.dmg || 0) + (d - fromTemp)) };
}

/* ============ TAP TO ACT — resolve a tapped name into its use recipe ============ */
/* A tap on a spell, feature, feat, or trait gathers everything the sheet knows about USING
   it: the spell entry (slot level, ritual flag, concentration in the duration text), any
   catalog effects it raises (Enlarge/Reduce yields two — the prompt offers the choice), and
   the limited-use tracker that pays for it. A name that resolves nothing stays a lore tap. */
/* Booming Blade & Green-Flame Blade: cantrips cast AS a melee weapon attack whose on-hit
   elemental rider (thunder / fire) grows at levels 5, 11, 17. They ride the weapon, not a
   spell attack, so the strike uses the weapon's own attack and damage. */
const isBladeCantrip = (name) => /(booming|green[- ]?flame)\s*blade/i.test(String(name || ""));
const bladeRiderTier = (lvl) => (lvl >= 17 ? 3 : lvl >= 11 ? 2 : lvl >= 5 ? 1 : 0);

/* ===== The strike framework: read a spell's own words to learn whether casting it wants an
   attack roll, a saving throw, and/or a damage roll — and how the dice grow (cantrips with
   character level at 5/11/17; leveled spells with the slot). Returns null for spells that
   roll no damage, so buffs and utility keep their plain cast. A few projectile spells don't
   describe their dice the usual way and are pinned by name. ===== */
const DMG_WORD_CODE = { acid: "A", bludgeoning: "B", cold: "C", fire: "F", force: "FC", lightning: "L", necrotic: "N", piercing: "P", poison: "PS", psychic: "PSY", radiant: "R", slashing: "S", thunder: "T" };
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
  if (!dmgM) return null; // nothing to roll for damage
  const atkM = t.match(/make a (ranged|melee) spell attack/i);
  const saveM = t.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i);
  // Only a spell attack or a saving throw makes casting a "roll now" strike. Without either, the
  // dice belong to a rider (Hex, a smite), a summon's own attack, or a mishap — not the cast.
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

/* ============ CONSUMABLES — arrows fly away, potions go down the hatch ============ */
const usesAmmo = (it) => (it.property || "").split(",").map((x) => x.trim()).includes("A");
/* Which inventory row feeds this weapon: the matching ammo word first, any ammunition second */
function ammoRowFor(ch, customs, weapon) {
  const rows = (ch.inventory || []).filter((r) => (r.qty || 1) > 0);
  const ammo = rows.filter((r) => { const it = findItem(r.name, customs); return (it && it.type === "A") || /arrow|bolt|bullet|needle/i.test(r.name); });
  const w = weapon.name.toLowerCase();
  const word = w.includes("crossbow") ? "bolt" : w.includes("bow") ? "arrow" : w.includes("sling") ? "bullet" : w.includes("blowgun") ? "needle" : null;
  return (word && ammo.find((r) => r.name.toLowerCase().includes(word))) || ammo[0] || null;
}
const isConsumableRow = (row, item) => (item ? ["P", "SC"].includes(item.type) : false) || /potion|elixir|philter|oil of|scroll of|antitoxin|holy water|alchemist's fire|acid \(vial\)|tanglefoot/i.test(row.name);
const HEALING_TIERS = [[/supreme/i, { n: 10, sides: 4, plus: 20 }], [/superior/i, { n: 8, sides: 4, plus: 8 }], [/greater/i, { n: 4, sides: 4, plus: 4 }], [/./, { n: 2, sides: 4, plus: 2 }]];
const healingDiceFor = (name) => (/potion of.*healing|healing potion/i.test(name) ? HEALING_TIERS.find(([re]) => re.test(name))[1] : null);
/* A potion named after a catalog effect raises that effect when drunk — and potions never
   require concentration, so the effect rides the ally/held-for-you flag */
const POTION_EFFECT_ALIAS = { speed: "haste", flying: "fly", growth: "enlarge", diminution: "reduce" };
function consumableEffectKey(name) {
  const m = name.match(/^\s*(?:potion|philter|elixir|oil)\s+of\s+(.+?)\s*(?:\(.*\))?\s*$/i);
  if (!m) return null;
  const base = m[1].trim().toLowerCase();
  if (POTION_EFFECT_ALIAS[base]) return POTION_EFFECT_ALIAS[base];
  const hit = EFFECT_LIB.find((e) => e.name.toLowerCase() === base);
  return hit ? hit.key : null;
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
const creatureInfo = (b) => ({
  title: b.name,
  meta: [[b.size, b.type].filter(Boolean).join(" "), b.align].filter(Boolean).join(", "),
  block: b,
  foot: b.src ? `Source: ${b.src}` : "5e SRD bestiary",
});
function infoFor(rawName, customs) {
  const name = String(rawName || "").trim();
  if (!name) return null;
  // "creature:Wolf" insists on the stat block even where an item shares the name (mounts)
  if (name.startsWith("creature:")) {
    const b = creatureByName(name.slice(9));
    if (b) return creatureInfo(b);
  }
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
  const beast = creatureByName(name) || creatureByName(strip);
  if (beast) return creatureInfo(beast);
  const inv = INVOCATION_DATA.find(([n]) => n === name || n === strip);
  if (inv) return { title: inv[0], meta: ["Eldritch Invocation", inv[1] > 0 ? `requires warlock ${inv[1]}` : "", inv[2] ? `requires ${inv[2]}` : ""].filter(Boolean).join(" · "), body: INVOCATION_INFO[inv[0]] || null };
  if (METAMAGIC_INFO[name]) return { title: name, meta: "Metamagic", body: METAMAGIC_INFO[name] };
  if (MANEUVERS[strip]) return { title: strip, meta: "Battle Master maneuver", body: MANEUVERS[strip] + "\n\nManeuvers ride on superiority dice — a Battle Master's own, or the single d6 the Martial Adept feat grants (regained on a short or long rest)." };
  if (BOON_INFO[name]) return { title: name, meta: "Pact Boon", body: BOON_INFO[name] };
  const fs = strip.replace(/^Fighting Style:\s*/, "");
  // a "Fighting Style: X" name is the feat — let its fuller entry answer before the one-liner
  if (STYLE_DESC[fs] && fs === strip) return { title: `Fighting Style: ${fs}`, meta: "Fighting Style", body: STYLE_DESC[fs] };
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
  /* Backgrounds resolve ahead of the feature-text sweep so the meta line carries their
     mechanics; the compendium's fuller prose (when imported) still supplies the body */
  const bgd = BACKGROUNDS[name] || BACKGROUNDS[strip];
  if (bgd) {
    const bgTitle = BACKGROUNDS[name] ? name : strip;
    const ftx = (customs?.featureTexts || {})[bgTitle];
    return {
      title: bgTitle,
      meta: ["Background", `Skills: ${bgd.skills.join(" & ")}`, bgd.langs ? `${bgd.langs} extra language${bgd.langs > 1 ? "s" : ""}` : null, bgd.tools ? `Tools: ${bgd.tools}` : null].filter(Boolean).join(" · "),
      body: ftx || `${bgd.flavor}\n${bgd.feature}. ${bgd.featureText}`,
      foot: ftx ? sourceOf(ftx) : null,
    };
  }
  const ft = customs?.featureTexts || {};
  let key = ft[name] ? name : ft[strip] ? strip : Object.keys(ft).find((k) => baseSubName(k) === strip || k.startsWith(strip + " ("));
  if (!key) { const cp = name.match(/^([^:]+):/); if (cp && ft[cp[1].trim()]) key = cp[1].trim(); }
  if (!key) key = Object.keys(ft).filter((k) => k.length > 3 && strip.startsWith(k + " ")).sort((a, b) => b.length - a.length)[0];
  if (key) return { title: strip, meta: "Feature", body: ft[key], foot: sourceOf(ft[key]) };
  if (FEATURE_TEXT[name] || FEATURE_TEXT[strip]) return { title: strip, meta: "Feature", body: FEATURE_TEXT[name] || FEATURE_TEXT[strip], foot: SRD_FOOT };
  if (CORE_FEATURE_INFO[strip]) return { title: strip, meta: "Feature", body: CORE_FEATURE_INFO[strip] };
  const eff = EFFECT_LIB.find((x) => x.name === name || x.name === strip);
  if (eff) return { title: eff.name, meta: [eff.kind === "Condition" ? "Condition" : `${eff.kind} · trackable effect`, eff.conc && "Concentration", eff.dur].filter(Boolean).join(" · "), body: [eff.brief, eff.desc].filter(Boolean).join("\n") };
  const bgFeat = Object.entries(BACKGROUNDS).find(([, b]) => b.feature === name || b.feature === strip);
  if (bgFeat) return { title: bgFeat[1].feature, meta: `Background feature · ${bgFeat[0]}`, body: bgFeat[1].featureText };
  return null;
}

/* Long-press (or right-click) to open the lore sheet. data-lore kills text selection on the
   element itself via CSS, but iOS will happily start selecting NEIGHBORING text mid-press —
   so the whole page gets a selection lock the moment a lore press begins, any selection that
   snuck in is dissolved, and the lock lifts only when the press aborts or the sheet closes. */
let __showLore = null;
function loreLock(on) {
  document.documentElement.classList.toggle("lore-lock", on);
  if (on) { try { const sel = window.getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges(); } catch { /* selection API sulking — the CSS lock still holds */ } }
}
function lorePress(name) {
  return {
    "data-lore": "",
    onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); __showLore && __showLore(name); },
    onPointerDown: (e) => {
      const el = e.currentTarget;
      // a long-press whose release landed on the sheet's backdrop never got its click,
      // so the fired flag can go stale — each new press starts with a clean slate
      delete el.dataset.loreFired;
      const sx = e.clientX, sy = e.clientY;
      loreLock(true);
      const t = setTimeout(() => {
        el.dataset.loreFired = "1";
        loreLock(true); // re-dissolve anything iOS selected during the hold
        if (__showLore) __showLore(name); else loreLock(false);
      }, 480);
      const move = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) end(); };
      const end = () => {
        clearTimeout(t);
        if (!el.dataset.loreFired) loreLock(false); // aborted press; a fired one unlocks when the sheet closes
        el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", end); el.removeEventListener("pointercancel", end); el.removeEventListener("pointerleave", end);
      };
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
  __showLore = (name) => { openedAt.current = Date.now(); loreLock(true); setItem(infoFor(name, customs) || { title: String(name), meta: "", body: null }); };
  if (!item) return null;
  const close = () => { setItem(null); loreLock(false); };
  // the release of the long-press lands on this backdrop — a short grace period keeps it open
  const dismiss = () => { if (Date.now() - openedAt.current > 400) close(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={dismiss}>
      <div style={{ ...card, width: "min(620px, 100%)", maxHeight: "72vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>{item.title}</div>
          <span style={{ color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1 }} onClick={close}>✕</span>
        </div>
        {item.meta && <div style={{ color: "#b48ead", fontSize: 13, marginTop: 4, fontStyle: item.block ? "italic" : "normal" }}>{item.meta}</div>}
        <div style={{ color: T.ink, fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
          {item.block
            ? <StatBlock c={item.block} />
            : item.body
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

/* ---- sourcebook preferences persist beside the characters ---- */
const SRCKEY = "dnd-source-prefs-v1";
async function loadSrcPrefs() {
  try { const r = await window.storage.get(SRCKEY); return new Set(JSON.parse(r.value).off || []); } catch { return new Set(); }
}
async function saveSrcPrefs(off) {
  try { await window.storage.set(SRCKEY, JSON.stringify({ off: [...off] })); } catch (e) { console.error("save failed", e); }
}

/* ============ CUSTOM (HOMEBREW) CONTENT ============ */
const CKEY = "dnd-custom-content-v1";
const EMPTY_CUSTOM = { subs: {}, feats: [], spells: [], items: [], featureTexts: {} };

/* ---- the built-in compendium: baked to JSON at build time, fetched once, never "imported" ----
   The base layer lives in the deploy (public/compendium.json, generated from the source XML by
   scripts/bake-compendium.cjs). Stored customs hold ONLY the user's own content; the two layers
   merge in memory at boot, and anything identical to the base is stripped before every save —
   which also shrinks legacy stores that still carry a full imported copy. */
let __BASE = null;
async function fetchBaseCompendium() {
  if (__BASE) return __BASE;
  try {
    const res = await fetch("compendium.json");
    if (!res.ok) return null;
    __BASE = await res.json();
    __BESTIARY = Array.isArray(__BASE.bestiary) ? __BASE.bestiary : [];
    if (typeof window !== "undefined") window.__ledgerBase = __BASE;
    return __BASE;
  } catch { return null; /* offline first visit or no bundled data — stored customs stand alone */ }
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

const allSubs = (cls, customs) => CLASSES[cls].subs.concat((customs?.subs?.[cls] || []).map((s) => s.name).filter((n) => !CLASSES[cls].subs.includes(n)));
const customSubFeats = (subclass, level, customs) => {
  for (const arr of Object.values(customs?.subs || {})) {
    const hit = arr.find((s) => s.name === subclass || s.name === baseSubName(subclass));
    if (hit) return hit.feats?.[level] || [];
  }
  return [];
};
/* Where a built-in table exists for a subclass, it is the current printing — the imported
   2014 copy of the same name stays out of the feature list entirely */
const allSubFeats = (subclass, level, customs) =>
  SUB_FEATS[baseSubName(subclass || "")]
    ? subFeatsFor(subclass, level)
    : subFeatsFor(subclass, level).concat(customSubFeats(subclass, level, customs));
const allFeats = (customs) => {
  const map = new Map(FEATS.map((f) => [f.name, f]));
  /* An imported compendium is the table's own rulebook: where it names a feat the built-in
     catalogue also carries, its wording, prerequisites and ability bump win outright — the
     SRD entry is the fallback for tables that import nothing. Only the picker's forced
     sub-choices (which proficiencies a feat makes you pick) carry over, since the importer
     has no way to express them. */
  (customs?.feats || []).forEach((f) => {
    const base = map.get(f.name);
    const fx = FEAT_MECHANICS[f.name];
    map.set(f.name, {
      cat: base?.cat || "Imported", ...f,
      ...(!f.bump?.length && fx?.bump ? { bump: fx.bump } : {}),
    });
  });
  // every entry resolves its structured sub-choices through the selections table
  return [...map.values()].map((f) => ({ ...f, pick: featPickOf(f.name, f) }));
};

/* ============ SHARE — one soul, sealed inside a link ============ */
/* There is no server to hold a shared sheet, and none is needed: the character
   itself rides in the URL fragment — JSON, deflated by the browser's native
   CompressionStream, then base64url. The fragment never leaves the device that
   opens it (servers don't see fragments), the passphrase gate stays shut on
   everything else, and the link reveals exactly what its sender chose to put
   in it: this one character, as they stood that day. */
const b64uFromBytes = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const bytesFromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const pipeBytes = async (bytes, transform) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());

/* A viewer's browser only carries the base compendium, so any homebrew the
   character actually leans on — gear in the pack, spells known, their subclass,
   their feats and rules text — travels with them. Only the referenced slice:
   a whole imported compendium would sink the link. */
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

/* ---- the share card: a hand-drawn banner worth its pixels ----
   Link unfurlers never run JavaScript, and a static host serves every visitor
   the same HTML — so a per-character link preview is physically impossible
   here. This is better: the OWNER's device holds everything (even the portrait
   that stays out of the link), so the share sheet paints a full 1200×630
   character card and sends it through the native share tray as a real image,
   beside the link. The recipient sees the character, not a favicon. */
const SHARE_W = 1200, SHARE_H = 630;
const CARD_SERIF = 'Georgia, "Liberation Serif", "Times New Roman", serif';
const CARD_SANS = '-apple-system, "SF Pro Text", "DejaVu Sans", system-ui, sans-serif';
const loadImg = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});
/* ICON_PATHS holds JSX; walk the fragment's children back into SVG markup so
   the class sigils can be stamped onto a canvas in their class colors */
function iconDataUri(name, color) {
  const frag = ICON_PATHS[name];
  if (!frag) return null;
  const inner = React.Children.toArray(frag.props.children)
    .map((el) => `<${el.type} ${Object.entries(el.props).filter(([k]) => k !== "children").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  )}`;
}
const roundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
/* Shrink a line until it fits — a long name deserves the width, not a crop */
const fitFont = (ctx, text, weight, px, family, maxW) => {
  for (; px > 20; px -= 2) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return px;
};
const shareLine = (ch, customs) => {
  const max = effMaxHp(ch);
  const cur = Math.max(0, max - Math.max(0, ch.dmg || 0));
  return `${ch.name} — ${ch.race} ${ch.classes.map((c) => `${c.name} ${c.level}`).join(" / ")} · HP ${cur}/${max} · AC ${armorClass(ch, customs).ac}`;
};
async function drawShareCard(ch, customs) {
  const cv = document.createElement("canvas");
  cv.width = SHARE_W; cv.height = SHARE_H;
  const ctx = cv.getContext("2d");
  const maxHp = effMaxHp(ch), curHp = Math.max(0, maxHp - Math.max(0, ch.dmg || 0));
  const hpRatio = maxHp ? curHp / maxHp : 0;
  const hpColor = hpRatio > 0.5 ? T.green : hpRatio > 0.25 ? T.gold : "#d76a76";
  const lvl = totalLevel(ch), photo = ch.photo ? await loadImg(ch.photo).catch(() => null) : null;

  // the ground, and the horizon sinking along the card's foot as it does on the roster
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  const horizon = await loadImg("./horizon.jpg").catch(() => null);
  if (horizon) {
    const hh = 320;
    const scale = Math.max(SHARE_W / horizon.width, hh / horizon.height);
    const sw = SHARE_W / scale, sh = hh / scale;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(horizon, (horizon.width - sw) / 2, Math.min(horizon.height - sh, horizon.height * 0.62 - sh / 2), sw, sh, 0, SHARE_H - hh, SHARE_W, hh);
    ctx.globalAlpha = 1;
    const veil = ctx.createLinearGradient(0, SHARE_H - hh, 0, SHARE_H);
    veil.addColorStop(0, T.bg); veil.addColorStop(0.45, `${T.bg}cc`); veil.addColorStop(1, `${T.bg}22`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, SHARE_H - hh, SHARE_W, hh);
  }
  // a double gold rule, like the cover of a good book
  ctx.strokeStyle = `${T.gold}99`; ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, SHARE_W - 32, SHARE_H - 32);
  ctx.strokeStyle = `${T.gold}40`; ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, SHARE_W - 52, SHARE_H - 52);

  // masthead
  const X = 64;
  ctx.fillStyle = T.dim;
  ctx.font = `24px ${CARD_SANS}`;
  try { ctx.letterSpacing = "8px"; } catch { /* older engines: tighter, still fine */ }
  ctx.fillText("THE ADVENTURER'S LEDGER", X, 92);
  try { ctx.letterSpacing = "0px"; } catch { /* noop */ }

  // the portrait, if one hangs in the hall — it never rides in the link, but this card is painted at home
  let rightEdge = SHARE_W - X;
  if (photo) {
    const R = 92, cx = SHARE_W - X - R, cy = 168;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const pscale = Math.max((R * 2) / photo.width, (R * 2) / photo.height);
    ctx.drawImage(photo, cx - (photo.width * pscale) / 2, cy - (photo.height * pscale) / 2, photo.width * pscale, photo.height * pscale);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = T.gold; ctx.lineWidth = 4; ctx.stroke();
    rightEdge = cx - R - 40;
  }

  // the name, gold and as large as it can stand
  ctx.fillStyle = T.gold;
  fitFont(ctx, ch.name, 700, 88, CARD_SERIF, rightEdge - X);
  ctx.fillText(ch.name, X, 196);

  // race and classes, each class wearing its sigil and colors
  let x = X;
  const midY = 264;
  ctx.font = `36px ${CARD_SERIF}`;
  ctx.fillStyle = T.ink;
  ctx.fillText(ch.race, x, midY);
  x += ctx.measureText(ch.race).width + 18;
  for (let i = 0; i < ch.classes.length; i++) {
    const c = ch.classes[i];
    const theme = CLASS_THEMES[c.name] || { color: T.ink, icon: "d20" };
    if (i > 0) {
      ctx.fillStyle = T.dim; ctx.font = `36px ${CARD_SERIF}`;
      ctx.fillText("/", x, midY);
      x += ctx.measureText("/").width + 14;
    }
    const sigil = await loadImg(iconDataUri(theme.icon, theme.color)).catch(() => null);
    if (sigil) { ctx.drawImage(sigil, x, midY - 32, 38, 38); x += 48; }
    ctx.fillStyle = theme.color; ctx.font = `36px ${CARD_SERIF}`;
    const label = `${c.name} ${c.level}`;
    ctx.fillText(label, x, midY);
    x += ctx.measureText(label).width + 16;
  }

  // the vitals, as chips: level, hit points with their bar, armor class, proficiency
  const chipY = 320, chipH = 128, gap = 20;
  const chips = [
    { label: "LEVEL", value: `${lvl}`, w: 170 },
    { label: "HIT POINTS", value: `${curHp} / ${maxHp}`, w: 330, bar: true },
    { label: "ARMOR CLASS", value: `${armorClass(ch, customs).ac}`, w: 250 },
    { label: "PROFICIENCY", value: fmtMod(profBonus(lvl)), w: 250 },
  ];
  let cx2 = X;
  for (const chip of chips) {
    roundedRect(ctx, cx2, chipY, chip.w, chipH, 18);
    ctx.fillStyle = `${T.panel}e6`; ctx.fill();
    ctx.strokeStyle = T.edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = T.dim; ctx.font = `20px ${CARD_SANS}`;
    ctx.fillText(chip.label, cx2 + 26, chipY + 40);
    ctx.fillStyle = chip.bar ? hpColor : chip.label === "LEVEL" ? T.gold : T.ink;
    ctx.font = `700 54px ${CARD_SERIF}`;
    ctx.fillText(chip.value, cx2 + 26, chipY + 100);
    if (chip.bar) {
      const bw = chip.w - 52, bx = cx2 + 26, by = chipY + 112;
      roundedRect(ctx, bx, by, bw, 8, 4); ctx.fillStyle = T.panel2; ctx.fill();
      if (hpRatio > 0) { roundedRect(ctx, bx, by, Math.max(8, bw * hpRatio), 8, 4); ctx.fillStyle = hpColor; ctx.fill(); }
    }
    cx2 += chip.w + gap;
  }

  // the colophon
  ctx.fillStyle = T.dim; ctx.font = `22px ${CARD_SANS}`;
  ctx.fillText(`Read-only snapshot · shared ${new Date().toISOString().slice(0, 10)}`, X, SHARE_H - 58);
  return cv;
}

/* The payload's first character names its wrapping: "1" deflate-raw, "0" plain.
   Bump `v` if the shape ever changes so old links fail loudly, not weirdly. */
async function encodeShare(ch, customs) {
  const { photo, log, hpLog, ...soul } = ch; // the portrait is megabytes and the chronicle is history — neither belongs in a link
  const payload = { v: 1, t: new Date().toISOString().slice(0, 10), c: soul, x: shareCustomsFor(ch, customs) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const canDeflate = typeof CompressionStream !== "undefined";
  const body = canDeflate ? await pipeBytes(bytes, new CompressionStream("deflate-raw")) : bytes;
  return `${location.href.split("#")[0]}#share=${canDeflate ? "1" : "0"}${b64uFromBytes(body)}`;
}
async function decodeShare(token) {
  const body = bytesFromB64u(token.slice(1));
  const json = token[0] === "1"
    ? new TextDecoder().decode(await pipeBytes(body, new DecompressionStream("deflate-raw")))
    : token[0] === "0" ? new TextDecoder().decode(body)
    : null;
  const payload = JSON.parse(json); // a null or clipped token throws here, and the caller shows the faded-link card
  const c = payload?.v === 1 ? payload.c : null;
  // the sheet dereferences race, classes, and abilities without mercy — a link that
  // doesn't hold all three (mangled, or forged by hand) dies here, on the error card
  if (!c?.name || !RACES[c.race] || !Array.isArray(c.classes) || !c.classes.length || c.classes.some((x) => !CLASSES[x?.name]) || ABILITIES.some((a) => typeof c.abilities?.[a] !== "number")) {
    throw new Error("not a shared character");
  }
  payload.c = { ...c, photo: null, log: [], skills: Array.isArray(c.skills) ? c.skills : [], maxHp: typeof c.maxHp === "number" ? c.maxHp : 1 };
  payload.x = { ...EMPTY_CUSTOM, ...(payload.x || {}) };
  return payload;
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

const ABIL_MIN = 1, ABIL_MAX = 30; // Direct Entry trusts the table: anything a DM can hand out

/* The +N-to-abilities-of-your-choice picker some lineages carry (Half-Elf, Variant Human,
   Custom Lineage). It appears twice on purpose: on the Race step, and again beside the
   Abilities grid — where `scores` previews what each button does to the real number. */
function LineageBonusPicker({ raceData, picks, setPicks, scores, extra = {} }) {
  const amt = raceData.chooseAmt || 1;
  const opts = ABILITIES.filter((a) => !(raceData.chooseNot || []).includes(a));
  return (
    <>
      <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>
        Choose {raceData.choose === 1 ? "one ability" : `${raceData.choose} different abilities`} for +{amt}
        {raceData.chooseNot?.length ? ` (not ${raceData.chooseNot.map((a) => ABIL_NAMES[a]).join(", ")})` : ""} ({picks.length}/{raceData.choose})
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {opts.map((a) => {
          const on = picks.includes(a);
          const base = scores ? scores[a] + (raceData.bonus[a] || 0) + (extra[a] || 0) : null;
          return (
            <button key={a} style={{ ...btn(on), padding: "6px 12px" }}
              onClick={() => setPicks(on ? picks.filter((x) => x !== a) : picks.length < raceData.choose ? [...picks, a] : picks)}>
              {ABIL_NAMES[a]}{base !== null ? ` ${base}${on ? ` → ${base + amt}` : ""}` : ""}
            </button>
          );
        })}
      </div>
    </>
  );
}

function AbilityStep({ scores, setScores, method, setMethod, bonuses = {}, featBonus = {}, featLabel = "feat", children }) {
  // everything that lands on top of the raw score, for the live per-card preview
  const lift = (a) => (bonuses[a] || 0) + (featBonus[a] || 0);
  const [rolling, setRolling] = useState(null); // {dice, targetIdx}
  const [rolled, setRolled] = useState([]); // pool of rolled totals
  const [assignIdx, setAssignIdx] = useState({}); // ability -> pool index
  const [typed, setTyped] = useState({}); // Direct Entry: raw text, so a field can sit empty mid-edit

  const pbSpent = ABILITIES.reduce((s, a) => s + (PB_COST[scores[a]] ?? 0), 0);

  const startRoll = () => setRolling({ dice: [roll(6), roll(6), roll(6), roll(6)].map((v) => ({ sides: 6, value: v })) });

  const usedPool = Object.values(assignIdx);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["Standard Array", "Point Buy", "Roll 4d6", "Direct Entry"].map((m) => (
          <button key={m} style={{ ...btn(method === m), padding: "8px 14px" }} onClick={() => {
            setMethod(m); setAssignIdx({}); setTyped({});
            if (m !== "Roll 4d6") setRolled([]);
            setScores(Object.fromEntries(ABILITIES.map((a) => [a, m === "Direct Entry" ? 10 : 8])));
          }}>{m}</button>
        ))}
      </div>

      {method === "Point Buy" && (
        <div style={{ color: pbSpent > 27 ? T.blood : T.dim, marginBottom: 10, fontSize: 14 }}>
          Points spent: <b style={{ color: pbSpent > 27 ? T.blood : T.gold }}>{pbSpent} / 27</b>
        </div>
      )}

      {method === "Direct Entry" && (
        <div style={{ color: T.dim, marginBottom: 10, fontSize: 13, lineHeight: 1.6 }}>
          Type each score straight in — for a character rolled at the table, ported from another sheet,
          or handed out by your DM. No budget is enforced; {ABIL_MIN}–{ABIL_MAX} is the only limit.
          <b style={{ color: T.gold }}> Enter the raw scores</b> — racial bonuses are shown under each score and land on top.
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
            {method === "Direct Entry" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
                <button style={{ ...btn(false), padding: "2px 10px" }} onClick={() => { setTyped({ ...typed, [a]: undefined }); setScores({ ...scores, [a]: Math.max(ABIL_MIN, scores[a] - 1) }); }}>−</button>
                <input type="number" inputMode="numeric" min={ABIL_MIN} max={ABIL_MAX} value={typed[a] ?? scores[a]}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTyped({ ...typed, [a]: raw });
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n)) setScores({ ...scores, [a]: Math.max(ABIL_MIN, Math.min(ABIL_MAX, n)) });
                  }}
                  onBlur={() => setTyped({ ...typed, [a]: undefined })}
                  style={{ width: 62, textAlign: "center", background: T.panel, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 6, padding: "6px 4px", fontSize: 20, fontFamily: "Georgia, serif" }} />
                <button style={{ ...btn(false), padding: "2px 10px" }} onClick={() => { setTyped({ ...typed, [a]: undefined }); setScores({ ...scores, [a]: Math.min(ABIL_MAX, scores[a] + 1) }); }}>＋</button>
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
            {lift(a) > 0 && (
              <div style={{ color: T.dim, fontSize: 11.5, marginTop: 4 }}>
                {[bonuses[a] ? `race +${bonuses[a]}` : null, featBonus[a] ? `${featLabel} +${featBonus[a]}` : null].filter(Boolean).join(" · ")}
                {" → "}<b style={{ color: T.ink }}>{scores[a] + lift(a)}</b> <span style={{ color: T.gold }}>{fmtMod(mod(scores[a] + lift(a)))}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {method === "Standard Array" && (
        <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Assign 15, 14, 13, 12, 10, 8 — each once.</div>
      )}
      {method === "Direct Entry" && (
        <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>
          Total {ABILITIES.reduce((s, a) => s + scores[a], 0)}
          {ABILITIES.some((a) => lift(a)) ? ` (with bonuses: ${ABILITIES.reduce((s, a) => s + scores[a] + lift(a), 0)})` : ""}
          {" · modifiers "}{ABILITIES.map((a) => `${a.toUpperCase()} ${fmtMod(mod(scores[a] + lift(a)))}`).join(" · ")}
        </div>
      )}

      {children}

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

/* ============ THE HORIZON — a promise of adventure at the page's foot ============
   public/horizon.jpg: Albert Bierstadt (1830–1902), "On the Plains, Sunset" — a lone
   rider against a blazing prairie sunset, the painter's gold-and-blood palette a twin
   of the app's own. Public domain (author died 1902). Cropped to a wide band and served
   same-origin, as the CSP admits no outside art. Curtain gradient lives in .horizon. */
function HorizonArt() {
  return <div className="horizon" aria-hidden="true" />;
}

/* ============ CREATION WIZARD ============ */
function CreateWizard({ onDone, onCancel, customs }) {
  const [step, setStep] = useState(0);
  // each step is its own page — land at its top, not wherever the last one left the scroll
  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [race, setRace] = useState("Human");
  const [raceAbilPicks, setRaceAbilPicks] = useState([]); // abilities the lineage lets you raise
  const [raceFeat, setRaceFeat] = useState(null); // { name, bump, skills } for lineages that grant a feat
  const [lineageTrait, setLineageTrait] = useState(null); // Custom Lineage: 'darkvision' | 'skill'
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
  const [favHumanoids, setFavHumanoids] = useState(""); // the two named races, when that mode is chosen
  const [favLang, setFavLang] = useState(null); // the associated language
  const [natTerrain, setNatTerrain] = useState(null);
  const [persona, setPersona] = useState({ traits: "", ideals: "", bonds: "", flaws: "" });
  const [goldRoll, setGoldRoll] = useState(null);
  const [gearMode, setGearMode] = useState(null); // 'standard' | 'gold'
  const [gearPicks, setGearPicks] = useState({}); // slotIdx -> { opt, picks: [] }
  const [purchases, setPurchases] = useState([]); // { name, qty, price }
  const [shopQ, setShopQ] = useState("");
  const [langPicks, setLangPicks] = useState([]);
  const [ancestry, setAncestry] = useState(null);
  const [raceSkills, setRaceSkills] = useState([]); // extra skills the lineage itself grants
  const [showExpanded, setShowExpanded] = useState(false);
  const [heCantrip, setHeCantrip] = useState("");
  const [method, setMethod] = useState("Standard Array");
  const [scores, setScores] = useState(Object.fromEntries(ABILITIES.map((a) => [a, 8])));
  const photoUpload = usePhotoUpload(setPhoto);

  const raceData = RACES[race];
  const clsData = CLASSES[cls];
  /* Lineages that let you place their bonuses (Half-Elf, Variant Human, Custom Lineage)
     share one picker: `choose` says how many abilities, `chooseAmt` how much each gets. */
  const raceChooseAmt = raceData.chooseAmt || 1;
  const raceAbilOpts = ABILITIES.filter((a) => !(raceData.chooseNot || []).includes(a));
  const raceFeatDef = raceData.feat && raceFeat?.name ? allFeats(customs).find((f) => f.name === raceFeat.name) : null;
  const raceFeatFx = raceFeat?.name ? FEAT_MECHANICS[raceFeat.name] : null;
  const featScoreCap = raceFeatDef?.cat === "Epic Boon" ? 30 : 20;
  /* Scores before the lineage feat's own +1 — that's what its prerequisites are read against */
  const preFeatScores = { ...scores };
  ABILITIES.forEach((a) => { preFeatScores[a] += raceData.bonus[a] || 0; });
  raceAbilPicks.forEach((a) => { preFeatScores[a] += raceChooseAmt; });
  const finalScores = { ...preFeatScores };
  if (raceFeat?.bump) finalScores[raceFeat.bump] = Math.min(featScoreCap, finalScores[raceFeat.bump] + 1);

  const featSkillsEff = raceData.feat ? (raceFeat?.skills || []) : [];
  const conMod = mod(finalScores.con);
  const toughBonus = raceFeatFx?.hpPerLevel || 0; // level 1, so exactly one level's worth
  const hp = clsData.die + conMod + (race === "Hill Dwarf" ? 1 : 0);

  const steps = ["Identity", "Race", "Origins", "Class", "Abilities", "Spells", "Gear", "Confirm"];
  const bgData = BACKGROUNDS[bg] || null; // null = Custom
  const bgLangs = bgData ? bgData.langs : 2; // customized backgrounds take the two-language default
  const langNeed = (RACE_LANGS[race].choose || 0) + bgLangs;
  const wizCantrips = srcSpells(customs?.spells || []).filter((x) => x.level === 0 && spellFitsClass(x, "Wizard"));
  // Skills granted by one source shouldn't be selectable from another
  const raceSkillNeed = (raceData.skills || 0) + (race === "Custom Lineage" && lineageTrait === "skill" ? 1 : 0);
  const raceSkillsEff = raceSkills.slice(0, raceSkillNeed);
  const bgGrantSkills = bgData ? bgData.skills : bgSkills;
  const skillsElsewhere = [...bgGrantSkills, ...raceSkillsEff, ...featSkillsEff, ...(raceData.grantSkills || [])];
  let clsSkillOpts = clsData.skills.filter((s) => !skillsElsewhere.includes(s));
  if (clsSkillOpts.length < clsData.nSkills) // all overlapping — open up the remaining skills (PHB duplicate-proficiency rule)
    clsSkillOpts = [...clsSkillOpts, ...ALL_SKILLS.filter((s) => !skillsElsewhere.includes(s) && !clsData.skills.includes(s))];
  const racialCantrip = race === "High Elf" ? heCantrip.trim() : "";
  const castsAt1 = !!CLASSES[cls].caster && CLASSES[cls].caster !== "half";
  const canCap1 = CANTRIPS_KNOWN[cls] ? CANTRIPS_KNOWN[cls](1) : 0;
  const spellCap1 = castsAt1 ? spellCapacity(cls, 1, finalScores).n : 0;
  const pool1 = srcSpells(customs?.spells || []).filter((x) => spellFitsClass(x, cls, subclass));
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
    step === 1 ? (!raceData.lineageTrait || !!lineageTrait) : // ability picks may wait for the Abilities step
    step === 2 ? langPicks.length === langNeed && (bg !== "Custom" || bgSkills.length === 2) && (race !== "Dragonborn" || ancestry) && raceSkills.length === raceSkillNeed && (race !== "High Elf" || heCantrip.trim()) :
    step === 3 ? skills.length === clsData.nSkills && (clsData.subLvl > 1 || subclass) && (cls !== "Fighter" || style) && (cls !== "Rogue" || rogueExp.length === 2) && (cls !== "Ranger" || (favEnemy && (favEnemy !== "Two humanoid races" || favHumanoids.trim()) && favLang)) :
    step === 4 ? raceAbilPicks.length === (raceData.choose || 0) && (!raceData.feat || featPickDone(raceFeatDef, raceFeat)) :
    step === 6 ? (gearMode === "standard" ? standardReady : gearMode === "gold" ? gold !== null : false) :
    true;

  const finish = () => {
    const inventory = gearMode === "standard" ? standardItems() : purchases.map(({ name: nm, qty }) => ({ name: nm, qty }));
    onDone({
      id: uid(), name: name.trim(), photo, race, background: bg, alignment,
      gold: gearMode === "standard" ? (bgData ? bgData.gold : 10) : Math.max(0, goldLeft),
      inventory,
      styles: style ? [style] : [], notes: "", persona,
      metamagic: [], pactBoon: null, invocations: [],
      rangerChoices: cls === "Ranger" ? { favEnemy: favEnemy === "Two humanoid races" ? `Humanoids (${favHumanoids.trim()})` : favEnemy } : null,

      spells: castsAt1 && (spellPicks.cantrips.length || spellPicks.spells.length) ? { [cls]: spellPicks } : {},
      abilities: finalScores, method,
      classes: [{ name: cls, level: 1, subclass: clsData.subLvl === 1 ? subclass : null }],
      skills: [...skills, ...raceSkillsEff, ...bgGrantSkills, ...featSkillsEff, ...(raceData.grantSkills || [])].filter((v, i, a) => a.indexOf(v) === i),
      // Tough and friends are derived from the feat itself, never banked into maxHp
      feats: raceFeat?.name ? [raceFeat.name] : [],
      featChoices: raceFeat?.name ? { [raceFeat.name]: {
        bump: raceFeat.bump || null, skills: raceFeat.skills || [], choice: raceFeat.choice || null,
        expertise: raceFeat.expertise || [], langs: raceFeat.langs || [],
        cantrips: raceFeat.cantrips || [], spells: raceFeat.spells || [], maneuvers: raceFeat.maneuvers || [],
      } } : {},
      expertise: [...rogueExp, ...(raceFeat?.expertise || [])].filter((v, i, a) => a.indexOf(v) === i),
      languages: [...RACE_LANGS[race].fixed, ...langPicks, ...(cls === "Ranger" && favLang ? [favLang] : []), ...(raceFeat?.langs || []), ...(raceFeat?.name ? featPickOf(raceFeat.name)?.grantLangs || [] : [])].filter((v, i, a) => a.indexOf(v) === i),
      racialChoices: {
        ancestry: race === "Dragonborn" ? ancestry : null,
        cantrip: race === "High Elf" ? heCantrip.trim() : null,
        lineage: raceData.lineageTrait ? lineageTrait : null,
      },
      maxHp: hp, hpLog: [{ cls, gained: hp, how: "1st level (max)" }],
      log: [`Created as ${race} ${cls} 1${style ? ` · ${style}` : ""} · ${bg} · ${alignment}${raceFeat?.name ? ` · Feat: ${raceFeat.name}` : ""}${gearMode === "standard" ? " · standard gear" : ` · bought gear (${Math.max(0, goldLeft)} gp left)`}`],
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
          {Object.entries(RACES).filter(([, d]) => !d.group).map(([r, d]) => (
            <div key={r} onClick={() => {
              setRace(r); setRaceAbilPicks([]); setRaceSkills([]); setHeCantrip(""); setAncestry(null);
              setRaceFeat(null); setLineageTrait(null);
              setLangPicks(langPicks.filter((l) => !RACE_LANGS[r].fixed.includes(l)));
            }}
              style={{ ...card, padding: 14, cursor: "pointer", borderColor: race === r ? T.gold : T.edge, background: race === r ? T.panel2 : T.panel }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: race === r ? T.gold : T.ink }}>
                {r}{d.optional && <span style={{ color: T.dim, fontSize: 10.5, letterSpacing: 0.6 }}> · optional rule</span>}
              </div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>
                {[
                  ABILITIES.filter((a) => d.bonus[a]).map((a) => `${a.toUpperCase()} ${fmtMod(d.bonus[a])}`).join(", "),
                  d.choose ? `+${d.chooseAmt || 1} to ${d.choose === 1 ? "one ability" : `${d.choose} abilities`} of your choice` : "",
                  d.feat ? "a feat at 1st level" : "",
                ].filter(Boolean).join(", ")} · {d.speed} ft
              </div>
              <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>{d.traits.slice(0, 3).join(" · ")}</div>
            </div>
          ))}
          <div onClick={() => setShowExpanded(!showExpanded)}
            style={{ gridColumn: "1 / -1", ...card, padding: "12px 14px", cursor: "pointer", borderColor: raceData.group ? T.gold : T.edge }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: T.gold }}>{showExpanded ? "▾" : "▸"} Expanded Races</span>
            <span style={{ color: T.dim, fontSize: 12 }}> · Tabaxi, Aasimar, Goliath, Genasi, and the rest of the wider world ({Object.values(RACES).filter((d) => d.group).length})</span>
          </div>
          {showExpanded && Object.entries(RACES).filter(([, d]) => d.group).map(([r, d]) => (
            <div key={r} onClick={() => {
              setRace(r); setRaceAbilPicks([]); setRaceSkills([]); setHeCantrip(""); setAncestry(null);
              setRaceFeat(null); setLineageTrait(null);
              setLangPicks(langPicks.filter((l) => !RACE_LANGS[r].fixed.includes(l)));
            }}
              style={{ ...card, padding: 14, cursor: "pointer", borderColor: race === r ? T.gold : T.edge, background: race === r ? T.panel2 : T.panel }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: race === r ? T.gold : T.ink }}>{r}</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>
                {[
                  ABILITIES.filter((a) => d.bonus[a]).map((a) => `${a.toUpperCase()} ${fmtMod(d.bonus[a])}`).join(", "),
                  d.choose ? `+${d.chooseAmt || 1} to ${d.choose === 1 ? "one other ability" : `${d.choose} abilities`} of your choice` : "",
                ].filter(Boolean).join(", ")} · {d.speed} ft
              </div>
              <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>{d.traits.slice(0, 3).join(" · ")}</div>
            </div>
          ))}
          {raceData.choose > 0 && (
            <div style={{ gridColumn: "1 / -1", ...card, padding: 14 }}>
              <LineageBonusPicker raceData={raceData} picks={raceAbilPicks} setPicks={setRaceAbilPicks} />
              <div style={{ color: T.dim, fontSize: 11.5, marginTop: 8 }}>You can also assign (or change) these on the Abilities step, next to your actual scores.</div>
            </div>
          )}
          {raceData.lineageTrait && (
            <div style={{ gridColumn: "1 / -1", ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Your lineage's gift — choose one</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ ...btn(lineageTrait === "darkvision"), padding: "6px 12px" }} onClick={() => { setLineageTrait("darkvision"); setRaceSkills([]); }}>Darkvision 60 ft</button>
                <button style={{ ...btn(lineageTrait === "skill"), padding: "6px 12px" }} onClick={() => setLineageTrait("skill")}>One skill proficiency</button>
              </div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>
                {lineageTrait === "skill" ? "Pick the skill on the Origins step." : "You also choose your size — Small or Medium — with your DM; the sheet doesn't track it."}
              </div>
            </div>
          )}
          {raceData.feat && (
            <div style={{ gridColumn: "1 / -1", ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14 }}>A feat at 1st level</div>
              <div style={{ color: T.dim, fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
                {race} trades fixed racial traits for a feat straight out of the gate. You'll choose it on the
                <b style={{ color: T.ink }}> Abilities</b> step, once your scores are set — feats with an ability
                prerequisite need to know them first.
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>Background <span style={{ color: T.dim, fontSize: 11 }}>· long-press one to read its feature in full</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
              {[...Object.keys(BACKGROUNDS), "Custom"].map((b) => {
                const d = BACKGROUNDS[b];
                const pickBg = () => {
                  setBg(b); setBgSkills([]);
                  // skills this background grants can't also be picked elsewhere; language quota may shrink
                  const keep = (s) => !(d ? d.skills : []).includes(s);
                  setRaceSkills(raceSkills.filter(keep)); setSkills(skills.filter(keep)); setRogueExp(rogueExp.filter(keep));
                  setLangPicks(langPicks.slice(0, (RACE_LANGS[race].choose || 0) + (d ? d.langs : 2)));
                };
                return (
                  <div key={b} {...(d ? lorePress(b) : {})} onClick={pickBg}
                    style={{ ...card, padding: "10px 12px", cursor: "pointer", borderColor: bg === b ? T.gold : T.edge, background: bg === b ? T.panel2 : T.panel }}>
                    <div style={{ color: bg === b ? T.gold : T.ink, fontWeight: 700, fontSize: 14 }}>{b}</div>
                    <div style={{ color: T.dim, fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>
                      {d
                        ? <>{d.skills.join(" & ")}{d.langs ? ` · ${d.langs} language${d.langs > 1 ? "s" : ""}` : ""}{d.tools ? ` · ${d.tools}` : ""}<div style={{ color: "#b48ead" }}>{d.feature}</div></>
                        : <>Any two skills · 2 languages<div style={{ color: "#b48ead" }}>Your own story</div></>}
                    </div>
                  </div>
                );
              })}
            </div>
            {bgData && (
              <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.6 }}>
                <span style={{ color: T.ink }}>{bgData.flavor}</span> <span style={{ color: "#b48ead" }}>{bgData.feature}.</span> {bgData.featureText}
                {bgData.tools && <div style={{ marginTop: 4 }}>Tool proficiencies — {bgData.tools} — ride along as a note; the sheet doesn't track tools.</div>}
              </div>
            )}
            {bg === "Custom" && (
              <div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 6 }}>Per background customization rules: choose any two skills ({bgSkills.length}/2) and two languages (below).</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ALL_SKILLS.filter((sk) => !raceSkillsEff.includes(sk) && !featSkillsEff.includes(sk) && !skills.includes(sk)).map((sk) => (
                    <button key={sk} style={{ ...btn(bgSkills.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setBgSkills(bgSkills.includes(sk) ? bgSkills.filter((x) => x !== sk) : bgSkills.length < 2 ? [...bgSkills, sk] : bgSkills)}>{sk}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Languages</div>
            {langNeed > 0 ? (
              <>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>
                  {race} grants {RACE_LANGS[race].fixed.join(" & ")}. Choose {langNeed} more ({RACE_LANGS[race].choose || 0} racial + {bgLangs} from your background). ({langPicks.length}/{langNeed})
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LANGS.filter((l) => !RACE_LANGS[race].fixed.includes(l)).map((l) => (
                    <button key={l} {...lorePress(l)} style={{ ...btn(langPicks.includes(l)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setLangPicks(langPicks.includes(l) ? langPicks.filter((x) => x !== l) : langPicks.length < langNeed ? [...langPicks, l] : langPicks)}>{l}</button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: T.dim, fontSize: 12 }}>{race} grants {RACE_LANGS[race].fixed.join(" & ")}; {bg} adds no extra language choices.</div>
            )}
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
          {raceSkillNeed > 0 && (
            <div style={{ ...card, padding: 14 }}>
              <div style={{ color: T.gold, fontSize: 14, marginBottom: 8 }}>
                {race === "Half-Elf" ? "Skill Versatility" : `${race} skill`} — choose {raceSkillNeed === 1 ? "one" : "two"} ({raceSkills.length}/{raceSkillNeed})
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(raceData.skillsFrom || ALL_SKILLS).filter((sk) => !bgGrantSkills.includes(sk) && !featSkillsEff.includes(sk) && !skills.includes(sk) && !(raceData.grantSkills || []).includes(sk)).map((sk) => (
                  <button key={sk} style={{ ...btn(raceSkills.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                    onClick={() => setRaceSkills(raceSkills.includes(sk) ? raceSkills.filter((x) => x !== sk) : raceSkills.length < raceSkillNeed ? [...raceSkills, sk] : raceSkills)}>{sk}</button>
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
                  {wizCantrips.filter((x) => !spellPicks.cantrips.includes(x.name)).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
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
              {clsSkillOpts.map((s) => (
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
              <div style={{ marginTop: 10 }}>
                <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Favored Enemy — one type, or two humanoid races</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FAVORED_ENEMIES.map((f) => (
                    <button key={f} style={{ ...btn(favEnemy === f), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setFavEnemy(f)}>{f}</button>
                  ))}
                </div>
                {favEnemy === "Two humanoid races" && (
                  <input value={favHumanoids} onChange={(e) => setFavHumanoids(e.target.value)} placeholder="Which two? e.g. gnolls and orcs"
                    style={{ width: "100%", boxSizing: "border-box", marginTop: 8, background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 14 }} />
                )}
                <div style={{ color: T.gold, fontSize: 13, margin: "10px 0 6px" }}>Associated language — one your favored enemies speak</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LANGS.filter((l) => !RACE_LANGS[race].fixed.includes(l) && !langPicks.includes(l)).map((l) => (
                    <button key={l} {...lorePress(l)} style={{ ...btn(favLang === l), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setFavLang(l)}>{l}</button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {step === 4 && (
        <AbilityStep scores={scores} setScores={setScores} method={method} setMethod={setMethod}
          bonuses={Object.fromEntries(ABILITIES.map((a) => [a, (raceData.bonus[a] || 0) + (raceAbilPicks.includes(a) ? raceChooseAmt : 0)]))}
          featBonus={raceFeat?.bump ? { [raceFeat.bump]: finalScores[raceFeat.bump] - preFeatScores[raceFeat.bump] } : {}}
          featLabel={raceFeat?.name || "feat"}>
          {raceData.choose > 0 && (
            <div style={{ ...card, padding: 14, marginTop: 14 }}>
              <LineageBonusPicker raceData={raceData} picks={raceAbilPicks} setPicks={setRaceAbilPicks} scores={scores}
                extra={raceFeat?.bump ? { [raceFeat.bump]: finalScores[raceFeat.bump] - preFeatScores[raceFeat.bump] } : {}} />
            </div>
          )}
          {raceData.feat && (
            <div style={{ ...card, padding: 14, marginTop: 14 }}>
              <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Your 1st-level feat</div>
              <FeatChooser customs={customs} abilities={preFeatScores} level={1} caster={castsAt1 || CLASSES[cls].caster === "half"}
                skillsTaken={[...bgGrantSkills, ...raceSkillsEff, ...skills]} styles={style ? [style] : []}
                knownCantrips={[...(racialCantrip ? [racialCantrip] : []), ...spellPicks.cantrips]}
                knownLangs={[...RACE_LANGS[race].fixed, ...langPicks]}
                profSkills={[...skills, ...bgGrantSkills, ...raceSkillsEff]}
                value={raceFeat} onChange={setRaceFeat} allowEpic={false} waiveLevel />
              {raceFeat?.name && !featPickDone(raceFeatDef, raceFeat) && (
                <div style={{ color: T.blood, fontSize: 12, marginTop: 8 }}>{raceFeat.name} still needs its own choices made above.</div>
              )}
            </div>
          )}
        </AbilityStep>
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
                {cls === "Cleric" || cls === "Druid" || cls === "Ranger"
                  ? `${cls}s know their whole list — choose what you'll have prepared on day one.`
                  : cls === "Wizard" ? "Choose your six starting spellbook spells and your cantrips."
                  : "Choose your cantrips and known spells."}
                {pool1.length === 0 && " (No spell list loaded — import a compendium XML in the Forge, or add spells later in the Grimoire.)"}
              </div>
              {canCap1 > 0 && (
                <div>
                  <div style={{ color: T.gold, fontSize: 14, marginBottom: 6 }}>Cantrips ({spellPicks.cantrips.length}/{canCap1})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 180, overflowY: "auto" }}>
                    {pool1.filter((x) => x.level === 0 && x.name !== racialCantrip && !(raceFeat?.cantrips || []).includes(x.name) && !(raceFeat?.name ? featGrantedSpells(raceFeat.name, 1) : []).includes(x.name)).sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
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
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>The classic {cls} loadout — make your either/or picks below. Comes with your background's purse of {bgData ? bgData.gold : 10} gp.</div>
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
              Gold: {gearMode === "standard" ? (bgData ? bgData.gold : 10) : Math.max(0, goldLeft)} gp
            </div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>
              {(() => {
                const rows = gearMode === "standard" ? standardItems() : purchases;
                return rows.length ? "Gear: " + rows.map((r) => (r.qty > 1 ? `${r.name} ×${r.qty}` : r.name)).join(" · ") : "Traveling light — no gear yet.";
              })()}
            </div>
          </div>
          {raceFeat?.name && (
            <div style={{ marginTop: 14, color: T.dim, fontSize: 13 }}>
              Feat: <span {...lorePress(raceFeat.name)} style={{ color: T.gold, cursor: "pointer" }}>{raceFeat.name}</span>
              {raceFeat.bump ? ` (+1 ${raceFeat.bump.toUpperCase()}${raceFeatFx?.saveFromBump ? `, ${raceFeat.bump.toUpperCase()} save proficiency` : ""})` : ""}
              {raceFeat.skills?.length ? ` · ${raceFeat.skills.join(", ")}` : ""}
            </div>
          )}
          <div style={{ marginTop: 14, color: T.ink }}>
            HP <b style={{ color: T.gold }}>{hp + toughBonus}</b> (max d{clsData.die} + CON{race === "Hill Dwarf" ? " + Dwarven Toughness" : ""}{toughBonus ? " + Tough" : ""})
            {" · "}Speed {raceData.speed + (raceFeatFx?.speed || 0)} ft · Prof +2
            {raceFeatFx?.init ? ` · Initiative +${(raceFeatDef?.text || "").match(/\+\s*(\d+)\s*bonus to initiative/i)?.[1] || 2} (${raceFeat.name})` : ""}
          </div>
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

/* ============ FEAT PICKER ============
   One picker serves both places a feat is ever taken: the forge (a lineage that grants
   one at 1st level) and the ASI at level-up. It carries the feat's own choices with it —
   the +1 it hands out, and any proficiencies it forces — so nothing is silently dropped.
   value: { name, bump, skills: [] } | null */
function FeatChooser({ customs, abilities, level, caster, held = [], styles = [], skillsTaken = [], knownCantrips = [], knownLangs = [], profSkills = [], value, onChange, allowEpic = true, waiveLevel = false, note }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const pool = allFeats(customs)
    .filter((f) => !held.includes(f.name))
    .filter((f) => !(f.fx?.style && styles.includes(f.fx.style))) // the style is already yours
    .filter((f) => allowEpic || f.cat !== "Epic Boon");
  const cats = ["All", ...FEAT_CATS.filter((c) => pool.some((f) => f.cat === c))];
  const needle = q.trim().toLowerCase();
  const shown = pool.filter((f) =>
    (cat === "All" || f.cat === cat) &&
    (!needle || f.name.toLowerCase().includes(needle) || (f.desc || "").toLowerCase().includes(needle)));
  // a lineage feat at 1st level waives the level gate the general feats otherwise carry
  const ctx = { abilities, level: waiveLevel ? Infinity : level, caster };

  const set = (patch) => onChange({ ...(value || {}), ...patch });
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {cats.map((c) => (
          <button key={c} style={{ ...btn(cat === c), padding: "4px 10px", fontSize: 12, minHeight: 0 }} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the feats…"
        style={{ width: "100%", boxSizing: "border-box", background: T.panel, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 14, marginBottom: 8 }} />
      {note && <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 8, lineHeight: 1.5 }}>{note}</div>}
      <div style={{ display: "grid", gap: 6, maxHeight: 360, overflowY: "auto" }}>
        {shown.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>No feat matches.</div>}
        {shown.map((f) => {
          const blocked = featBlockedBy(f, ctx);
          const on = value?.name === f.name;
          const cap = f.cat === "Epic Boon" ? 30 : 20;
          const skillPool = (f.pick?.skills?.from || ALL_SKILLS).filter((s) => !skillsTaken.includes(s));
          return (
            <div key={f.name} {...lorePress(f.name)}
              onClick={() => !blocked && onChange(on ? null : { name: f.name, bump: null, skills: [], expertise: [], langs: [], choice: null, cantrips: [], spells: [], maneuvers: [] })}
              style={{ ...card, background: on ? T.panel : T.panel2, borderColor: on ? T.gold : T.edge, padding: "8px 12px", cursor: blocked ? "default" : "pointer", opacity: blocked ? 0.45 : 1 }}>
              <span style={{ color: on ? T.gold : T.ink, fontWeight: 700 }}>{f.name}</span>
              {f.cat && <span style={{ color: T.dim, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase" }}> · {f.cat}</span>}
              <span style={{ color: T.dim, fontSize: 12 }}> — {f.desc}</span>
              {(() => {
                // a waived level gate shouldn't still be printed as a prerequisite
                const req = waiveLevel ? f.prereq?.replace(/^Level \d+\+(,\s*)?/, "") : f.prereq;
                return req ? <div style={{ color: blocked ? T.blood : T.dim, fontSize: 11, marginTop: 2 }}>Prerequisite: {req}{blocked ? ` — ${blocked}` : ""}</div> : null;
              })()}
              {on && f.bump?.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ color: T.gold, fontSize: 12 }}>+1 to{FEAT_MECHANICS[f.name]?.saveFromBump ? " (and save proficiency in)" : ""}:</span>
                  {f.bump.map((a) => (
                    <button key={a} disabled={(abilities[a] ?? 0) >= cap}
                      style={{ ...btn(value.bump === a), padding: "4px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={(e) => { e.stopPropagation(); set({ bump: a }); }}>
                      {a.toUpperCase()} {abilities[a]}{value.bump === a ? ` → ${Math.min(cap, abilities[a] + 1)}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {on && f.pick && <FeatPickPanel pick={f.pick} value={value} set={set} customs={customs} level={level}
                skillsTaken={skillsTaken} knownCantrips={knownCantrips} knownLangs={knownLangs} profSkills={profSkills} skillPool={skillPool} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* The sub-choices a selected feat forces, rendered inside its card. Chip rows for the
   small pools (skills, languages, maneuvers, the one named choice), searchable spell
   grids for the big ones, and a read-only line for fixed spell grants. */
function FeatPickPanel({ pick: pk, value, set, customs, level = 20, skillsTaken, knownCantrips, knownLangs, profSkills, skillPool }) {
  const chipRow = (label, opts, key, cap, renderName = (x) => x, pressable = false) => (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: T.gold, fontSize: 12, marginBottom: 4 }}>{label} ({(value[key] || []).length}/{cap})</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {opts.map((s) => {
          const picked = (value[key] || []).includes(s);
          return (
            <button key={s} {...(pressable ? lorePress(s) : {})} style={{ ...btn(picked), padding: "4px 9px", fontSize: 12, minHeight: 0 }}
              onClick={() => set({ [key]: picked ? value[key].filter((x) => x !== s) : (value[key] || []).length < cap ? [...(value[key] || []), s] : value[key] })}>
              {renderName(s)}
            </button>
          );
        })}
      </div>
    </div>
  );
  const spellPool = srcSpells(customs?.spells || []);
  const spCls = pk.spells?.class === "$choice" ? value.choice : pk.spells?.class;
  const spellsReady = !pk.spells || pk.spells.class !== "$choice" || !!value.choice;
  const fitsFeat = (sp) =>
    (!spCls || spellFitsClass(sp, spCls)) &&
    (!pk.spells?.schools || pk.spells.schools.includes((sp.school || "").toUpperCase())) &&
    (!pk.spells?.ritual || (sp.ritual && !/\(Ritual Only\)$/i.test(sp.name)));
  const grants = featGrantedSpells(value.name, level, null);
  const laterGrants = featGrantedSpells(value.name, 20, null).filter((n) => !grants.includes(n));
  const expPool = pk.allSkills ? ALL_SKILLS : [...new Set([...profSkills, ...(value.skills || [])])];
  return (
    <div onClick={(e) => e.stopPropagation()}>
      {pk.choice && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: T.gold, fontSize: 12, marginBottom: 4 }}>{pk.choice.label}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {pk.choice.options.map((o) => (
              <button key={o} style={{ ...btn(value.choice === o), padding: "4px 9px", fontSize: 12, minHeight: 0 }}
                onClick={() => set({ choice: o, cantrips: [], spells: [] })}>{o}</button>
            ))}
          </div>
        </div>
      )}
      {pk.skills?.n > 0 && chipRow("Skill proficiencies", skillPool, "skills", pk.skills.n)}
      {pk.allSkills && <div style={{ color: T.green, fontSize: 12, marginTop: 8 }}>Grants proficiency in every skill — the sheet marks them all.</div>}
      {pk.expertise?.n > 0 && chipRow("Expertise (double proficiency)", expPool, "expertise", pk.expertise.n)}
      {pk.langs?.n > 0 && chipRow("Languages", LANGS.filter((l) => !knownLangs.includes(l) && !(value.langs || []).includes(l)).concat(value.langs || []).sort(), "langs", pk.langs.n, undefined, true)}
      {pk.maneuvers?.n > 0 && chipRow("Battle Master maneuvers · long-press to read", Object.keys(MANEUVERS), "maneuvers", pk.maneuvers.n, undefined, true)}
      {grants.length > 0 && (
        <div style={{ color: T.green, fontSize: 12, marginTop: 8 }}>
          Grants: {grants.map((n, i) => <span key={n} {...lorePress(n)}>{i > 0 ? ", " : ""}{n}</span>)} — they appear in your Grimoire.
          {laterGrants.length > 0 && <span style={{ color: T.dim }}> At higher levels: {laterGrants.join(", ")}.</span>}
        </div>
      )}
      {pk.spells?.cantrips > 0 && spellsReady && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: T.gold, fontSize: 12, marginBottom: 4 }}>{spCls} cantrips ({(value.cantrips || []).length}/{pk.spells.cantrips})</div>
          <SpellPickGrid cap={pk.spells.cantrips} picks={value.cantrips || []} onChange={(arr) => set({ cantrips: arr })}
            options={spellPool.filter((sp) => sp.level === 0 && fitsFeat(sp) && !knownCantrips.includes(sp.name))} />
        </div>
      )}
      {pk.spells?.level1 > 0 && spellsReady && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: T.gold, fontSize: 12, marginBottom: 4 }}>
            {pk.spells.ritual ? `1st-level rituals${spCls ? ` (${spCls} list)` : ""}` : `1st-level spell${pk.spells.level1 > 1 ? "s" : ""}${spCls ? ` (${spCls} list)` : pk.spells.schools ? ` (${pk.spells.schools.map(schoolName).join(" or ")})` : ""}`}
            {" "}({(value.spells || []).length}/{pk.spells.level1})
          </div>
          <SpellPickGrid cap={pk.spells.level1} picks={value.spells || []} onChange={(arr) => set({ spells: arr })}
            options={spellPool.filter((sp) => sp.level === 1 && fitsFeat(sp))} />
        </div>
      )}
      {pk.spells && !spellsReady && <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Choose the spell list above to open the spell pickers.</div>}
      {pk.note && <div style={{ color: T.dim, fontSize: 11.5, marginTop: 8 }}>{pk.note}</div>}
    </div>
  );
}

/* ============ LEVEL UP (with full multiclassing) ============ */
function LevelUp({ ch, onDone, onCancel, customs }) {
  const lvl = totalLevel(ch);
  const [stage, setStage] = useState("class"); // class -> hp -> extras -> done
  // the overlay scrolls its own container — snap it back to the top on each stage
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [stage]);
  const [pick, setPick] = useState(() => [...ch.classes].sort((a, b) => b.level - a.level)[0]?.name || null);
  const [rollingHp, setRollingHp] = useState(false);
  const [hpGain, setHpGain] = useState(null);
  const [asiMode, setAsiMode] = useState(null); // 'asi' | 'feat'
  const [asiPicks, setAsiPicks] = useState([]);
  const [featSel, setFeatSel] = useState(null); // { name, bump, skills, expertise, langs, choice, cantrips, spells, maneuvers }
  const featPick = featSel?.name || null;
  const featBump = featSel?.bump || null;
  const featSkills = featSel?.skills || [];
  const featPk = featPick ? featPickOf(featPick) : null;
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
  const [feHumanoids, setFeHumanoids] = useState(""); // the two named races, when that mode is chosen
  const [favLang2, setFavLang2] = useState(null); // the associated language
  const [terrainPick2, setTerrainPick2] = useState(null);
  const [deftExp, setDeftExp] = useState(null); // Deft Explorer: one expertise skill
  const [deftLangs, setDeftLangs] = useState([]); // Deft Explorer: two languages
  const [glamourPick, setGlamourPick] = useState(null); // Fey Wanderer: Otherworldly Glamour skill
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
  const isCaster = ch.classes.some((c) => !!CLASSES[c.name].caster) || !!pickData?.caster;
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
    const featDef = asiMode === "feat" ? allFeats(customs).find((f) => f.name === featPick) : null;
    if (asiMode === "feat") {
      const detail = [
        featBump ? `+1 ${featBump.toUpperCase()}` : null,
        featSel.choice,
        ...featSkills, ...(featSel.expertise || []).map((x) => `${x} expertise`), ...(featSel.langs || []),
        ...(featSel.cantrips || []), ...(featSel.spells || []), ...(featSel.maneuvers || []),
      ].filter(Boolean);
      logBits.push(`Feat: ${featPick}${detail.length ? ` (${detail.join(", ")})` : ""}`);
      if (featBump) abilities[featBump] = Math.min(featDef?.cat === "Epic Boon" ? 30 : 20, abilities[featBump] + 1);
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
    const feLabel = favEnemyPick === "Two humanoid races" ? `Humanoids (${feHumanoids.trim()})` : favEnemyPick;
    const rangerChoices = pick === "Ranger" && (favEnemyPick || terrainPick2)
      ? { ...rc, extraEnemies: [...(rc.extraEnemies || []), ...(feLabel ? [feLabel] : [])], extraTerrains: [...(rc.extraTerrains || []), ...(terrainPick2 ? [terrainPick2] : [])] }
      : ch.rangerChoices;
    if (favEnemyPick) logBits.push(`Favored Enemy: ${feLabel}${favLang2 ? ` (${favLang2})` : ""}`);
    if (terrainPick2) logBits.push(`Natural Explorer: ${terrainPick2}`);
    if (gainsDeft && deftExp) logBits.push(`Deft Explorer: ${deftExp} expertise${deftLangs.length ? `, ${deftLangs.join(", ")}` : ""}`);
    if (gainsGlamour && glamourPick) logBits.push(`Otherworldly Glamour: ${glamourPick}`);
    let choices = ch.choices;
    if (gainsMastery && (masteryPicks[1] || masteryPicks[2])) { choices = { ...choices, "Spell Mastery": [masteryPicks[1], masteryPicks[2]].filter(Boolean) }; logBits.push(`Spell Mastery: ${choices["Spell Mastery"].join(", ")}`); }
    if (gainsSignature && signaturePicks.length) { choices = { ...choices, "Signature Spell": signaturePicks }; logBits.push(`Signature Spells: ${signaturePicks.join(", ")}`); }
    for (const d of choiceGroupsDue) {
      const picksArr = groupPicks[d.g.key] || [];
      const grants = Object.entries(d.g.grant || {}).flatMap(([l, arr]) => (newClsLevel >= +l ? arr : [])).filter((n) => !d.held.includes(n) && !picksArr.includes(n));
      choices = { ...choices, [d.g.key]: [...d.held, ...grants, ...picksArr] };
      if (picksArr.length) logBits.push(`${d.g.key}: ${picksArr.join(", ")}`);
    }
    const grantAll = asiMode === "feat" && featPk?.allSkills ? ALL_SKILLS : [];
    const skills = [...ch.skills, ...(mcSkill ? [mcSkill] : []), ...featSkills, ...grantAll, ...(glamourPick ? [glamourPick] : [])].filter((v, i, a) => a.indexOf(v) === i);
    const languages = [...(ch.languages || []), ...(asiMode === "feat" ? [...(featSel?.langs || []), ...(featPk?.grantLangs || [])] : []), ...deftLangs, ...(favLang2 ? [favLang2] : [])].filter((v, i, a) => a.indexOf(v) === i);
    const expertise = [...(ch.expertise || []), ...expPicks, ...(asiMode === "feat" ? featSel?.expertise || [] : []), ...(deftExp ? [deftExp] : [])].filter((v, i, a) => a.indexOf(v) === i);
    const featChoices = asiMode === "feat" && featPick
      ? { ...(ch.featChoices || {}), [featPick]: {
          bump: featBump || null, skills: featSkills, choice: featSel.choice || null,
          expertise: featSel.expertise || [], langs: featSel.langs || [],
          cantrips: featSel.cantrips || [], spells: featSel.spells || [], maneuvers: featSel.maneuvers || [],
        } }
      : ch.featChoices;
    onDone({
      ...ch, classes, abilities, skills, languages, expertise, invocations, spells: spellsBook, featChoices,
      boasRituals, tomeCantrips, rangerChoices, choices,
      maxHp: ch.maxHp + hpGain + conM + dwarfBonus,
      hpLog: [...ch.hpLog, { cls: pick, gained: hpGain + conM + dwarfBonus, how: hpGain === avg ? "average" : `rolled ${hpGain}` }],
      log: [...ch.log, `Level ${lvl + 1}: ${logBits.join(" · ")}`],
      feats: asiMode === "feat" ? [...(ch.feats || []), featPick] : ch.feats,
      styles: stylePick ? [...(ch.styles || []), stylePick] : ch.styles,
      metamagic: metaPicks.length ? [...(ch.metamagic || []), ...metaPicks] : ch.metamagic,
      pactBoon: boonPick || ch.pactBoon,
    });
  };

  const styleClass = pick === "Fighter" || (entry?.subclass === "Champion" && newClsLevel === 10) ? "Fighter" : pick;
  const gainsStyle = feats.some((f) => /Fighting Style/.test(f)) && FIGHTING_STYLES[styleClass];
  const styleOptions = gainsStyle ? FIGHTING_STYLES[styleClass].filter((f) => !hasStyle(ch, f)) : [];
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
  const pool = srcSpells(customs?.spells || []);
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
  const knownCans = allKnownCantrips(ch);
  const cantripPool = pick ? pool.filter((sp) => sp.level === 0 && fits(sp) && !knownCans.includes(sp.name) && !tomePicks.includes(sp.name)).sort(sortSp) : [];
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

  // Pact of the Tome — three cantrips from any class's list (excluding any already known)
  const tomePool = boonPick === "Pact of the Tome"
    ? pool.filter((sp) => sp.level === 0 && !knownCans.includes(sp.name) && !cantripPicks.includes(sp.name)).sort(sortSp) : [];
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
  const gainsNatTerrain = false; // Natural Explorer stays retired
  const gainsDeft = pick === "Ranger" && newClsLevel === 2;
  const gainsGlamour = pick === "Ranger" && newClsLevel === 3 && baseSubName(newSub || entry?.subclass || "") === "Fey Wanderer";

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

  const preparedCaster = ["Cleric", "Druid", "Paladin", "Ranger"].includes(pick);

  const extrasNeeded = gainsASI || gainsSub || gainsMcSkill || gainsStyle || gainsExpertise || gainsMeta || gainsBoon ||
    invNeed > 0 || canSwapInv || gainsCantrips || gainsSpells || canSwapSpell || gainsArcanum ||
    gainsBoAS || gainsTome || gainsSecrets || gainsDeft || gainsGlamour || gainsFavEnemy || gainsMastery || gainsSignature ||
    choiceGroupsDue.length > 0;
  const extrasDone =
    (!gainsASI || (asiMode === "feat" && featPickDone(allFeats(customs).find((f) => f.name === featPick), featSel)) || (asiMode === "asi" && asiPicks.length === 2)) &&
    (!gainsSub || newSub) && (!gainsMcSkill || mcSkill) && (!gainsStyle || stylePick) && (!gainsTerrain || terrPick) &&
    (!gainsExpertise || expPicks.length === Math.min(2, expPool.length)) && (!gainsMeta || metaPicks.length === metaNeed) && (!gainsBoon || boonPick) &&
    invPicks.length >= invNeed && !!invSwapOut === !!invSwapIn &&
    cantripPicks.length >= cantripReq && spellPicks.length >= spellReqNet && !!spellSwapOut === !!spellSwapIn &&
    (!gainsArcanum || arcanumPick) &&
    (!gainsBoAS || boasPicks.length >= Math.min(2, boasPool.length + boasPicks.length)) &&
    (!gainsTome || tomePicks.length >= Math.min(3, tomePool.length)) &&
    secretsPicks.length >= secretsReq &&
    (!gainsDeft || (deftExp && deftLangs.length === 2)) && (!gainsGlamour || glamourPick) &&
    (!gainsFavEnemy || (favEnemyPick && (favEnemyPick !== "Two humanoid races" || feHumanoids.trim()) && favLang2)) &&
    (!gainsMastery || ((masteryPools[1].length === 0 || masteryPicks[1]) && (masteryPools[2].length === 0 || masteryPicks[2]))) &&
    (!gainsSignature || signaturePicks.length >= Math.min(2, signaturePool.length)) &&
    choiceGroupsDue.every((d) => (groupPicks[d.g.key] || []).length >= d.need);

  return (
    <div ref={scrollRef} style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 50, overflowY: "auto", padding: "calc(30px + env(safe-area-inset-top)) 14px calc(30px + env(safe-area-inset-bottom))" }}>
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
                Take average — {avg + conM + dwarfBonus} HP{conM + dwarfBonus !== 0 ? ` (${avg} ${fmtMod(conM + dwarfBonus)})` : ""}
              </button>
              <button style={btn(true)} onClick={() => setRollingHp(true)}><Icon name="d20" /> Roll the d{pickData.die}</button>
            </div>
            {rollingHp && (
              <DiceTray title={`Rolling 1d${pickData.die} for hit points`} dice={[{ sides: pickData.die, value: roll(pickData.die) }]}
                bonus={conM + dwarfBonus} bonusLabel={dwarfBonus ? "CON, Hill Dwarf" : "CON"}
                note="No rerolls. The bones do not negotiate." acceptLabel="Accept fate"
                onAccept={(total, values) => { setHpGain(values[0]); setRollingHp(false); setStage(extrasNeeded ? "extras" : "confirm"); }} />
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
                  <button style={{ ...btn(asiMode === "asi"), padding: "6px 12px" }} onClick={() => { setAsiMode("asi"); setFeatSel(null); }}>+1 to two abilities</button>
                  <button style={{ ...btn(asiMode === "feat"), padding: "6px 12px" }} onClick={() => { setAsiMode("feat"); setAsiPicks([]); }}>Take a feat</button>
                </div>
                {asiMode === "feat" && (
                  <FeatChooser customs={customs} abilities={ch.abilities} level={lvl + 1} caster={isCaster}
                    held={ch.feats || []} styles={ch.styles || []} skillsTaken={[...ch.skills, ...(mcSkill ? [mcSkill] : [])]}
                    knownCantrips={allKnownCantrips(ch)} knownLangs={ch.languages || []} profSkills={ch.skills}
                    value={featSel} onChange={setFeatSel} />
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
                <div style={{ color: T.gold, marginBottom: 8 }}>Additional Favored Enemy — one type, or two humanoid races</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FAVORED_ENEMIES.filter((e) => !enemiesTaken.includes(e)).map((e) => (
                    <button key={e} style={{ ...btn(favEnemyPick === e), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setFavEnemyPick(e)}>{e}</button>
                  ))}
                </div>
                {favEnemyPick === "Two humanoid races" && (
                  <input value={feHumanoids} onChange={(e) => setFeHumanoids(e.target.value)} placeholder="Which two? e.g. gnolls and orcs"
                    style={{ width: "100%", boxSizing: "border-box", marginTop: 8, background: T.panel, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 14 }} />
                )}
                <div style={{ color: T.gold, fontSize: 13, margin: "10px 0 6px" }}>Associated language</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LANGS.filter((l) => !(ch.languages || []).includes(l)).map((l) => (
                    <button key={l} {...lorePress(l)} style={{ ...btn(favLang2 === l), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setFavLang2(l)}>{l}</button>
                  ))}
                </div>
              </div>
            )}
            {gainsGlamour && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Otherworldly Glamour — one skill proficiency</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Deception", "Performance", "Persuasion"].filter((sk) => !ch.skills.includes(sk)).map((sk) => (
                    <button key={sk} style={{ ...btn(glamourPick === sk), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setGlamourPick(sk)}>{sk}</button>
                  ))}
                </div>
              </div>
            )}
            {gainsDeft && (
              <div style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                <div style={{ color: T.gold, marginBottom: 8 }}>Deft Explorer — expertise in one skill, and two languages</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {ch.skills.filter((sk) => !(ch.expertise || []).includes(sk)).map((sk) => (
                    <button key={sk} style={{ ...btn(deftExp === sk), padding: "5px 10px", fontSize: 13, minHeight: 0 }} onClick={() => setDeftExp(sk)}>{sk}</button>
                  ))}
                </div>
                <div style={{ color: T.gold, fontSize: 13, marginBottom: 6 }}>Languages ({deftLangs.length}/2)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LANGS.filter((l) => !(ch.languages || []).includes(l)).map((l) => (
                    <button key={l} {...lorePress(l)} style={{ ...btn(deftLangs.includes(l)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                      onClick={() => setDeftLangs(deftLangs.includes(l) ? deftLangs.filter((x) => x !== l) : deftLangs.length < 2 ? [...deftLangs, l] : deftLangs)}>{l}</button>
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
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* readOnly (shared sheets): the pack and purse read as a manifest — nothing can
   be bought, sold, drunk, equipped, or discarded */
function InventoryCard({ ch, customs, onUpdate, onConsume, readOnly }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [usableOnly, setUsableOnly] = useState(true);
  const [freeText, setFreeText] = useState("");
  const [coin, setCoin] = useState("10");
  const inv = ch.inventory || [];
  const pool = customs?.items || [];
  const save = (rows) => onUpdate({ inventory: rows });
  /* ---- the coin purse: money is checked before it is spent, and the ledger remembers ---- */
  const gold = round2(Math.max(0, ch.gold ?? 0));
  const priceOf = (it) => parseFloat(it?.value) || 0;
  const coinAmt = Math.max(0, parseFloat(coin) || 0);
  const buy = (it) => {
    const price = priceOf(it);
    if (price > gold) return; // the shopkeeper's arms stay crossed
    const has = inv.find((r) => r.name === it.name);
    onUpdate({
      inventory: has ? inv.map((r) => (r.name === it.name ? { ...r, qty: (r.qty || 1) + 1 } : r)) : [...inv, { name: it.name, qty: 1 }],
      gold: round2(gold - price),
      log: [...(ch.log || []), `Bought ${it.name} for ${price} gp.`],
    });
  };
  const sell = (row, it) => {
    const half = round2(priceOf(it) / 2);
    onUpdate({
      inventory: inv.flatMap((r) => (r.name === row.name ? ((r.qty || 1) > 1 ? [{ ...r, qty: (r.qty || 1) - 1 }] : []) : [r])),
      gold: round2(gold + half),
      log: [...(ch.log || []), `Sold ${row.name} for ${half} gp.`],
    });
  };
  const adjustGold = (delta, line) => onUpdate({ gold: round2(Math.max(0, gold + delta)), log: [...(ch.log || []), line] });
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ color: T.gold, fontSize: 13, fontWeight: 700 }}>Purse</span>
        <span data-purse style={{ fontFamily: "Georgia, serif", fontSize: 17, color: T.gold }}>{gold} gp</span>
        {!readOnly && <><input type="number" min={0} value={coin} onChange={(e) => setCoin(e.target.value)} title="Amount of gold"
          style={{ width: 66, textAlign: "center", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "5px 4px", fontSize: 14 }} />
        <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, borderColor: T.blood, color: "#d76a76", opacity: !coinAmt || coinAmt > gold ? 0.4 : 1 }}
          disabled={!coinAmt || coinAmt > gold} title={coinAmt > gold ? "Not enough gold in the purse" : "Pay for lodging, bribes, diamonds for Revivify…"}
          onClick={() => adjustGold(-coinAmt, `Spent ${coinAmt} gp.`)}>− Spend</button>
        <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, borderColor: T.green, color: T.green, opacity: !coinAmt ? 0.4 : 1 }}
          disabled={!coinAmt} title="Loot, rewards, ill-gotten gains" onClick={() => adjustGold(coinAmt, `Gained ${coinAmt} gp.`)}>+ Gain</button>
        {coinAmt > gold && <span style={{ color: "#d76a76", fontSize: 11 }}>the purse holds only {gold} gp</span>}</>}
      </div>
      {inv.length === 0 && <div style={{ color: T.dim, fontSize: 13, margin: "8px 0" }}>{readOnly ? "The pack is empty." : "Empty packs win no battles. Add gear below — equip armor, shields, and weapons to power your AC and attack buttons."}</div>}
      {inv.map((row) => {
        const it = findItem(row.name, customs);
        const equippable = it && (isArmorType(it.type) || it.type === "S" || isWeaponType(it.type));
        return (
          <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.edge}`, flexWrap: "wrap" }}>
            <span {...lorePress(row.name)} style={{ color: row.equipped ? T.gold : T.ink, fontWeight: row.equipped ? 700 : 400, flex: 1, minWidth: 120 }}>
              {row.name}
              <span style={{ color: T.dim, fontWeight: 400, fontSize: 11 }}> {it ? `· ${ITEM_TYPES[it.type] || it.type}${it.ac ? ` · AC ${it.type === "S" ? "+" : ""}${it.ac}` : ""}${it.dmg1 ? ` · ${it.dmg1}` : ""}${it.weight ? ` · ${it.weight} lb` : ""}` : ""}</span>
            </span>
            {readOnly ? (
              <>
                <span style={{ color: T.dim, fontSize: 13 }}>× {row.qty || 1}</span>
                {row.equipped && <span style={{ color: T.gold, fontSize: 12 }}>✓ equipped</span>}
              </>
            ) : (
              <>
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
                {onConsume && isConsumableRow(row, it) && (
                  <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, borderColor: "#5eb1bf", color: "#5eb1bf" }} title="Spend one and apply what it does" onClick={() => onConsume(row)}>
                    {/potion|elixir|philter/i.test(row.name) ? "Drink" : "Use"}
                  </button>
                )}
                {it && priceOf(it) > 0 && (
                  <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} title={`Sell one for half value (${round2(priceOf(it) / 2)} gp)`} onClick={() => sell(row, it)}>
                    Sell {round2(priceOf(it) / 2)}g
                  </button>
                )}
                <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700, padding: "0 4px" }} onClick={() => save(inv.filter((r) => r.name !== row.name))}>✕</span>
              </>
            )}
          </div>
        );
      })}
      {!readOnly && <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pool.length > 0 && <button style={{ ...btn(true), padding: "6px 14px" }} onClick={() => { setOpen(true); setQ(""); }}>＋ Add from compendium</button>}
        <input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="or type any item + Enter"
          onKeyDown={(e) => { if (e.key === "Enter" && freeText.trim() && !inv.some((r) => r.name === freeText.trim())) { save([...inv, { name: freeText.trim(), qty: 1 }]); setFreeText(""); } }}
          style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, flex: 1, minWidth: 160 }} />
      </div>}
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setOpen(false)}>
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "75vh", display: "flex", flexDirection: "column", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ color: T.gold, fontFamily: "Georgia, serif" }}>Add gear <span style={{ color: T.dim, fontSize: 12 }}>· tap to add as loot (free) · Buy pays from the purse ({gold} gp)</span></div>
              <button style={{ ...btn(usableOnly), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => setUsableOnly(!usableOnly)}>
                {usableOnly ? `✓ Usable by ${ch.name}` : "Showing everything"}
              </button>
            </div>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…"
              style={{ background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 }} />
            <LazyList items={shown} resetKey={`${q}|${usableOnly}`}
              empty={<div style={{ color: T.dim, fontSize: 13, padding: 8 }}>Nothing matches.</div>}
              render={(it) => {
                const price = priceOf(it);
                const broke = price > gold;
                return (
                  <div key={it.name} {...lorePress(it.name)} onClick={() => {
                    const has = inv.find((r) => r.name === it.name);
                    save(has ? inv.map((r) => (r.name === it.name ? { ...r, qty: (r.qty || 1) + 1 } : r)) : [...inv, { name: it.name, qty: 1 }]);
                    setOpen(false);
                  }} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.edge}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1 }}>
                      <span style={{ color: T.ink }}>{it.name}</span>
                      <span style={{ color: T.dim, fontSize: 12 }}> · {ITEM_TYPES[it.type] || it.type}{it.ac ? ` · AC ${it.type === "S" ? "+" : ""}${it.ac}` : ""}{it.dmg1 ? ` · ${it.dmg1} ${DMG_TYPES[it.dmgType] || ""}` : ""}{it.value ? ` · ${it.value} gp` : ""}{sourceOf(it.text) ? ` · ${sourceOf(it.text)}` : ""}</span>
                    </span>
                    {price > 0 && (
                      <button disabled={broke} title={broke ? `You have ${gold} gp — the shopkeeper's arms stay crossed` : `Pay ${price} gp from the purse`}
                        style={{ ...btn(false), padding: "2px 10px", fontSize: 12, minHeight: 0, whiteSpace: "nowrap", ...(broke ? { borderColor: T.blood, color: T.blood, opacity: 0.55, cursor: "default" } : {}) }}
                        onClick={(e) => { e.stopPropagation(); buy(it); }}>
                        {broke ? "can't afford" : `Buy ${price} gp`}
                      </button>
                    )}
                  </div>
                );
              }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ INVOCATIONS (sheet management) ============ */
/* readOnly (shared sheets): invocations list without learn/unlearn */
function InvocationManager({ ch, onInvocations, readOnly }) {
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
            {n}{!readOnly && <span style={{ color: T.blood, cursor: "pointer", fontWeight: 700 }} onClick={() => onInvocations(mine.filter((x) => x !== n))}>✕</span>}
          </span>
        ))}
        {!readOnly && mine.length < cap && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => setOpen(true)}>＋ add</button>}
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

/* Classes that know their whole list and prepare a subset — preparations change freely after a long rest */
const PREP_ALL_CLASSES = ["Cleric", "Druid", "Paladin", "Ranger"];

/* Long-rest preparation: swap what's held in mind, from the full class list */
function PrepareSpells({ ch, customs, onSpells, onClose }) {
  const pool = srcSpells(customs?.spells || []);
  const book = ch.spells || {};
  const prepCasters = ch.classes.filter((c) => PREP_ALL_CLASSES.includes(c.name) && spellCapacity(c.name, c.level, ch.abilities).n > 0);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "85vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 18 }}>Prepare spells</div>
        <div style={{ color: T.dim, fontSize: 12, marginBottom: 10 }}>You know your whole list — choose what you hold in mind. Preparations change freely after each long rest.</div>
        {prepCasters.map((c) => {
          const cap = spellCapacity(c.name, c.level, ch.abilities);
          const maxLvl = maxSpellLevel(c.name, c.level);
          const subData = subSpellData(c.subclass, c.name, customs);
          const upTo = (spells) => Object.entries(spells).filter(([l]) => +l <= c.level).flatMap(([, arr]) => arr);
          const plain = (n) => n.replace(/\*+$/, ""); // subclass-tagged twins ride in the compendium with a trailing *
          const grantedSet = new Set(upTo(subData?.type === "granted" ? subData.spells : {}).map(plain));
          const granted = [...grantedSet];
          const expanded = subData?.type === "expanded" ? upTo(subData.spells) : [];
          const fitting = pool.filter((sp) => (spellFitsClass(sp, c.name, c.subclass) || expanded.includes(sp.name)) && sp.level >= 1 && sp.level <= maxLvl && !grantedSet.has(plain(sp.name)));
          const names = new Set(fitting.map((sp) => sp.name));
          const options = fitting
            .filter((sp) => !(sp.name.endsWith("*") && names.has(plain(sp.name))))
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
          const picks = book[c.name]?.spells || [];
          return (
            <div key={c.name} style={{ marginBottom: 14 }}>
              <div style={{ color: T.ink, fontWeight: 700 }}>
                <ClassTag name={c.name} /> {c.level}
                <span style={{ color: picks.length > cap.n ? T.blood : T.dim, fontWeight: 400, fontSize: 12 }}> · {picks.length}/{cap.n} {cap.label}</span>
              </div>
              {granted.length > 0 && (
                <div style={{ color: T.green, fontSize: 11, margin: "4px 0" }}>{subData.label}: {granted.join(", ")} — free, not counted.</div>
              )}
              <SpellPickGrid options={options} picks={picks} cap={cap.n} placeholder="Search your class list…"
                onChange={(arr) => onSpells({ ...book, [c.name]: { cantrips: [], ...(book[c.name] || {}), spells: arr } })} />
            </div>
          );
        })}
        <button style={{ ...btn(true), width: "100%" }} onClick={onClose}>Done — spells prepared</button>
      </div>
    </div>
  );
}

/* readOnly (shared sheets): the grimoire reads in full, but nothing can be
   scribed, prepared, or transcribed — and tapping a spell opens its text */
function SpellManager({ ch, customs, onSpells, onUpdate, onPrepare, onUse, readOnly }) {
  const casters = ch.classes.filter((c) => CLASSES[c.name].caster);
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const hasBoAS = (ch.invocations || []).includes("Book of Ancient Secrets");
  const hasTome = ch.pactBoon === "Pact of the Tome";
  const [adding, setAdding] = useState(null); // { cls, kind: 'cantrips'|'spells'|'arcanum', lvl? }
  const [q, setQ] = useState("");
  const featSp = featSpellsOf(ch);
  if (!casters.length && !featSp.length && !ch.racialChoices?.cantrip && !raceGrantedSpells(ch).length) return null;
  const book = ch.spells || {};
  const pool = srcSpells(customs?.spells || []);

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
      return pool.filter((sp) => sp.level === 0 && !allKnownCantrips(ch).includes(sp.name))
        .filter((sp) => sp.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }
    const entry = ch.classes.find((c) => c.name === clsName);
    const maxLvl = maxSpellLevel(clsName, entry.level);
    const extra = kind === "spells" ? expandedFor(clsName).filter((x) => !pool.some((sp) => sp.name === x.name && spellFitsClass(sp, clsName, entry.subclass))) : [];
    const taken = kind === "arcanum"
      ? Object.values(book[clsName]?.arcanum || {})
      : kind === "cantrips" ? allKnownCantrips(ch)
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

  /* Everything held, regrouped by spell level, then by where it came from */
  const spLvl = (n) => pool.find((sp) => sp.name === n)?.level ?? SPELL_LVL_HINT[n] ?? 1;
  /* Can any resource pay for this spell right now? Cantrips and rituals always cast; leveled
     spells need a slot of their level or higher, a big-enough pact slot, or their arcanum. */
  const slotsAll = spellSlots(ch.classes) || [];
  const usedSlotsArr = ch.usedSlots || [];
  const pactAll = wl ? PACT(wl.level) : null;
  const pactLeft = pactAll ? pactAll.n - Math.min(ch.usedPact || 0, pactAll.n) : 0;
  const featSpellNames = new Set([...featSp.flatMap((e) => e.names), ...raceGrantedSpells(ch), ...(classLevel(ch, "Ranger") >= 1 ? ["Hunter's Mark"] : [])]);
  const canPay = (n) => {
    const lvl = spLvl(n);
    if (lvl === 0) return true;
    if (featSpellNames.has(n)) return true; // a feat spell carries its own once-per-rest use
    if (pool.find((s) => s.name === n)?.ritual) return true;
    if (Object.entries(book.Warlock?.arcanum || {}).some(([l, an]) => an === n && !(ch.usedArcanum || []).includes(+l))) return true;
    for (let L = lvl; L <= slotsAll.length; L++) if ((slotsAll[L - 1] || 0) - Math.min(usedSlotsArr[L - 1] || 0, slotsAll[L - 1] || 0) > 0) return true;
    return !!(pactAll && pactAll.lvl >= lvl && pactLeft > 0);
  };
  /* an active catalog effect marks its spell chip, so buffs read at a glance from the Grimoire */
  const activeFxNames = new Set(effectsOf(ch).map((e) => { const d = effDefOf(e); return d ? d.match || d.name : e.name; }));
  const groups = new Map(); // level -> [{ source, names, tint }]
  const addGroup = (lvl, source, names, tint) => {
    if (!names.length) return;
    if (!groups.has(lvl)) groups.set(lvl, []);
    groups.get(lvl).push({ source, names: [...names].sort(), tint });
  };
  const byLevel = (names) => {
    const m = {};
    names.forEach((n) => { const l = spLvl(n); (m[l] = m[l] || []).push(n); });
    return Object.entries(m);
  };
  casters.forEach((c) => {
    const mine = book[c.name] || { cantrips: [], spells: [] };
    const subData = subSpellData(c.subclass, c.name, customs);
    const grantedNow = subData?.type === "granted"
      ? Object.entries(subData.spells).filter(([lvl]) => +lvl <= c.level).flatMap(([, arr]) => arr) : [];
    addGroup(0, c.name, mine.cantrips || []);
    byLevel(mine.spells || []).forEach(([l, arr]) => addGroup(+l, c.name, arr));
    byLevel(grantedNow).forEach(([l, arr]) => addGroup(+l, (subData.label || "Granted").replace(/\s*\(always prepared\)/, " · always prepared"), arr, T.green));
    Object.entries(mine.arcanum || {}).forEach(([l, n]) => addGroup(+l, "Mystic Arcanum", [n], "#b48ead"));
  });
  if (ch.racialChoices?.cantrip) addGroup(0, `${ch.race} · racial`, [ch.racialChoices.cantrip]);
  if (classLevel(ch, "Ranger") >= 1) addGroup(1, "Favored Enemy · always prepared", ["Hunter's Mark"], T.green);
  {
    const rs = raceGrantedSpells(ch);
    addGroup(0, `${ch.race} · racial`, rs.filter((n) => spLvl(n) === 0), "#8fbcbb");
    byLevel(rs.filter((n) => spLvl(n) > 0)).forEach(([l, arr]) => addGroup(+l, `${ch.race} · racial`, arr, "#8fbcbb"));
  }
  featSp.forEach(({ feat, names }) => {
    addGroup(0, `${feat} · feat`, names.filter((n) => spLvl(n) === 0), "#8fbcbb");
    byLevel(names.filter((n) => spLvl(n) > 0)).forEach(([l, arr]) => addGroup(+l, `${feat} · feat`, arr, "#8fbcbb"));
  });
  if (hasTome) addGroup(0, "Book of Shadows · Tome · cast at will", ch.tomeCantrips || []);
  if (hasBoAS) byLevel(ch.boasRituals || []).forEach(([l, arr]) => addGroup(+l, "Book of Shadows · ritual only", arr));
  const lvlsHeld = [...groups.keys()].sort((a, b) => a - b);
  const LVL_NAMES = ["Cantrips", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];

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
        const isPrep = PREP_ALL_CLASSES.includes(c.name);
        return (
          <div key={c.name} style={{ marginBottom: 10 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}>
              <ClassTag name={c.name} /> {c.level}
              <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>
                {" "}· max spell level {maxLvl || "—"}
                {canCap > 0 && <span style={{ color: mine.cantrips.length > canCap ? T.blood : T.dim }}> · cantrips {mine.cantrips.length}/{canCap}</span>}
                {cap.n > 0 && <span style={{ color: mine.spells.length > cap.n ? T.blood : T.dim }}> · {mine.spells.length}/{cap.n} {cap.label}</span>}
              </span>
            </div>
            {subData?.type === "expanded" && (
              <div style={{ marginTop: 4, color: "#b48ead", fontSize: 12 }}>{subData.label}</div>
            )}
            {!readOnly && <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {isPrep && cap.n > 0 && pool.length > 0 && onPrepare && (
                <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={onPrepare}>⟳ prepare spells</button>
              )}
              {canCap > 0 && mine.cantrips.length < canCap && pool.length > 0 && (
                <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => { setAdding({ cls: c.name, kind: "cantrips" }); setQ(""); }}>＋ cantrip ({canCap - mine.cantrips.length} owed)</button>
              )}
              {!isPrep && cap.n > 0 && mine.spells.length < cap.n && pool.length > 0 && (
                <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} onClick={() => { setAdding({ cls: c.name, kind: "spells" }); setQ(""); }}>{c.name === "Wizard" ? "＋ scribe spell" : `＋ spell (${cap.n - mine.spells.length} owed)`}</button>
              )}
              {c.name === "Warlock" && c.level >= 11 && Object.entries(ARCANUM_UNLOCK).filter(([, wl]) => c.level >= wl).map(([lvlStr]) => {
                const aLvl = +lvlStr;
                return (mine.arcanum || {})[aLvl] ? null : (
                  <button key={aLvl} style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, borderColor: "#b48ead55", color: "#b48ead" }}
                    onClick={() => { setAdding({ cls: c.name, kind: "arcanum", lvl: aLvl }); setQ(""); }} disabled={pool.length === 0}>
                    ＋ {aLvl}th arcanum
                  </button>
                );
              })}
            </div>}
          </div>
        );
      })}

      {hasBoAS && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: T.ink, fontWeight: 700 }}>Book of Shadows — Ancient Secrets <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>· rituals only · level ≤ {Math.max(1, Math.ceil((wl?.level || 1) / 2))}</span></div>
          {!readOnly && pool.length > 0 && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, marginTop: 6 }} onClick={() => { setAdding({ kind: "boas" }); setQ(""); }}>＋ transcribe ritual</button>}
          {!readOnly && (ch.boasRituals || []).length < 2 && <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>Start with two 1st-level rituals from any class; transcribe rituals you find in your travels.</div>}
        </div>
      )}
      {hasTome && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: T.ink, fontWeight: 700 }}>Book of Shadows — Tome Cantrips <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>· {(ch.tomeCantrips || []).length}/3 · any class · cast at will</span></div>
          {!readOnly && (ch.tomeCantrips || []).length < 3 && pool.length > 0 && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0, marginTop: 6 }} onClick={() => { setAdding({ kind: "tome" }); setQ(""); }}>＋ add ({3 - (ch.tomeCantrips || []).length} owed)</button>}
        </div>
      )}

      {lvlsHeld.length > 0 && (
        <div style={{ paddingTop: 10, borderTop: `1px solid ${T.edge}` }}>
          {lvlsHeld.map((l) => (
            <div key={l} style={{ marginBottom: 10 }}>
              <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15 }}>{LVL_NAMES[l] || `${l}th level`}</div>
              {groups.get(l).map((g) => (
                <div key={`${l}|${g.source}`} style={{ marginTop: 3 }}>
                  <div style={{ color: g.tint || T.dim, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>{g.source}</div>
                  <div>
                    {g.names.map((n) => (
                      <span key={n} {...lorePress(n)} onClick={() => onUse && onUse(n)}
                        title={canPay(n) ? undefined : "No slot can pay for this right now"}
                        style={{ display: "inline-block", background: T.panel2, borderRadius: 8, padding: "4px 8px", margin: 2, fontSize: 13, color: g.tint || T.ink, cursor: "pointer", opacity: canPay(n) ? 1 : 0.45 }}>
                        {n}{activeFxNames.has(n) && <span style={{ color: T.gold }}> ✦</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div style={{ color: T.dim, fontSize: 11 }}>{readOnly
            ? "Tap or hold a spell to read it. ✦ marks a spell whose effect is active; a dimmed spell has no slot left to pay for it."
            : "Tap a spell to cast it — the prompt spends the slot and raises its effect. Long-press to read. ✦ marks a spell whose effect is active; a dimmed spell has no slot left to pay for it."}</div>
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
const pip = (filled, color) => ({ cursor: "pointer", fontSize: 18, fontFamily: "Georgia, serif", color: filled ? color : T.dim, opacity: filled ? 1 : 0.45, userSelect: "none", padding: "0 1px" });
const fieldStyle = { background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
const FX_KIND_COLOR = { Spell: "#6c91e0", Feature: "#7fb069", Feat: "#c77dca", Action: "#5eb1bf", Condition: "#d76a76", Custom: "#c9a44c", Bestiary: "#c9a44c" };

/* readOnly (shared sheets): effects and temp HP display but cannot be granted,
   stacked, or removed — the sheet is a sealed snapshot */
function EffectsCard({ ch, customs, fx, onUpdate, readOnly }) {
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
    onUpdate(applyEffectPatch(ch, inst, grantTemp));
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
    fx.shillelagh && `club/quarterstaff ✦ ${ABIL_NAMES[fx.shillelagh.abil]} & 1d8`,
  ].filter(Boolean);
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Active Effects</div>
        {fx.conc.length > 0 && <span title="One concentration effect at a time; Con save when you take damage" style={{ color: "#b48ead", fontSize: 12 }}>◉ concentrating on {fx.conc.join(", ")}</span>}
        <div style={{ flex: 1 }} />
        {!readOnly && <button style={{ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 13 }} onClick={() => setAdding(true)}>＋ Add effect</button>}
      </div>
      {(!readOnly || tempHp > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ color: "#5eb1bf", fontSize: 13, fontWeight: 700 }}>Temp HP</span>
          {!readOnly && <button style={{ ...pillBtn, opacity: tempHp ? 1 : 0.4 }} disabled={!tempHp} onClick={() => onUpdate({ tempHp: Math.max(0, tempHp - 1) })}>−</button>}
          <span style={{ color: tempHp ? "#5eb1bf" : T.dim, fontFamily: "Georgia, serif", fontSize: 18, minWidth: 26, textAlign: "center" }}>{tempHp}</span>
          {!readOnly && <button style={pillBtn} onClick={() => onUpdate({ tempHp: tempHp + 1 })}>＋</button>}
          {!readOnly && tempHp > 0 && <button style={{ ...pillBtn, width: "auto", padding: "0 10px", fontSize: 12 }} onClick={() => onUpdate({ tempHp: 0 })}>clear</button>}
        </div>
      )}
      {effects.length === 0 ? null : (
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
                  {isConcDef(e) && <span title={e.ally ? "An ally's spell or a potion sustains this — it doesn't hold your concentration" : "Concentration — one at a time; Con save when you take damage"} style={{ color: "#b48ead", fontSize: 12, marginLeft: 6 }}>{e.ally ? "◉ held for you" : "◉ conc"}</span>}
                  <div style={{ color: T.dim, fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{brief}{dur ? ` — ${dur}` : ""}</div>
                </div>
                {!readOnly && def?.stacks && (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button style={{ ...pillBtn, opacity: (e.stacks || 1) <= 1 ? 0.4 : 1 }} disabled={(e.stacks || 1) <= 1} onClick={() => bumpStacks(e.id, -1, def.stacks)}>−</button>
                    <button style={{ ...pillBtn, opacity: (e.stacks || 1) >= def.stacks ? 0.4 : 1 }} disabled={(e.stacks || 1) >= def.stacks} onClick={() => bumpStacks(e.id, 1, def.stacks)}>＋</button>
                  </span>
                )}
                {!readOnly && <span onClick={() => remove(e.id)} title="Remove effect" style={{ color: T.dim, cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1.4 }}>✕</span>}
              </div>
            );
          })}
        </div>
      )}
      {summary.length > 0 && <div style={{ color: T.gold, fontSize: 12, marginTop: 10 }}>Now shaping the sheet: {summary.join(" · ")}</div>}
      {adding && <AddEffectSheet ch={ch} customs={customs} existing={effects} onAdd={addEffect} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ============ FEATURE USES CARD — pips for every daily heroic ============ */
/* readOnly (shared sheets): the pips show what stands spent, but expend nothing */
function FeatureUsesCard({ ch, customs, onUpdate, onUse, readOnly }) {
  const trackers = useTrackersFor(ch, customs);
  const used = ch.usedFeatures || {};
  const [forging, setForging] = useState(false);
  const [form, setForm] = useState({ name: "", max: "3", per: "long" });
  const usedOf = (t) => Math.max(0, Math.min(used[t.key] || 0, t.max));
  const setUsed = (t, n) => onUpdate({ usedFeatures: { ...used, [t.key]: Math.max(0, Math.min(t.max, n)) } });
  const spend = (t) => {
    const patch = { usedFeatures: { ...used, [t.key]: usedOf(t) + 1 } };
    // spending a use of a tracked buff also raises the buff itself
    if (t.effect && EFFECT_BY_KEY[t.effect] && !hasEffect(ch, t.effect)) patch.effects = [...effectsOf(ch), { id: uid(), key: t.effect, name: EFFECT_BY_KEY[t.effect].name }];
    onUpdate(patch);
  };
  const removeCustom = (id) => onUpdate({ customTrackers: (ch.customTrackers || []).filter((t) => t.id !== id) });
  const addCustom = () => {
    const name = form.name.trim();
    if (!name) return;
    onUpdate({ customTrackers: [...(ch.customTrackers || []), { id: uid(), name, max: Math.max(1, parseInt(form.max, 10) || 1), per: form.per }] });
    setForm({ name: "", max: "3", per: "long" });
    setForging(false);
  };
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Feature Uses {!readOnly && <span style={{ color: T.dim, fontSize: 12, fontFamily: "inherit" }}>· tap ◆ to expend, ◇ to recover</span>}</div>
        <div style={{ flex: 1 }} />
        {!readOnly && <button style={{ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 13 }} onClick={() => setForging(!forging)}>＋ Custom tracker</button>}
      </div>
      {forging && !readOnly && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <input value={form.name} autoFocus placeholder="Hexblade's Curse, wand charges, blessings owed…" onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...fieldStyle, flex: "2 1 220px" }} />
          <input type="number" min={1} value={form.max} title="Number of uses" onChange={(e) => setForm({ ...form, max: e.target.value })} style={{ ...fieldStyle, width: 70, textAlign: "center" }} />
          <select value={form.per} onChange={(e) => setForm({ ...form, per: e.target.value })} style={{ ...fieldStyle, width: "auto" }}>
            <option value="short">refills on any rest</option><option value="long">refills on a long rest</option>
          </select>
          <button style={{ ...btn(true), padding: "8px 14px", minHeight: 0 }} onClick={addCustom}>Add</button>
        </div>
      )}
      {trackers.length === 0 ? null : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          {trackers.map((t) => {
            const u = usedOf(t), avail = t.max - u;
            const themed = (t.cls && (CLASS_THEMES[t.cls] || {}).color) || T.gold;
            return (
              <div key={t.key} data-use-tracker={t.key} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid ${T.edge}` }}>
                <div {...lorePress(t.name)} onClick={() => onUse && onUse(t.name)} style={{ color: T.dim, fontSize: 11, cursor: "pointer" }}>
                  <span style={{ color: themed }}>{t.name}</span> · {t.per === "short" ? "any rest" : "long rest"}
                  {t.custom && !readOnly && <span title="Remove tracker" style={{ color: T.dim, cursor: "pointer", marginLeft: 6 }} onClick={(e) => { e.stopPropagation(); removeCustom(t.id); }}>✕</span>}
                </div>
                {t.pool || t.max > 12 ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
                    {!readOnly && <button style={{ ...pillBtn, opacity: avail <= 0 ? 0.4 : 1 }} disabled={avail <= 0} onClick={() => spend(t)}>−</button>}
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 18, color: avail ? T.ink : T.dim }}>{avail}<span style={{ color: T.dim, fontSize: 12 }}>/{t.max}{t.unit ? ` ${t.unit}` : ""}</span></span>
                    {!readOnly && <button style={{ ...pillBtn, opacity: u <= 0 ? 0.4 : 1 }} disabled={u <= 0} onClick={() => setUsed(t, u - 1)}>＋</button>}
                  </div>
                ) : (
                  <div>
                    {Array.from({ length: t.max }, (_, j) => (
                      <span key={j} style={{ ...pip(j < avail, T.ink), ...(readOnly ? { cursor: "default" } : {}) }} onClick={readOnly ? undefined : () => (j < avail ? spend(t) : setUsed(t, u - 1))}>
                        {j < avail ? "◆" : "◇"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  /* the page beneath holds still while the sheet is up — only the sheet's own list scrolls */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const sheetField = { ...fieldStyle, fontSize: 16 }; // 16px keeps mobile Safari from zooming into focused inputs
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
      <input type="number" value={custom[f]} placeholder="0" onChange={(e) => setCustom({ ...custom, [f]: e.target.value })} style={sheetField} />
    </label>
  );
  /* Browsing the catalog fills a steady share of the screen — the sheet doesn't jump around
     as search narrows the list. The focused sub-views (value, concentration, custom forge)
     shrink to hug their content at the bottom, like a proper bottom sheet detent. */
  const browsing = !concAsk && !pending && !custom;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sheetVeil 200ms ease" }} onClick={onClose}>
      <div className={browsing ? "sheet-tall" : "sheet-cap"}
        style={{ ...card, width: "min(680px, 100%)", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetRise 300ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: "none", padding: "8px 20px 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.edge, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>Bestow an Effect</div>
            <button aria-label="Close" onClick={onClose}
              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "10px 4px 10px 14px", margin: "-10px -4px", WebkitTapHighlightColor: "transparent" }}>✕</button>
          </div>
          {browsing && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={q} placeholder="Search — mage armor, rage, poisoned…" onChange={(e) => setQ(e.target.value)} style={sheetField} />
              <button style={{ ...btn(false), whiteSpace: "nowrap", fontSize: 13 }} onClick={() => setCustom(blankCustom)}><Icon name="hammer" size={13} /> Custom</button>
            </div>
          )}
        </div>
        <div className="sheet-body" style={{ flex: browsing ? 1 : "0 1 auto", minHeight: 0, overflowY: "auto", padding: "0 20px calc(20px + env(safe-area-inset-bottom))" }}>
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
              <input data-fx-val type="number" min={pending.input.min} max={pending.input.max} value={val} autoFocus
                onChange={(e) => setVal(e.target.value)}
                style={{ ...fieldStyle, width: 90, textAlign: "center", fontSize: 18 }} />
              <button style={btn(true)} onClick={() => commit(pending, clampVal(), ally)}>Apply</button>
              <button style={btn(false)} onClick={() => setPending(null)}>Back</button>
            </div>
            {pending.tempHp && <div style={{ color: "#5eb1bf", fontSize: 12, marginTop: 8 }}>Grants {pending.tempHp(clampVal(), ch)} temporary hit points.</div>}
          </div>
        ) : custom ? (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: T.dim, fontSize: 12 }}>Name<input value={custom.name} autoFocus placeholder="Potion of Heroism, DM's mysterious blessing…" onChange={(e) => setCustom({ ...custom, name: e.target.value })} style={{ ...sheetField, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {numField("AC bonus", "ac")}{numField("Attack bonus", "atk")}{numField("Save bonus", "save")}{numField("Weapon damage", "dmg")}{numField("Speed (ft)", "speed")}{numField("Max HP", "maxHp")}{numField("Temp HP granted", "tempHp")}
            </div>
            <label style={{ display: "block", color: T.dim, fontSize: 12, marginTop: 10 }}>Reminder note (shown with the effect)<input value={custom.note} placeholder="advantage on stealth checks in dim light…" onChange={(e) => setCustom({ ...custom, note: e.target.value })} style={{ ...sheetField, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <label style={{ color: T.dim, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={custom.conc} onChange={(e) => setCustom({ ...custom, conc: e.target.checked })} /> Concentration</label>
              <label style={{ color: T.dim, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>Expires:
                <select value={custom.ends} onChange={(e) => setCustom({ ...custom, ends: e.target.value })} style={{ ...fieldStyle, width: "auto", padding: "6px 8px" }}>
                  <option value="short">on any rest</option><option value="long">on a long rest</option><option value="manual">only when removed</option>
                </select>
              </label>
              <input value={custom.dur} placeholder="duration, e.g. 1 hour" onChange={(e) => setCustom({ ...custom, dur: e.target.value })} style={{ ...sheetField, width: 150 }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={btn(true)} onClick={submitCustom}>Bestow it</button>
              <button style={btn(false)} onClick={() => setCustom(null)}>Back</button>
            </div>
          </div>
        ) : (
          <>
            {concActive.length > 0 && <div style={{ color: "#b48ead", fontSize: 12, marginTop: 10 }}>◉ Concentrating on {concActive.join(", ")} — adding another concentration effect will end it.</div>}
            {groups.length === 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 14 }}>Nothing in the catalog matches — forge it as a custom effect instead.</div>}
            {groups.map(([title, defs]) => (
              <div key={title} style={{ marginTop: 14 }}>
                <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15 }}>{title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, marginTop: 6 }}>
                  {defs.map((d) => {
                    const active = have.has(d.key);
                    const disabled = active && !d.stacks;
                    return (
                      <div key={d.key} data-fx-row={d.key} onClick={() => !disabled && pick(d)}
                        style={{ minWidth: 0, minHeight: 44, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, background: T.panel2, border: `1px solid ${T.edge}`, WebkitTapHighlightColor: "transparent" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
                          <span style={{ color: T.ink, fontWeight: 700, fontSize: 13.5 }}>{d.name}</span>
                          {d.conc && <span style={{ color: "#b48ead", fontSize: 11 }}>◉</span>}
                          <span style={{ flex: 1 }} />
                          <span style={{ color: FX_KIND_COLOR[d.kind], fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>{active ? (d.stacks ? "worsen" : "active") : d.dur}</span>
                        </div>
                        <div style={{ color: T.dim, fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{d.brief}</div>
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
    </div>
  );
}

/* ============ MINIONS & SUMMONS CARD — the creatures at your side ============ */
/* Every summoned body gets its own chip: name, role, and a hit-point pool tracked the same
   way the character's is. The amount field arms both buttons — one tap wounds or heals one
   minion, so a wolf pack under a fireball is eight taps, not eight sums.
   readOnly (shared sheets): the menagerie shows, nothing bleeds. */
function MinionsCard({ ch, customs, onUpdate, onSummon, onRoll, onDice, readOnly }) {
  const minions = minionsOf(ch);
  const [amt, setAmt] = useState(1);
  const [rolling, setRolling] = useState(null); // the minion whose dice are out
  if (readOnly && minions.length === 0) return null;
  const n = Math.max(1, parseInt(amt, 10) || 1);
  const patchOne = (id, fn) => onUpdate({ minions: minions.map((m) => (m.id === id ? fn(m) : m)) });
  const dismiss = (m) => onUpdate({
    minions: minions.filter((x) => x.id !== m.id),
    log: [...(ch.log || []), `${m.name} ${minionHp(m) <= 0 ? "fell" : "was dismissed"}.`],
  });
  const dismissAll = () => onUpdate({ minions: [], log: [...(ch.log || []), "Every summoned creature dismissed."] });
  const standing = minions.filter((m) => minionHp(m) > 0).length;
  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Minions &amp; Summons</div>
        {minions.length > 0 && <span style={{ color: T.dim, fontSize: 12 }}>{standing} of {minions.length} standing</span>}
        <div style={{ flex: 1 }} />
        {!readOnly && minions.length > 1 && <button style={{ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 13, borderColor: T.edge, color: T.dim }} onClick={dismissAll}>Dismiss all</button>}
        {!readOnly && <button style={{ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 13 }} onClick={onSummon}>＋ Summon</button>}
      </div>
      {minions.length === 0 ? (
        <div style={{ color: T.dim, fontSize: 13, marginTop: 10 }}>No creatures at your side.</div>
      ) : (
        <>
          {!readOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: T.dim, fontSize: 13 }}>
              Damage / heal by
              <input data-minion-amt type="number" min={1} value={amt} onChange={(e) => setAmt(e.target.value)}
                style={{ width: 58, textAlign: "center", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 4px", fontSize: 16, minHeight: 42, boxSizing: "border-box" }} />
            </div>
          )}
          <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
            {minions.map((m) => {
              const max = Math.max(1, m.maxHp || 1);
              const cur = minionHp(m);
              const temp = Math.max(0, m.tempHp || 0);
              const ratio = cur / max;
              const hpColor = cur <= 0 ? "#d76a76" : ratio > 0.5 ? T.green : ratio > 0.25 ? T.gold : "#d76a76";
              const down = cur <= 0 && temp <= 0;
              return (
                <div key={m.id} data-minion={m.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.panel2, border: `1px solid ${down ? "#8e3b4688" : T.edge}`, borderRadius: 10, padding: "8px 10px", opacity: down ? 0.75 : 1, flexWrap: "wrap" }}>
                  <div {...lorePress(m.stat ? "creature:" + m.stat : m.source)} style={{ flex: "1 1 150px", minWidth: 0, cursor: "pointer" }}>
                    <span style={{ color: T.ink, fontWeight: 700, fontSize: 14, textDecoration: down ? "line-through" : "none" }}>{m.name}</span>
                    <span style={{ color: FX_KIND_COLOR[m.kind] || FX_KIND_COLOR.Custom, fontSize: 10.5, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.kind || "Custom"}</span>
                    {down && <span style={{ color: "#d76a76", fontSize: 11, marginLeft: 8 }}>down</span>}
                    <div style={{ color: T.dim, fontSize: 11.5, marginTop: 2 }}>
                      {m.stat && m.stat !== m.name ? `${m.stat} · ` : ""}{m.source}{m.ac ? ` · AC ${m.ac}` : ""}{m.note ? ` · ${m.note}` : ""}
                    </div>
                  </div>
                  {m.stat && onRoll && (
                    <button data-minion-roll style={{ ...pillBtn, width: "auto", padding: "0 9px" }} title="Roll for this creature" onClick={() => setRolling(m)}>
                      <Icon name="d20" size={15} style={{ marginRight: 0 }} />
                    </button>
                  )}
                  <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
                    {!readOnly && <button style={{ ...pillBtn, color: "#d76a76", opacity: down ? 0.4 : 1 }} disabled={down} title={`Deal ${n} damage`} onClick={() => patchOne(m.id, (x) => minionApplyHp(x, -n))}>−</button>}
                    <div style={{ minWidth: 74, textAlign: "center" }}>
                      <span style={{ fontFamily: "Georgia, serif", fontSize: 17, color: hpColor }}>
                        {cur}{temp > 0 && <span style={{ fontSize: 12, color: "#5eb1bf" }}> +{temp}</span>}<span style={{ fontSize: 12, color: T.dim }}> / {max}</span>
                      </span>
                      <div style={{ height: 3, borderRadius: 2, background: T.panel, marginTop: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${ratio * 100}%`, background: hpColor, transition: "width 240ms ease" }} />
                      </div>
                    </div>
                    {!readOnly && <button style={{ ...pillBtn, color: T.green, opacity: (m.dmg || 0) > 0 ? 1 : 0.4 }} disabled={!(m.dmg || 0)} title={`Heal ${n}`} onClick={() => patchOne(m.id, (x) => minionApplyHp(x, n))}>＋</button>}
                  </div>
                  {!readOnly && <span onClick={() => dismiss(m)} title={down ? "Let it go" : "Dismiss"} style={{ color: T.dim, cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1.4 }}>✕</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {rolling && (() => {
        const c = creatureByName(rolling.stat);
        if (!c) return null;
        const attacks = minionAttackRolls(c);
        const saves = minionSaves(c);
        const skills = minionSkills(c);
        const slot = rolling.slot || null; // spirits remember the slot that called them
        const spellAtk = attacks.some((a) => a.useSpellAtk) ? summonerSpellAtk(ch, rolling.source) : null;
        const dmgBonus = (a) => a.bonus + (a.scaled && slot ? slot : 0);
        /* the roll trays sit at z 60, beneath this sheet — it steps aside before the dice fall */
        const closeThen = (fn) => { setRolling(null); fn(); };
        const pill = { ...btn(false), padding: "7px 12px", minHeight: 0, fontSize: 12.5, fontFamily: "inherit" };
        const secTitle = { color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14 };
        const diceLabel = (a) => {
          const g = {};
          a.dice.forEach((s) => { g[s] = (g[s] || 0) + 1; });
          return Object.entries(g).map(([s, n]) => `${n}d${s}`).join(" + ") + (dmgBonus(a) ? fmtMod(dmgBonus(a)) : "");
        };
        return (
          <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sheetVeil 200ms ease" }} onClick={() => setRolling(null)}>
            <div className="sheet-cap" style={{ ...card, width: "min(620px, 100%)", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))", animation: "sheetRise 300ms cubic-bezier(0.32, 0.72, 0, 1)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}><Icon name="d20" size={17} /> {rolling.name}</div>
                <span style={{ color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1 }} onClick={() => setRolling(null)}>✕</span>
              </div>
              <div style={{ color: T.dim, fontSize: 12.5, marginTop: 2 }}>
                {c.name} · the sheet's Advantage / Disadvantage toggle rides along ·{" "}
                <span style={{ textDecoration: "underline dotted", cursor: "pointer" }} onClick={() => closeThen(() => __showLore && __showLore("creature:" + c.name))}>stat block</span>
              </div>
              {attacks.length > 0 && (
                <>
                  <div style={secTitle}>Attacks — to hit, then damage</div>
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    {attacks.map((a) => {
                      const hitMod = a.atk ?? (a.useSpellAtk ? spellAtk : null);
                      return (
                        <div key={a.name} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ color: T.ink, fontWeight: 700, fontSize: 13.5, flex: "1 1 110px" }}>{a.name}{a.scaled && !slot && <span title="Also add the summoning slot's level to damage" style={{ color: T.gold, fontSize: 11 }}> ✦ +slot</span>}</span>
                          {hitMod != null ? (
                            <button style={pill} onClick={() => closeThen(() => onRoll({ title: `${rolling.name} — ${a.name}`, parts: [{ label: a.atk != null ? "to hit" : "your spell attack", value: hitMod }], kind: "attack", minion: true }))}>
                              <Icon name="sword" size={13} /> {fmtMod(hitMod)} to hit
                            </button>
                          ) : (
                            <span style={{ color: T.dim, fontSize: 12 }}>uses your spell attack</span>
                          )}
                          {a.dice.length > 0 && onDice && (
                            <button style={{ ...pill, color: "#d76a76", borderColor: T.blood }} onClick={() => closeThen(() => onDice({ title: `${rolling.name} — ${a.name} damage`, dice: a.dice.map((s) => ({ sides: s, value: roll(s) })), bonus: dmgBonus(a), bonusLabel: "damage", note: a.scaled && !slot ? "Add the summoning slot's level, then apply it." : "Apply it to the target." }))}>
                              {diceLabel(a)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div style={secTitle}>Saving throws {saves.some((s) => s.prof) && <span style={{ textTransform: "none" }}>· ● proficient</span>}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {saves.map((s) => (
                  <button key={s.a} style={pill} onClick={() => closeThen(() => onRoll({ title: `${rolling.name} — ${ABIL_NAMES[s.a]} save`, parts: [{ label: `${ABIL_NAMES[s.a]} save`, value: s.mod }], kind: "save", minion: true }))}>
                    {s.a.toUpperCase()} {fmtMod(s.mod)}{s.prof ? " ●" : ""}
                  </button>
                ))}
              </div>
              <div style={secTitle}>Ability checks</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {ABILITIES.map((a) => (
                  <button key={a} style={pill} onClick={() => closeThen(() => onRoll({ title: `${rolling.name} — ${ABIL_NAMES[a]} check`, parts: [{ label: ABIL_NAMES[a], value: mod(c.ab[a]) }], kind: "check", minion: true }))}>
                    {a.toUpperCase()} {fmtMod(mod(c.ab[a]))}
                  </button>
                ))}
                {skills.map((sk) => (
                  <button key={sk.name} style={{ ...pill, borderColor: T.gold }} onClick={() => closeThen(() => onRoll({ title: `${rolling.name} — ${sk.name}`, parts: [{ label: sk.name, value: sk.mod }], kind: "check", minion: true }))}>
                    {sk.name} {fmtMod(sk.mod)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ============ SUMMON SHEET — pick what answers the call ============ */
/* The bottom-sheet picker behind ＋ Summon and behind every conjuring cast. Browsing shows
   the catalog with the character's own sources first; picking a source opens the muster —
   choose the form, how many, their HP, their role — and commits one instance per body.
   `preset` (from the Use prompt) skips browsing and lands straight on the source just cast. */
function AddMinionSheet({ ch, customs, preset, onUpdate, onClose }) {
  const presetDef = preset?.def || null;
  const defaultsFor = (d, f, slot) => ({
    name: f.name, count: "1",
    hp: String(d.hpOf ? d.hpOf(ch) : d.spirit ? spiritHp(d, f, slot) : f.hp),
    ac: String(d.spirit ? spiritAc(d, f, slot) : (f.ac ?? "")),
  });
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(presetDef);
  const [form, setForm] = useState(presetDef ? summonFormsFor(presetDef)[0] : null);
  const [formQ, setFormQ] = useState("");
  const [slotLv, setSlotLv] = useState(preset?.slotLvl || presetDef?.slot || null);
  const [fields, setFields] = useState(presetDef ? defaultsFor(presetDef, summonFormsFor(presetDef)[0], preset?.slotLvl || presetDef.slot) : null);
  const [custom, setCustom] = useState(null);
  const slotNow = (d) => (d?.spirit ? Math.max(d.slot, Math.min(9, parseInt(slotLv, 10) || d.slot)) : null);
  /* the page beneath holds still while the sheet is up — only the sheet's own list scrolls */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const sheetField = { ...fieldStyle, fontSize: 16 }; // 16px keeps mobile Safari from zooming into focused inputs
  const known = knownSpellNames(ch, customs);
  const isMine = (d) => (d.kind === "Spell" ? known.has(d.source) : d.mine ? d.mine(ch) : false);
  const ql = q.trim().toLowerCase();
  const matches = (d) => !ql || d.source.toLowerCase().includes(ql) || (d.brief || "").toLowerCase().includes(ql) || summonFormsFor(d).some((f) => f.name.toLowerCase().includes(ql));
  const suggested = SUMMON_LIB.filter((d) => matches(d) && isMine(d));
  const sugKeys = new Set(suggested.map((d) => d.key));
  const groups = [
    [`Yours — ${ch.name}'s spells & features`, suggested],
    ["Summoning spells", SUMMON_LIB.filter((d) => d.kind === "Spell" && matches(d) && !sugKeys.has(d.key))],
    ["Class features", SUMMON_LIB.filter((d) => d.kind === "Feature" && matches(d) && !sugKeys.has(d.key))],
    ["The bestiary", SUMMON_LIB.filter((d) => d.kind === "Bestiary" && matches(d))],
  ].filter(([, a]) => a.length);
  const pick = (d) => {
    const f = summonFormsFor(d)[0];
    setPending(d); setForm(f); setFormQ(""); setSlotLv(d.slot || null); setFields(defaultsFor(d, f, d.slot));
  };
  const pickForm = (f) => {
    setForm(f);
    // a new form refreshes the stats it owns; the count and a hand-typed role survive
    const s = slotNow(pending);
    setFields((prev) => ({ ...prev, name: f.name, hp: String(pending.hpOf ? pending.hpOf(ch) : pending.spirit ? spiritHp(pending, f, s) : f.hp), ac: String(pending.spirit ? spiritAc(pending, f, s) : (f.ac ?? "")) }));
  };
  const bumpSlot = (v) => {
    setSlotLv(v);
    const s = Math.max(pending.slot, Math.min(9, parseInt(v, 10) || pending.slot));
    setFields((prev) => ({ ...prev, hp: String(spiritHp(pending, form, s)), ac: String(spiritAc(pending, form, s)) }));
  };
  const addMinions = (def, f, stat, slot) => {
    const nm = (f.name || "").trim() || def.source;
    const count = Math.max(1, Math.min(20, parseInt(f.count, 10) || 1));
    const hp = Math.max(1, parseInt(f.hp, 10) || 1);
    const ac = Math.max(0, parseInt(f.ac, 10) || 0);
    const existing = minionsOf(ch);
    // "Wolf", then "Wolf 2"… — numbering picks up where the standing pack left off
    const already = existing.filter((m) => m.name === nm || m.name.startsWith(nm + " ")).length;
    const insts = Array.from({ length: count }, (_, i) => ({
      id: uid(), key: def.key, kind: def.kind, source: def.source,
      name: count === 1 && already === 0 ? nm : `${nm} ${already + i + 1}`,
      maxHp: hp, dmg: 0, tempHp: 0, ...(ac ? { ac } : {}), ends: def.ends || "manual",
      ...(stat ? { stat } : {}),
      ...(slot ? { slot } : {}),
      ...(def.key === "custom" && f.note ? { note: f.note } : {}),
    }));
    onUpdate({
      minions: [...existing, ...insts],
      log: [...(ch.log || []), `Summoned ${count > 1 ? `${count}× ` : ""}${nm} (${def.source}).`],
    });
    onClose();
  };
  const blankCustom = { name: "", source: "", count: "1", hp: "10", ac: "", note: "", ends: "manual" };
  const submitCustom = () => addMinions(
    { key: "custom", kind: "Custom", source: (custom.source || "").trim() || "Custom summon", ends: custom.ends },
    custom, creatureByName(custom.name)?.name || null
  );
  const browsing = !pending && !custom;
  const numField = (label, f, obj, setObj, width = "1 1 80px") => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.dim, flex: width }}>
      {label}
      <input type="number" min={0} value={obj[f]} onChange={(e) => setObj({ ...obj, [f]: e.target.value })} style={sheetField} />
    </label>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sheetVeil 200ms ease" }} onClick={onClose}>
      <div className={browsing ? "sheet-tall" : "sheet-cap"}
        style={{ ...card, width: "min(680px, 100%)", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetRise 300ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: "none", padding: "8px 20px 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.edge, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>Summon a Creature</div>
            <button aria-label="Close" onClick={onClose}
              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "10px 4px 10px 14px", margin: "-10px -4px", WebkitTapHighlightColor: "transparent" }}>✕</button>
          </div>
          {browsing && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={q} placeholder="Search — wolf, familiar, skeleton…" onChange={(e) => setQ(e.target.value)} style={sheetField} />
              <button style={{ ...btn(false), whiteSpace: "nowrap", fontSize: 13 }} onClick={() => setCustom(blankCustom)}><Icon name="hammer" size={13} /> Custom</button>
            </div>
          )}
        </div>
        <div className="sheet-body" style={{ flex: browsing ? 1 : "0 1 auto", minHeight: 0, overflowY: "auto", padding: "0 20px calc(20px + env(safe-area-inset-bottom))" }}>
        {pending ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.ink, fontWeight: 700 }}>
              {pending.source}
              <span style={{ color: FX_KIND_COLOR[pending.kind] || T.dim, fontSize: 10.5, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{pending.kind}</span>
              {pending.conc && <span title="Concentration — if it breaks, the summons go with it" style={{ color: "#b48ead", fontSize: 12, marginLeft: 6 }}>◉ conc</span>}
            </div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>{pending.brief}</div>
            {(preset?.slotLvl || pending.countHint) && (
              <div style={{ color: T.gold, fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                {preset?.slotLvl ? `Cast at level ${preset.slotLvl}. ` : ""}{pending.countHint || ""}
              </div>
            )}
            {(() => {
              const forms = summonFormsFor(pending);
              if (forms.length <= 1) return null;
              const fq = formQ.trim().toLowerCase();
              const shown = fq ? forms.filter((f) => f.name.toLowerCase().includes(fq)) : forms;
              return (
                <>
                  {forms.length > 12 && (
                    <input value={formQ} placeholder={`Search ${forms.length} creatures…`} onChange={(e) => setFormQ(e.target.value)} style={{ ...sheetField, marginTop: 10 }} />
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {shown.map((f) => {
                      const on = form && form.name === f.name;
                      const hpShown = pending.spirit ? spiritHp(pending, f, slotNow(pending)) : f.hp;
                      return (
                        <button key={f.name} {...(f.stat ? lorePress("creature:" + f.name) : {})} onClick={() => pickForm(f)}
                          style={{ ...btn(false), padding: "6px 10px", minHeight: 0, fontSize: 12.5, fontFamily: "inherit", fontWeight: on ? 700 : 400, borderColor: on ? T.gold : T.edge, color: on ? T.gold : T.ink }}>
                          {f.name} <span style={{ color: T.dim, fontSize: 11 }}>{f.cr != null ? `CR ${crShow(f.cr)} · ` : ""}{hpShown} HP</span>
                        </button>
                      );
                    })}
                    {shown.length === 0 && <span style={{ color: T.dim, fontSize: 13 }}>No creature matches.</span>}
                  </div>
                </>
              );
            })()}
            {(() => {
              /* spirit forms carry a parenthetical mood — the block lives under the base name */
              const statName = form && (form.stat ? form.name : (creatureByName(form.name) || creatureByName(baseSubName(form.name)))?.name);
              return statName ? (
                <button data-statblock-btn style={{ ...btn(false), padding: "7px 12px", minHeight: 0, fontSize: 12.5, marginTop: 10 }}
                  onClick={() => __showLore && __showLore("creature:" + statName)}>
                  <Icon name="book" size={13} /> {statName} — read the full stat block
                </button>
              ) : null;
            })()}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.dim, flex: "2 1 150px" }}>
                Name
                <input value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} style={sheetField} />
              </label>
              {pending.spirit && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.dim, flex: "1 1 80px" }}>
                  Slot level
                  <input type="number" min={pending.slot} max={9} value={slotLv ?? pending.slot} onChange={(e) => bumpSlot(e.target.value)} style={sheetField} />
                </label>
              )}
              {numField("How many", "count", fields, setFields)}
              {numField("HP each", "hp", fields, setFields)}
              {numField("AC", "ac", fields, setFields)}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={btn(true)} onClick={() => addMinions(pending, fields, form && (form.stat ? form.name : (creatureByName(form.name) || creatureByName(baseSubName(form.name)))?.name || null), pending.spirit ? slotNow(pending) : null)}>Summon</button>
              {!presetDef && <button style={btn(false)} onClick={() => setPending(null)}>Back</button>}
            </div>
          </div>
        ) : custom ? (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: T.dim, fontSize: 12 }}>Creature<input value={custom.name} autoFocus placeholder="Homunculus, awakened shrub, borrowed war dog…" onChange={(e) => setCustom({ ...custom, name: e.target.value })} style={{ ...sheetField, marginTop: 4 }} /></label>
            <label style={{ display: "block", color: T.dim, fontSize: 12, marginTop: 10 }}>Source<input value={custom.source} placeholder="Danse Macabre, a feat, a DM's boon…" onChange={(e) => setCustom({ ...custom, source: e.target.value })} style={{ ...sheetField, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {numField("How many", "count", custom, setCustom)}
              {numField("HP each", "hp", custom, setCustom)}
              {numField("AC", "ac", custom, setCustom)}
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.dim, flex: "1 1 150px" }}>
                It lasts
                <select value={custom.ends} onChange={(e) => setCustom({ ...custom, ends: e.target.value })} style={sheetField}>
                  <option value="short">until any rest</option><option value="long">until a long rest</option><option value="manual">until dismissed</option>
                </select>
              </label>
            </div>
            <label style={{ display: "block", color: T.dim, fontSize: 12, marginTop: 10 }}>Reminder note<input value={custom.note} placeholder="flies 60 ft, obeys only in Infernal…" onChange={(e) => setCustom({ ...custom, note: e.target.value })} style={{ ...sheetField, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={btn(true)} onClick={submitCustom}>Summon</button>
              <button style={btn(false)} onClick={() => setCustom(null)}>Back</button>
            </div>
          </div>
        ) : (
          <>
            {groups.length === 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 14 }}>Nothing in the bestiary matches — muster it as a custom creature instead.</div>}
            {groups.map(([title, defs]) => (
              <div key={title} style={{ marginTop: 14 }}>
                <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 15 }}>{title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, marginTop: 6 }}>
                  {defs.map((d) => (
                    <div key={d.key} data-summon-row={d.key} onClick={() => pick(d)}
                      style={{ minWidth: 0, minHeight: 44, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: T.panel2, border: `1px solid ${T.edge}`, WebkitTapHighlightColor: "transparent" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
                        <span style={{ color: T.ink, fontWeight: 700, fontSize: 13.5 }}>{d.source}</span>
                        {d.conc && <span style={{ color: "#b48ead", fontSize: 11 }}>◉</span>}
                        <span style={{ flex: 1 }} />
                        <span style={{ color: FX_KIND_COLOR[d.kind], fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>{d.kind}</span>
                      </div>
                      <div style={{ color: T.dim, fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{d.brief}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

/* ============ SOURCEBOOK SHEET — choose which books feed the pickers ============ */
/* Every source found in the compendium gets a toggle. Off means: gone from spell pick
   lists and summon musters. Known spells, mustered creatures, and lore stay whole. */
function SourcebookSheet({ customs, off, onToggle, onEnableAll, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const inv = new Map();
  const bump = (name, kind) => { const e = inv.get(name) || { spells: 0, creatures: 0 }; e[kind]++; inv.set(name, e); };
  (customs?.spells || []).forEach((sp) => bump(spellSrcOf(sp), "spells"));
  __BESTIARY.forEach((b) => bump(creatureSrcOf(b), "creatures"));
  const first = ["Player's Handbook", SRD_SRC];
  const rows = [...inv.entries()].sort((a, b) => {
    const ia = first.indexOf(a[0]), ib = first.indexOf(b[0]);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a[0].localeCompare(b[0]);
  });
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sheetVeil 200ms ease" }} onClick={onClose}>
      <div className="sheet-tall"
        style={{ ...card, width: "min(680px, 100%)", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetRise 300ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: "none", padding: "8px 20px 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.edge, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}><Icon name="gear" size={17} /> Sourcebooks</div>
            <button aria-label="Close" onClick={onClose}
              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "10px 4px 10px 14px", margin: "-10px -4px", WebkitTapHighlightColor: "transparent" }}>✕</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.5, flex: 1 }}>A disabled book vanishes from spell pickers and summon musters. What a character already knows or has mustered is never touched.</div>
            {off.size > 0 && <button style={{ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 12.5, whiteSpace: "nowrap" }} onClick={onEnableAll}>Enable all</button>}
          </div>
        </div>
        <div className="sheet-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 20px calc(20px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "grid", gap: 6 }}>
            {rows.map(([name, n]) => {
              const on = !off.has(name);
              return (
                <div key={name} data-src-row={name} onClick={() => onToggle(name)}
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, boxSizing: "border-box", padding: "8px 12px", borderRadius: 10, cursor: "pointer", background: T.panel2, border: `1px solid ${on ? T.edge : "#8e3b4688"}`, opacity: on ? 1 : 0.6, WebkitTapHighlightColor: "transparent" }}>
                  <span style={{ fontSize: 17, fontFamily: "Georgia, serif", color: on ? T.gold : T.dim }}>{on ? "◆" : "◇"}</span>
                  <span style={{ flex: 1, color: T.ink, fontWeight: 700, fontSize: 13.5, textDecoration: on ? "none" : "line-through" }}>{name}</span>
                  <span style={{ color: T.dim, fontSize: 11.5, textAlign: "right" }}>
                    {[n.spells && `${n.spells} spell${n.spells > 1 ? "s" : ""}`, n.creatures && `${n.creatures} creature${n.creatures > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ USE PROMPT — tap a spell or feature, confirm, the sheet does the rest ============ */
/* The front door for casting and feature use: name, cost, consequences, one confirming tap.
   Slots and tracked uses are spent here; catalog effects raise through the same patch the
   Effects card uses; concentration states its eviction before it happens. Pips everywhere
   stay hand-tappable — this sheet is the front door, not the only door. */
function UsePrompt({ name, ch, customs, onUpdate, onDice, onBlade, onStrike, onSummon, onClose }) {
  const recipe = useRecipe(name, ch, customs);
  const sp = recipe?.sp || null, tracker = recipe?.tracker || null, effs = recipe?.effs || [];
  const [variant, setVariant] = useState(0);
  const [bladeWpn, setBladeWpn] = useState(0);
  const eff = effs[Math.min(variant, Math.max(0, effs.length - 1))] || null;
  /* Blade cantrips (Booming/Green-Flame) are cast AS a melee weapon attack — pick the weapon */
  const blade = !!sp && isBladeCantrip(sp.name);
  const meleeOptions = blade ? equippedOf(ch).map((r) => findItem(r.name, customs)).filter((x) => x && x.type === "M") : [];
  const bladeLvl = totalLevel(ch);
  const bladeTier = bladeRiderTier(bladeLvl);
  /* Damaging spells (attack, save, or auto-hit) hand off to the strike flow after paying the
     cost. A spell that's really a catalog effect (Hex, Armor of Agathys) keeps its effect flow. */
  const strike = sp && !blade && !eff ? strikeProfile(sp) : null;
  const damaging = !!strike;

  /* ---- every way this could be paid for ---- */
  const slots = spellSlots(ch.classes) || [];
  const usedSlots = ch.usedSlots || [];
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const pact = wl ? PACT(wl.level) : null;
  const usedPact = pact ? Math.min(ch.usedPact || 0, pact.n) : 0;
  const usedArc = ch.usedArcanum || [];
  const arcanum = ch.spells?.Warlock?.arcanum || {};
  const usedFeats = ch.usedFeatures || {};
  // a Book of Ancient Secrets ritual the character doesn't otherwise know casts ONLY as a ritual
  const boasOnly = sp ? (ch.boasRituals || []).includes(sp.name) && !knownSpellNames(ch, customs).has(sp.name) : false;
  const options = [];
  if (sp && sp.level >= 1 && !boasOnly) {
    for (let L = sp.level; L <= slots.length; L++) if ((slots[L - 1] || 0) > 0)
      options.push({ id: `slot:${L}`, type: "slot", lvl: L, left: (slots[L - 1] || 0) - Math.min(usedSlots[L - 1] || 0, slots[L - 1] || 0), label: L === sp.level ? `Level ${L} slot` : `Upcast · level ${L}` });
    if (pact && pact.lvl >= sp.level) options.push({ id: "pact", type: "pact", lvl: pact.lvl, left: pact.n - usedPact, label: `Pact slot · level ${pact.lvl}` });
    Object.entries(arcanum).forEach(([l, an]) => { if (an === sp.name) options.push({ id: `arc:${l}`, type: "arcanum", lvl: +l, left: usedArc.includes(+l) ? 0 : 1, label: `Mystic Arcanum ${l}th` }); });
  }
  if (sp && sp.level >= 1 && sp.ritual) options.push({ id: "ritual", type: "ritual", lvl: sp.level, left: Infinity, label: "Ritual — no slot, +10 minutes" });
  const trackerLeft = tracker ? tracker.max - Math.min(usedFeats[tracker.key] || 0, tracker.max) : 0;
  if (tracker) options.push({ id: "use", type: "tracker", left: trackerLeft, label: tracker.pool ? `From the pool · ${trackerLeft}/${tracker.max}${tracker.unit ? ` ${tracker.unit}` : ""} left` : `${trackerLeft} of ${tracker.max} left` });

  const [pick, setPick] = useState(() => (options.find((o) => o.left > 0) || options[0] || {}).id || null);
  const chosen = options.find((o) => o.id === pick) || null;
  const blocked = options.length > 0 && (!chosen || chosen.left <= 0);
  const [poolAmt, setPoolAmt] = useState(1);
  const [manual, setManual] = useState(eff?.input && eff.input.unit !== "slot" ? eff.input.def : 1);
  if (!recipe) return null;

  /* a conjuring cast opens the muster afterward, so each creature lands with its own HP;
     unknown imported summon spells conjure their def from their own text */
  const summonDef = summonDefFor(recipe.name) || spiritDefFromSpell(sp);

  /* effects that scale with the slot read it straight off the chosen cost */
  const slotVal = chosen && chosen.lvl != null && chosen.type !== "ritual" && chosen.type !== "tracker" ? chosen.lvl : null;
  const clampIn = (v) => (eff?.input ? Math.max(eff.input.min, Math.min(eff.input.max, parseInt(v, 10) || eff.input.def)) : undefined);
  const effVal = eff?.input ? (eff.input.unit === "slot" ? clampIn(slotVal ?? eff.input.def) : clampIn(manual)) : undefined;
  const grantTemp = eff?.tempHp ? eff.tempHp(effVal, ch) : 0;

  const activeInst = effs.map((d) => effectsOf(ch).find((e) => e.key === d.key)).find(Boolean) || null;
  const concNow = effectsOf(ch).filter(isConcInst);
  /* a concentration spell with no catalog entry still holds concentration — it rides
     as a bare custom instance so the jealousy rule and rest sweeps see it */
  const spConc = !eff && sp ? /concentration/i.test(sp.duration || "") : false;
  const concEnding = eff?.conc ? concNow.filter((e) => e.key !== eff.key) : spConc ? concNow.filter((e) => !(e.key === "custom" && e.name === sp.name)) : [];
  const verb = sp ? "Cast" : tracker ? "Use" : "Declare";
  const freeToggle = options.length === 0 && !!activeInst; // a stance already held, nothing to spend
  /* the confirm button wears the color of whatever pays for the act: the tracker's class,
     pact violet, the casting class's hue for slots and cantrips, the effect's kind otherwise */
  const spellClassOf = () => {
    if (!sp) return null;
    for (const c of ch.classes) {
      const b = (ch.spells || {})[c.name];
      if (b && (["cantrips", "spells"].some((k) => (b[k] || []).includes(sp.name)) || Object.values(b.arcanum || {}).includes(sp.name))) return c.name;
    }
    if ((ch.tomeCantrips || []).includes(sp.name) || (ch.boasRituals || []).includes(sp.name)) return "Warlock";
    return ch.classes.find((c) => CLASSES[c.name].caster && spellFitsClass(sp, c.name, c.subclass))?.name || null;
  };
  const accent =
    chosen?.type === "pact" || chosen?.type === "arcanum" ? CLASS_THEMES.Warlock.color
    : chosen?.type === "tracker" ? (tracker.cls && CLASS_THEMES[tracker.cls]?.color) || T.gold
    : sp ? (CLASS_THEMES[spellClassOf()]?.color || FX_KIND_COLOR.Spell)
    : (eff && FX_KIND_COLOR[eff.kind]) || T.gold;
  const primaryBtn = { ...btn(true), background: accent, borderColor: accent, color: T.bg };
  const meta = sp
    ? [sp.level === 0 ? "Cantrip" : `Level ${sp.level}`, schoolName(sp.school), sp.time && `Cast: ${sp.time}`, sp.range && `Range: ${sp.range}`, sp.duration && `Duration: ${sp.duration}`].filter(Boolean).join(" · ")
    : [eff && eff.kind, eff?.dur && `lasts ${eff.dur}`, tracker && (tracker.per === "short" ? "recharges on any rest" : "recharges on a long rest")].filter(Boolean).join(" · ");

  const commit = (free) => {
    const patch = {}; const bits = [];
    if (!free && chosen && chosen.left > 0) {
      if (chosen.type === "slot") { patch.usedSlots = Array.from({ length: slots.length }, (_, j) => Math.min(slots[j] || 0, Math.min(usedSlots[j] || 0, slots[j] || 0) + (j === chosen.lvl - 1 ? 1 : 0))); bits.push(`level-${chosen.lvl} slot spent, ${chosen.left - 1} left`); }
      else if (chosen.type === "pact") { patch.usedPact = Math.min(pact.n, usedPact + 1); bits.push(`pact slot spent, ${pact.n - usedPact - 1} left`); }
      else if (chosen.type === "arcanum") { patch.usedArcanum = [...usedArc, chosen.lvl]; bits.push("arcanum spent until dawn"); }
      else if (chosen.type === "ritual") bits.push("cast as a ritual — no slot");
      else if (chosen.type === "tracker") {
        const amt = tracker.pool ? Math.max(1, Math.min(trackerLeft, parseInt(poolAmt, 10) || 1)) : 1;
        patch.usedFeatures = { ...usedFeats, [tracker.key]: Math.min(tracker.max, Math.min(usedFeats[tracker.key] || 0, tracker.max) + amt) };
        bits.push(tracker.pool ? `${trackerLeft - amt}/${tracker.max}${tracker.unit ? ` ${tracker.unit}` : ""} left` : `${trackerLeft - 1} of ${tracker.max} left`);
      }
    } else if (free && options.length > 0) bits.push("by the table's grace — nothing marked");
    if (eff) {
      if (concEnding.length) bits.push(`concentration moves — ${concEnding.map((e) => e.name).join(", ")} ends`);
      if (activeInst && activeInst.key === eff.key && !eff.stacks) bits.push("already active — refreshed");
      const inst = { id: uid(), key: eff.key, name: eff.name, ...(effVal != null ? { val: effVal } : {}), ...(eff.stacks ? { stacks: 1 } : {}) };
      Object.assign(patch, applyEffectPatch(ch, inst, grantTemp));
      if (grantTemp) bits.push(`${grantTemp} temp HP`);
    } else if (spConc) {
      if (concEnding.length) bits.push(`concentration moves — ${concEnding.map((e) => e.name).join(", ")} ends`);
      const inst = { id: uid(), key: "custom", name: sp.name, conc: true, dur: (sp.duration || "").replace(/^concentration,?\s*(up to\s*)?/i, ""), ends: "short", note: "Concentration held", mods: {} };
      const base = { ...ch, effects: effectsOf(ch).filter((e) => !(e.key === "custom" && e.name === sp.name)) };
      Object.assign(patch, applyEffectPatch(base, inst, 0));
    }
    patch.log = [...(ch.log || []), `${verb === "Cast" ? "Cast" : "Used"} ${recipe.name}${bits.length ? " — " + bits.join("; ") : ""}.`];
    onUpdate(patch);
    if (summonDef && onSummon) onSummon(summonDef, slotVal || sp?.level || null);
    if (!free && chosen?.type === "tracker" && tracker.die && onDice)
      onDice({ title: `${tracker.name} — d${tracker.die}${tracker.dieBonus ? ` + ${tracker.dieBonus}` : ""}`, dice: [{ sides: tracker.die, value: roll(tracker.die) }], bonus: tracker.dieBonus || 0, bonusLabel: tracker.dieBonus ? tracker.dieLabel || "" : "", note: tracker.heal ? "Accept to heal yourself." : "Add it where the feature calls for it.", heal: !!tracker.heal });
    onClose();
  };
  /* Pay for a damaging spell, then hand its cast level to the strike flow (attack/damage). The
     effective level scales upcasts: the chosen slot for leveled spells, the character for cantrips. */
  const strikeCastLvl = sp ? (sp.level === 0 ? 0 : (slotVal || sp.level)) : 0;
  const finishCast = (free) => { commit(free); if (damaging && onStrike) onStrike(sp, strikeCastLvl); };
  const endIt = () => {
    const refund = instMaxHp(activeInst, ch);
    onUpdate({ effects: effectsOf(ch).filter((e) => e.id !== activeInst.id), ...(refund ? { dmg: Math.max(0, Math.max(0, ch.dmg || 0) - refund) } : {}), log: [...(ch.log || []), `${activeInst.name || recipe.name} ended.`] });
    onClose();
  };

  const pillOpt = (on, dead) => ({ ...btn(false), padding: "7px 12px", minHeight: 0, fontSize: 12.5, fontFamily: "inherit", fontWeight: on ? 700 : 400, borderColor: on ? accent : T.edge, color: dead ? T.dim : on ? accent : T.ink, opacity: dead ? 0.5 : 1 });
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ ...card, width: "min(620px, 100%)", maxHeight: "80vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>
            {recipe.name}
            {eff && <span style={{ color: FX_KIND_COLOR[eff.kind] || T.dim, fontSize: 11, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{sp ? "Spell" : eff.kind}</span>}
          </div>
          <span style={{ color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1 }} onClick={onClose}>✕</span>
        </div>
        {meta && <div style={{ color: "#b48ead", fontSize: 13, marginTop: 4 }}>{meta}</div>}
        {(eff?.brief || eff?.desc) && <div style={{ color: T.ink, fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>{eff.brief}{eff.desc ? ` ${eff.desc}` : ""}</div>}

        {effs.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {effs.map((d, i) => <button key={d.key} style={pillOpt(i === variant)} onClick={() => setVariant(i)}>{d.name}</button>)}
          </div>
        )}

        {options.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Cost</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {options.map((o) => (
                <button key={o.id} style={pillOpt(o.id === pick, o.left <= 0)} onClick={() => setPick(o.id)}>
                  {o.label}{o.type !== "ritual" && !tracker?.pool && Number.isFinite(o.left) && o.type !== "tracker" ? ` · ${o.left} left` : ""}{o.left <= 0 ? " · spent" : ""}
                </button>
              ))}
            </div>
            {chosen?.type === "tracker" && tracker.pool && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, color: T.dim, fontSize: 13 }}>
                Spend
                <input type="number" min={1} max={trackerLeft} value={poolAmt} onChange={(e) => setPoolAmt(e.target.value)} style={{ ...fieldStyle, width: 74, textAlign: "center" }} />
                {tracker.unit || "uses"}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 14, color: T.dim, fontSize: 13 }}>{sp && sp.level === 0 ? "No cost — cantrips are cast at will." : "No cost — a stance you declare."}</div>
        )}

        {blade && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: T.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Strike with</div>
            {meleeOptions.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {meleeOptions.map((it, i) => (
                  <button key={it.name + i} style={pillOpt(i === Math.min(bladeWpn, meleeOptions.length - 1))} onClick={() => setBladeWpn(i)}>{it.name}</button>
                ))}
              </div>
            ) : (
              <div style={{ color: "#d76a76", fontSize: 13, marginTop: 6 }}>Equip a melee weapon to strike with {recipe.name}.</div>
            )}
            <div style={{ color: T.dim, fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
              A melee weapon attack. {bladeTier
                ? `At level ${bladeLvl}, a hit adds +${bladeTier}d8 ${/green[- ]?flame/i.test(sp.name) ? "fire" : "thunder"}.`
                : "Below 5th level it adds no bonus damage yet — just the weapon's hit."} The attack rolls first, then its damage.
            </div>
          </div>
        )}
        {eff?.input && eff.input.unit !== "slot" && (
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, color: T.dim, fontSize: 13 }}>
            {eff.input.label} ({eff.input.min}–{eff.input.max})
            <input type="number" min={eff.input.min} max={eff.input.max} value={manual} onChange={(e) => setManual(e.target.value)} style={{ ...fieldStyle, width: 84, textAlign: "center" }} />
          </label>
        )}
        {eff?.input && eff.input.unit === "slot" && slotVal != null && <div style={{ color: T.dim, fontSize: 12.5, marginTop: 10 }}>Scales with the slot: applied at level {effVal}.</div>}
        {grantTemp > 0 && <div style={{ color: "#5eb1bf", fontSize: 12.5, marginTop: 10 }}>Grants {grantTemp} temporary hit points{Math.max(0, ch.tempHp || 0) > 0 ? " — temp HP doesn't stack; you keep the larger pool" : ""}.</div>}
        {concEnding.length > 0 && <div style={{ color: "#b48ead", fontSize: 13, marginTop: 10 }}>◉ You're concentrating on {concEnding.map((e) => e.name).join(", ")} — this {verb.toLowerCase()} ends it.</div>}
        {(eff?.conc || spConc) && !concEnding.length && <div style={{ color: "#b48ead", fontSize: 13, marginTop: 10 }}>◉ Concentration — one at a time; Con save when you take damage.</div>}
        {activeInst && !freeToggle && <div style={{ color: T.dim, fontSize: 12.5, marginTop: 10 }}>Already active — {verb.toLowerCase()}ing again refreshes it rather than stacking.</div>}
        {blocked && <div style={{ color: "#d76a76", fontSize: 13, marginTop: 10 }}>{tracker && chosen?.type === "tracker" ? `Spent — recharges on a ${chosen && tracker.per === "short" ? "short or long" : "long"} rest.` : "No slot can pay for this right now."}</div>}
        {summonDef && (
          <div style={{ color: T.dim, fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
            <span style={{ color: T.gold }}>Calls creatures to your side</span>{summonDef.countHint ? ` — ${summonDef.countHint}.` : "."}
          </div>
        )}
        {damaging && (
          <div style={{ color: T.dim, fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
            {strike.attack ? `A ${strike.attack} spell attack — roll it, then its damage on a hit.`
              : strike.save ? `Your target rolls a ${ABIL_NAMES[strike.save]} save — casting rolls the damage.`
              : strike.special === "missiles" ? "Auto-hit darts — casting rolls their damage together."
              : "Casting rolls its damage."}
            {strike.level === 0 && strike.cantripScale ? " Dice grow at levels 5, 11, and 17." : strike.upcast ? " Upcast in a higher slot for more dice." : ""}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
          {blade ? (
            <button style={{ ...primaryBtn, opacity: meleeOptions.length ? 1 : 0.4, cursor: meleeOptions.length ? "pointer" : "default" }} disabled={!meleeOptions.length}
              onClick={() => { const it = meleeOptions[Math.min(bladeWpn, meleeOptions.length - 1)]; if (it) { onBlade(it, sp.name); onClose(); } }}>
              <Icon name="sword" /> Cast &amp; strike
            </button>
          ) : freeToggle ? (
            <>
              <button style={primaryBtn} onClick={endIt}>End {recipe.name}</button>
              <button style={btn(false)} onClick={() => commit(false)}>Refresh it</button>
            </>
          ) : blocked ? (
            <>
              <button style={{ ...primaryBtn, opacity: 0.4, cursor: "default" }} disabled>{verb}</button>
              <button style={btn(false)} onClick={() => finishCast(true)}>{verb} anyway — mark nothing</button>
            </>
          ) : (
            <button style={primaryBtn} onClick={() => finishCast(false)}>{damaging ? (strike.attack || strike.special === "beams" || strike.special === "rays" ? `${verb} & attack` : `${verb} & roll damage`) : verb}</button>
          )}
          <button style={{ ...btn(false), borderColor: T.edge, color: T.dim, fontFamily: "inherit", fontWeight: 400, fontSize: 13 }} onClick={() => __showLore && __showLore(recipe.name)}>Read the full text</button>
        </div>
      </div>
    </div>
  );
}

/* ---- The guided tour: every tap, hold, and hidden trick the sheet knows, laid out for
   first-timers. Two gestures run the whole app — tap to act, long-press to read — so the
   guide leads with that and then walks each panel top to bottom. ---- */
const SHEET_GUIDE = [
  {
    icon: "book", title: "First, the one golden rule",
    intro: "Nearly everything here is tappable, and two gestures do different things:",
    items: [
      ["Tap", "acts — rolls the dice, spends the slot, casts the spell, opens the prompt."],
      ["Long-press (or right-click)", "reads — reveals the full rules text for any feature, spell, item, background, or trait."],
      ["Dotted underline", "a quiet hint that there's lore to read underneath. Hold it."],
    ],
  },
  {
    icon: "up", title: "The header",
    items: [
      ["Portrait", "tap it to set a photo from your camera roll."],
      ["Share (the arrow-in-a-box)", "seals a read-only snapshot of this sheet into a link your DM can open — no passphrase, no way to touch your ledger."],
      ["Sourcebooks (the gear)", "choose which books feed the pickers — a disabled book vanishes from spell lists and summon musters without touching what you already know."],
      ["Level Up", "advance a class — choose new features, take or roll HP, and the whole sheet re-derives itself."],
      ["Proficiency +N", "your proficiency bonus, shown as its own stat card; it scales with total level and feeds every proficient roll."],
      ["Delete", "asks once more before it's final."],
    ],
  },
  {
    icon: "d20", title: "Abilities & saving throws",
    items: [
      ["Tap an ability card", "rolls an ability check on that score."],
      ["Tap the “save” line", "rolls that saving throw."],
      ["● green dot", "marks a save you're proficient in — from your first class only, per multiclass rules."],
    ],
  },
  {
    icon: "shield", title: "The vital stats row",
    items: [
      ["Armor Class", "hold it to see exactly how it's built — armor, Dex, shields, and effects."],
      ["Hit Points", "the bar tracks current vs. max; temporary HP shows in blue and soaks damage first."],
      ["Initiative", "tap to roll it."],
      ["Speed · Hit Dice · Gold · Passive Perception", "read at a glance; Speed turns gold when an effect changes it."],
    ],
  },
  {
    icon: "sun", title: "In Play — living numbers",
    items: [
      ["− Damage / + Heal", "type an amount and apply it; temp HP absorbs damage before real HP does."],
      ["Short Rest", "recovers pact slots and short-rest features; fleeting effects end."],
      ["Long Rest", "full HP, every slot and feature back, temp HP cleared, exhaustion eased."],
      ["Concentration", "take damage while concentrating and a reminder surfaces right here."],
    ],
  },
  {
    icon: "flame", title: "Active Effects",
    items: [
      ["Bestow an effect", "Rage, Bless, Shield of Faith, exhaustion, poisoned — search the list or forge a custom one."],
      ["They do the math", "an active effect automatically adjusts AC, saves, attack, damage, even max HP."],
      ["They expire on cue", "each one ends on the right rest or duration, so you never track it by hand."],
    ],
  },
  {
    icon: "paw", title: "Minions & Summons",
    items: [
      ["＋ Summon", "muster anything you can call — conjured beasts, a familiar, skeletons, a steed, a wild shape form, or any creature in the SRD bestiary."],
      ["Cast to summon", "casting a conjuring spell opens the muster automatically, with the slot level in hand and the legal creatures already filtered by type and CR."],
      ["Each body, its own pool", "every creature tracks its own HP — set the amount, tap its − or ＋."],
      ["Tap a creature's d20", "roll its attacks and damage, saving throws, and checks — straight off its stat block, with the Advantage toggle riding along."],
      ["Long-press a creature", "its full stat block — abilities, attacks, traits — rises like any other lore."],
      ["They know when to leave", "concentration menageries dissolve on a rest; familiars, steeds, and the raised dead stay until dismissed."],
    ],
  },
  {
    icon: "swords", title: "Roll the Bones — attacks & dice",
    items: [
      ["Advantage / Disadvantage", "the toggle rides along on every roll until you switch it back."],
      ["Melee / Ranged / Spell", "quick attack rolls with the right ability and proficiency already baked in."],
      ["Equipped weapons", "the left half rolls to hit, the blood-red half rolls damage. ▸N shows ammo and ticks down as you fire; ✦ marks a Shillelagh."],
      ["The dice tray", "shows the d20, every modifier itemized, and the total — and flags a natural crit."],
    ],
  },
  {
    icon: "sparkles", title: "Spell slots & Pact Magic",
    items: [
      ["◆ / ◇ pips", "tap a filled ◆ to spend a slot, an empty ◇ to give one back."],
      ["Pact Magic", "warlock slots are tracked separately and all return on a short rest."],
      ["Mystic Arcanum", "each 6th–9th-level arcanum is a single casting per long rest."],
    ],
  },
  {
    icon: "zen", title: "Feature uses",
    items: [
      ["Trackers", "limited-use features — Channel Divinity, Ki, Rage, Bardic Inspiration — get pips you tap to spend and regain."],
      ["Spent fades", "used-up features dim so you can see at a glance what's still in the tank."],
    ],
  },
  {
    icon: "book", title: "The Grimoire & choices",
    items: [
      ["Manage spells", "add what you know; tap a spell to cast it, spending a slot and rolling attack or damage when it has them."],
      ["Prepare", "prepared casters get a screen to swap today's list."],
      ["Metamagic · Invocations · choices", "sorcery points, warlock invocations, and other picks each get their own manager."],
    ],
  },
  {
    icon: "leaf", title: "Skills",
    items: [
      ["Tap any skill", "rolls it with the right ability and proficiency."],
      ["● proficient · ★ expertise", "expertise doubles your proficiency bonus on that skill."],
      ["Jack of All Trades · Reliable Talent", "these fold in automatically, noted in the fine print when you have them."],
    ],
  },
  {
    icon: "hammer", title: "Notes, Chronicle & backups",
    items: [
      ["Notes", "free-form scratch space — saved the moment you tap away."],
      ["Chronicle", "an automatic log of every roll, rest, and change this soul has lived through."],
      ["Backups", "from the Roster's ⋯ menu, export the whole ledger to a file and import it on any device."],
    ],
  },
];

function GuideSheet({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sheetVeil 200ms ease" }} onClick={onClose}>
      <div className="sheet-cap"
        style={{ ...card, width: "min(640px, 100%)", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetRise 300ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: "none", padding: "8px 20px 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.edge, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>How this sheet works</div>
              <div style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>Every tap, hold, and hidden trick — the full tour.</div>
            </div>
            <button aria-label="Close" onClick={onClose}
              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "10px 4px 10px 14px", margin: "-10px -4px", WebkitTapHighlightColor: "transparent" }}>✕</button>
          </div>
        </div>
        <div className="sheet-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 20px calc(22px + env(safe-area-inset-bottom))" }}>
          {SHEET_GUIDE.map((sec, i) => (
            <div key={i} style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <span style={{ color: T.gold, display: "inline-flex" }}><Icon name={sec.icon} size={17} /></span>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 16.5, color: T.ink }}>{sec.title}</span>
              </div>
              {sec.intro && <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{sec.intro}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {sec.items.map(([term, desc], j) => (
                  <div key={j} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.55 }}>
                    <span style={{ flex: "none", marginTop: 7, width: 5, height: 5, borderRadius: 5, background: T.gold, opacity: 0.75 }} />
                    <span style={{ color: T.dim }}><span style={{ color: T.ink, fontWeight: 700 }}>{term}</span> — {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ color: T.gold, fontSize: 12.5, lineHeight: 1.6, marginTop: 22, paddingTop: 14, borderTop: `1px solid ${T.edge}`, fontStyle: "italic", opacity: 0.85 }}>
            When in doubt, long-press. Nearly everything on this sheet has its full rules text a hold away.
          </div>
        </div>
      </div>
    </div>
  );
}

/* The share scroll: forge the link, paint the card, hand both over. Copying
   is the primary road; the native share tray appears where the device offers
   one, and carries the painted card as a real image beside the link — the
   only way a static host can put the character's face on a message. */
function ShareSheet({ ch, customs, onClose }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState(null); // { src, blob } — the painted banner
  useEffect(() => {
    let live = true;
    encodeShare(ch, customs).then((u) => { if (live) setUrl(u); }, () => { if (live) setFailed(true); });
    drawShareCard(ch, customs)
      .then((cv) => new Promise((res) => cv.toBlob((b) => res({ src: cv.toDataURL("image/png"), blob: b }), "image/png")))
      .then((c) => { if (live) setCard(c); })
      .catch(() => {}); // no card is no tragedy — the link still carries everything
    return () => { live = false; };
  }, [ch, customs]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { // clipboard API needs a secure context; fall back to the old select-and-copy rite
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
    }
    setCopied(true);
  };
  const nativeShare = async () => {
    const line = shareLine(ch, customs);
    // ride with the painted card when the tray accepts files; the link travels in
    // the text so no app can drop it. Fall back to plain text + url otherwise.
    if (card?.blob && navigator.canShare?.({ files: [new File([card.blob], "card.png", { type: "image/png" })] })) {
      const file = new File([card.blob], `${(ch.name || "character").replace(/[^\w -]/g, "")} — character card.png`, { type: "image/png" });
      try { await navigator.share({ files: [file], text: `${line}\n${url}` }); return; }
      catch (e) { if (e?.name === "AbortError") return; /* some targets refuse files — send the plain form */ }
    }
    navigator.share({ title: `${ch.name} — The Adventurer's Ledger`, text: line, url }).catch(() => {});
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sheetVeil 200ms ease" }} onClick={onClose}>
      <div className="sheet-cap"
        style={{ ...card, width: "min(640px, 100%)", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "sheetRise 300ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: "none", padding: "8px 20px 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.edge, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}><Icon name="share" size={18} /> Send to your DM</div>
              <div style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>A read-only snapshot of {ch.name}, sealed in a link.</div>
            </div>
            <button aria-label="Close" onClick={onClose}
              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "10px 4px 10px 14px", margin: "-10px -4px", WebkitTapHighlightColor: "transparent" }}>✕</button>
          </div>
        </div>
        <div className="sheet-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 20px calc(22px + env(safe-area-inset-bottom))" }}>
          {card && (
            <img src={card.src} alt={`${ch.name} — character card`}
              style={{ width: "100%", display: "block", marginTop: 10, borderRadius: 12, border: `1px solid ${T.edge}` }} />
          )}
          {failed ? (
            <div style={{ color: "#d76a76", fontSize: 13, marginTop: 16 }}>The link would not seal — this browser lacks the craft. Try a current Safari, Chrome, or Firefox.</div>
          ) : (
            <>
              <div style={{ marginTop: 16, padding: "10px 12px", background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 10, color: url ? T.dim : T.edge, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "ui-monospace, monospace" }}>
                {url || "Sealing the link…"}
              </div>
              {url && url.length > 8000 && (
                <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>A hefty soul — this link runs long, and some messaging apps clip long links. If it arrives broken, send it by email instead.</div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={{ ...btn(true), flex: 1, opacity: url ? 1 : 0.5 }} disabled={!url} onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
                {typeof navigator !== "undefined" && !!navigator.share && (
                  <button style={{ ...btn(false), flex: 1, opacity: url ? 1 : 0.5 }} disabled={!url} onClick={nativeShare}><Icon name="share" size={14} /> Share…</button>
                )}
              </div>
              {copied && <div style={{ color: T.green, fontSize: 12.5, marginTop: 10 }}>Copied — paste it anywhere your DM will see it.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Sheet({ ch, onBack, onLevelUp, onDelete, onPhoto, onSpells, onNotes, onInvocations, onUpdate, onSources, customs, shared }) {
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
  /* limited-use features refill on their own schedule */
  const usedFeats = ch.usedFeatures || {};
  const trackers = useTrackersFor(ch, customs);
  /* prepared casters re-pick their spells at dawn, so a long rest is never a no-op for them */
  const canPrep = ch.classes.some((c) => PREP_ALL_CLASSES.includes(c.name) && spellCapacity(c.name, c.level, ch.abilities).n > 0) && (customs?.spells || []).length > 0;
  /* summoned creatures dissolve on the rest that outlasts them; familiars, steeds,
     and the raised dead (ends: "manual") wait faithfully through the night */
  const restMinions = (kind) => minionsOf(ch).filter((m) => (kind === "short" ? m.ends !== "short" : m.ends === "manual"));
  const shortWould = usedPact > 0 || effectsOf(ch).some((e) => restTouches(e, "short")) || trackers.some((t) => t.per === "short" && (usedFeats[t.key] || 0) > 0) || restMinions("short").length < minionsOf(ch).length;
  const longWould = dmgRaw > 0 || tempHp > 0 || usedSlots.some(Boolean) || usedPact > 0 || usedArc.length > 0 || effectsOf(ch).some((e) => restTouches(e, "long")) || trackers.some((t) => (usedFeats[t.key] || 0) > 0) || canPrep || restMinions("long").length < minionsOf(ch).length;
  const resetUses = (kind) => {
    const u = { ...usedFeats };
    trackers.forEach((t) => { if (kind === "long" || t.per === "short") delete u[t.key]; });
    return u;
  };
  const shortRest = () => {
    const kept = new Set(restEffects("short").map((e) => e.id));
    // granted max HP walks out with its effect: refund it from recorded damage
    const refund = effectsOf(ch).filter((e) => !kept.has(e.id)).reduce((s, e) => s + instMaxHp(e, ch), 0);
    onUpdate({ usedPact: 0, effects: restEffects("short"), usedFeatures: resetUses("short"), minions: restMinions("short"), ...(refund ? { dmg: Math.max(0, dmgRaw - refund) } : {}) });
  };
  const [prepOpen, setPrepOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false); // the guided tour of every trick this sheet knows
  const [shareOpen, setShareOpen] = useState(false); // the scroll that seals this soul into a link
  const [restAsk, setRestAsk] = useState(null); // "short" | "long" — a rest waits for a confirming word
  const [summoning, setSummoning] = useState(null); // {} browses the bestiary; {key, slotLvl} lands on the source just cast
  const longRest = () => {
    onUpdate({ dmg: 0, usedSlots: [], usedPact: 0, usedArcanum: [], tempHp: 0, effects: restEffects("long"), usedFeatures: {}, minions: restMinions("long") });
    if (canPrep) setPrepOpen(true); // dawn — swap your prepared spells
  };

  /* ---- the bones: d20 rolls with every modifier the sheet knows about ---- */
  const [rollSpec, setRollSpec] = useState(null);
  const [advMode, setAdvMode] = useState("normal");
  /* ---- tap to act: a name that resolves to a use recipe opens the prompt; the rest read ---- */
  const [useTarget, setUseTarget] = useState(null);
  const openUse = (n) => {
    if (shared) { if (__showLore) __showLore(n); return; } // a sealed sheet reads; it does not spend
    if (useRecipe(n, ch, customs)) setUseTarget(n);
    else if (__showLore) __showLore(n);
  };
  const trackerByName = new Map(trackers.map((t) => [baseSubName(t.name).toLowerCase(), t]));
  const featureSpent = (f) => {
    const t = trackerByName.get(baseSubName(String(f)).toLowerCase());
    return t ? Math.min(usedFeats[t.key] || 0, t.max) >= t.max : false;
  };
  const feats = rollFeatures(ch);
  const fEff = featEffects(ch, customs);
  const featSave = (a) => fEff.saves.find((s) => s.abil === a);
  const saveProfFor = (a) => CLASSES[ch.classes[0].name].saves.includes(a) || feats.diamondSoul || ((feats.slipperyMind || feats.ironMind) && a === "wis") || !!featSave(a);
  const saveProfLabel = (a) => (CLASSES[ch.classes[0].name].saves.includes(a) ? "proficiency" : featSave(a) ? featSave(a).from : feats.diamondSoul ? "Diamond Soul" : feats.ironMind && a === "wis" ? "Iron Mind" : "Slippery Mind");
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
  const glamour = (a) => (a === "cha" && hasSub(ch, "Fey Wanderer") ? [{ label: "Otherworldly Glamour", value: Math.max(1, mod(ch.abilities.wis)) }] : []);
  const checkPartsFor = (a) => {
    const hp2 = halfProf(a);
    return [{ label: ABIL_NAMES[a], value: mod(ch.abilities[a]) }, ...(hp2 ? [hp2] : []), ...glamour(a)];
  };
  /* Initiative is a Dexterity check that the Alert feat alone adds proficiency to */
  const initPartsFor = () => [
    ...checkPartsFor("dex"),
    ...(fEff.init ? [{ label: fEff.init.label, value: fEff.init.value }] : []),
    ...(hasSub(ch, "Gloom Stalker") && mod(ch.abilities.wis) !== 0 ? [{ label: "Dread Ambusher", value: mod(ch.abilities.wis) }] : []),
  ];
  const skillPartsFor = (sk) => {
    const a = SKILL_ABIL[sk];
    const prof = ch.skills.includes(sk);
    const exp = (ch.expertise || []).includes(sk);
    const hp2 = !prof ? halfProf(a) : null;
    return [
      { label: ABIL_NAMES[a], value: mod(ch.abilities[a]) },
      ...(prof ? [{ label: exp ? "expertise" : "proficiency", value: pb * (exp ? 2 : 1) }] : []),
      ...(hp2 ? [hp2] : []),
      ...glamour(a),
    ];
  };
  const rollIt = (title, parts, kind, abil, proficient, extra) => setRollSpec({ title, parts, kind, abil, proficient, extra });
  /* Loosing a shot from an ammunition weapon spends a piece from the pack — and says so.
     On a sealed sheet the quiver is beyond reach: the dice still fall, nothing is spent. */
  const fireAmmo = (it) => {
    if (shared || !usesAmmo(it)) return null;
    const row = ammoRowFor(ch, customs, it);
    if (!row) return `${it.name}: no ammunition in your pack — the quiver is empty!`;
    const left = (row.qty || 1) - 1;
    onUpdate({ inventory: left > 0 ? (ch.inventory || []).map((r) => (r.name === row.name ? { ...r, qty: left } : r)) : (ch.inventory || []).filter((r) => r.name !== row.name) });
    return `${row.name} spent — ${left > 0 ? `${left} left` : "that was the last one!"}`;
  };
  /* Consumables: drinking/using decrements the row; healing potions roll their dice first */
  const [drinkRoll, setDrinkRoll] = useState(null); // { row, title, dice, bonus }
  const decremented = (row) => (ch.inventory || []).flatMap((r) => (r.name === row.name ? ((r.qty || 1) > 1 ? [{ ...r, qty: (r.qty || 1) - 1 }] : []) : [r]));
  const consume = (row) => {
    const heal = healingDiceFor(row.name);
    if (heal) { setDrinkRoll({ row, title: row.name, dice: Array.from({ length: heal.n }, () => ({ sides: heal.sides, value: roll(heal.sides) })), bonus: heal.plus }); return; }
    const key = consumableEffectKey(row.name);
    const patch = { inventory: decremented(row), log: [...(ch.log || []), `Consumed ${row.name}.`] };
    if (key && EFFECT_BY_KEY[key] && !hasEffect(ch, key)) patch.effects = [...effectsOf(ch), { id: uid(), key, name: EFFECT_BY_KEY[key].name, ally: true }];
    onUpdate(patch);
  };
  const acInfo = armorClass(ch, customs, fx);
  const [dmgRoll, setDmgRoll] = useState(null); // { title, dice, bonus, bonusLabel, note }
  const [pendingDmg, setPendingDmg] = useState(null); // a blade cantrip's damage, held until its attack tray closes
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
    if (shillTarget(it)) return fx.shillelagh.abil;
    const props = (it.property || "").split(",").map((x) => x.trim());
    if (it.type === "R") return "dex";
    if (props.includes("F")) return mod(ch.abilities.dex) > mod(ch.abilities.str) ? "dex" : "str";
    return "str";
  };
  const weaponDie = (it) => (shillTarget(it) ? "1d8" : it.dmg1 || "1d4");
  const weaponAbilLabel = (it, abil) => (shillTarget(it) ? `${ABIL_NAMES[abil]} (Shillelagh)` : ABIL_NAMES[abil]);
  const rollWeaponDamage = (it) => {
    const m = weaponDie(it).match(/(\d+)d(\d+)/);
    if (!m) return;
    const abil = weaponAbility(it);
    const props = (it.property || "").split(",").map((x) => x.trim());
    const dueling = hasStyle(ch, "Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0;
    const extras = fxDmg(it.type === "R" ? "ranged" : "melee", abil, props);
    const bonus = mod(ch.abilities[abil]) + dueling + extras.reduce((s, b) => s + b.value, 0);
    const dmgNotes = rollNotes(ch, "dmg", abil);
    setDmgRoll({
      title: `${it.name} damage`,
      dice: Array.from({ length: +m[1] }, () => ({ sides: +m[2], value: roll(+m[2]) })),
      bonus, bonusLabel: [weaponAbilLabel(it, abil), dueling ? "Dueling" : null, ...extras.map((b) => b.label)].filter(Boolean).join(" + "),
      note: `${DMG_TYPES[it.dmgType] || "damage"}${it.dmg2 && !shillTarget(it) ? ` · versatile: ${it.dmg2} two-handed` : ""}${hasStyle(ch, "Great Weapon Fighting") && props.includes("2H") ? " · GWF: you may reroll 1s and 2s" : ""}${dmgNotes.length ? " · " + dmgNotes.join(" · ") : ""}`,
    });
  };
  /* Booming/Green-Flame Blade: a weapon attack carrying a scaling elemental rider. The bones
     fall in order — the attack tray first, then its damage tray follows when that one closes. */
  const bladeSpellMod = () => {
    const casters = ch.classes.filter((c) => CLASSES[c.name].caster && SPELL_ABILITY[c.name]);
    return casters.length
      ? Math.max(...casters.map((c) => mod(ch.abilities[SPELL_ABILITY[c.name]])))
      : Math.max(mod(ch.abilities.int), mod(ch.abilities.wis), mod(ch.abilities.cha));
  };
  const castBlade = (it, name) => {
    const green = /green[- ]?flame/i.test(name);
    const cantrip = green ? "Green-Flame Blade" : "Booming Blade";
    const elem = green ? "fire" : "thunder";
    const tier = bladeRiderTier(lvl);
    const abil = weaponAbility(it);
    const props = (it.property || "").split(",").map((x) => x.trim());
    const atkParts = [{ label: weaponAbilLabel(it, abil), value: mod(ch.abilities[abil]) }, { label: "proficiency", value: pb }, ...fxAtk("melee", abil, props)];
    const md = weaponDie(it).match(/(\d+)d(\d+)/);
    const dueling = hasStyle(ch, "Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0;
    const extras = fxDmg("melee", abil, props);
    const bonus = mod(ch.abilities[abil]) + dueling + extras.reduce((s, b) => s + b.value, 0);
    const wpnDice = md ? Array.from({ length: +md[1] }, () => ({ sides: +md[2], value: roll(+md[2]) })) : [];
    const riderDice = Array.from({ length: tier }, () => ({ sides: 8, value: roll(8) }));
    const secondary = green
      ? `2nd creature within 5 ft takes ${tier ? `${tier}d8 + ` : ""}${bladeSpellMod()} ${elem}`
      : `if the target then moves: ${1 + tier}d8 thunder`;
    const note = [
      `${DMG_TYPES[it.dmgType] || "weapon"}${tier ? ` + ${tier}d8 ${elem} (${cantrip})` : ""}`,
      tier ? null : `${cantrip}'s bonus damage begins at level 5`,
      secondary,
      ...rollNotes(ch, "dmg", abil),
    ].filter(Boolean).join(" · ");
    onUpdate({ log: [...(ch.log || []), `Cast ${cantrip} — strike with ${it.name}.`] });
    setRollSpec({ title: `${cantrip} — ${it.name}`, parts: atkParts, kind: "attack", abil, extra: [`${cantrip}: a melee weapon attack — roll damage once it lands.`] });
    setPendingDmg({
      title: `${cantrip} — ${it.name} damage`,
      dice: [...wpnDice, ...riderDice],
      bonus,
      bonusLabel: [weaponAbilLabel(it, abil), dueling ? "Dueling" : null, ...extras.map((b) => b.label)].filter(Boolean).join(" + "),
      note,
    });
  };
  /* Which class casts this spell (for the attack bonus, save DC, and scaling) and its ability */
  const strikeClassOf = (sp) =>
    ch.classes.find((c) => { const b = (ch.spells || {})[c.name]; return b && ["cantrips", "spells"].some((k) => (b[k] || []).includes(sp.name)); })?.name
    || ((ch.tomeCantrips || []).includes(sp.name) ? "Warlock" : null)
    || ch.classes.find((c) => CLASSES[c.name].caster && spellFitsClass(sp, c.name, c.subclass))?.name
    || ch.classes.find((c) => CLASSES[c.name].caster)?.name || null;
  const bestMentalMod = () => Math.max(mod(ch.abilities.int), mod(ch.abilities.wis), mod(ch.abilities.cha));
  /* Casting a damaging spell: roll one d8 of thunder... no — read its profile, roll the spell
     attack (if any) into pendingDmg, or drop straight to a damage tray for saves and auto-hits.
     Dice scale by character level for cantrips, by the chosen slot for leveled spells. */
  const castSpellStrike = (sp, castLvl) => {
    const prof = strikeProfile(sp);
    if (!prof) return;
    const clsName = strikeClassOf(sp);
    const abil = (clsName && SPELL_ABILITY[clsName]) || (bestMentalMod() === mod(ch.abilities.int) ? "int" : bestMentalMod() === mod(ch.abilities.wis) ? "wis" : "cha");
    const cmod = mod(ch.abilities[abil]);
    const dc = 8 + pb + cmod;
    const rollN = (count, sides) => Array.from({ length: Math.max(0, count) }, () => ({ sides, value: roll(sides) }));
    const typeWord = DMG_TYPES[prof.type] || "damage";
    let dice, bonus = 0, bonusLabel = "", extraNote = [];
    if (prof.special === "missiles") {
      const darts = prof.count(castLvl);
      dice = rollN(darts, prof.die); bonus = darts * prof.plusEach; bonusLabel = `${darts} × +${prof.plusEach}`;
      extraNote.push(`auto-hit · ${darts} ${prof.what}s`);
    } else if (prof.special === "beams" || prof.special === "rays") {
      const count = prof.count(castLvl, lvl);
      dice = rollN(prof.n, prof.die);
      extraNote.push(`${count} ${prof.what}${count > 1 ? "s" : ""} — roll each ${prof.what}'s attack & this damage`);
    } else {
      let n = prof.base.n;
      // upcast only scales the primary when its die matches (Ice Knife's +1d6 grows a separate burst)
      if (prof.level === 0 && prof.cantripScale) n = prof.base.n * (1 + bladeRiderTier(lvl));
      else if (prof.upcast && prof.upcast.sides === prof.base.sides && castLvl > prof.upcast.above) n = prof.base.n + (castLvl - prof.upcast.above) * prof.upcast.n;
      dice = rollN(n, prof.base.sides); bonus = prof.base.plus || 0; bonusLabel = prof.base.plus ? "flat" : "";
    }
    if (prof.save) extraNote.unshift(`${ABIL_NAMES[prof.save]} save DC ${dc}`);
    const dmgSpec = { title: `${sp.name} damage`, dice, bonus, bonusLabel, note: [typeWord, ...extraNote].filter(Boolean).join(" · ") };
    if (prof.attack) {
      const parts = [{ label: ABIL_NAMES[abil], value: cmod }, { label: "proficiency", value: pb }, ...fxAtk("spell", abil)];
      setRollSpec({ title: `${sp.name} — ${prof.attack} spell attack`, parts, kind: "attack", abil, extra: [`${sp.name}: a ${prof.attack} spell attack — roll damage once it lands.`] });
      setPendingDmg(dmgSpec);
    } else {
      setDmgRoll(dmgSpec); // saves and auto-hits have no attack roll
    }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: 10, marginBottom: 16 }}>
        {shared ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 12, border: `1px solid ${T.edge}`, background: T.panel, color: T.dim, fontSize: 13, fontFamily: "Georgia, serif" }}>
            <Icon name="eye" size={14} style={{ marginRight: 0, color: T.gold }} /> Read-only snapshot
          </div>
        ) : (
          <button style={{ ...btn(false) }} onClick={onBack}>← Roster</button>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {!shared && onSources && (
            <button aria-label="Sourcebooks" title="Enable or disable sourcebooks" onClick={onSources}
              style={cornerBtn}><Icon name="gear" size={17} style={{ marginRight: 0 }} /></button>
          )}
          {!shared && (
            <button aria-label="Share with your DM" title="Share a read-only snapshot" onClick={() => setShareOpen(true)}
              style={{ ...cornerBtn, color: T.gold }}><Icon name="share" size={17} style={{ marginRight: 0 }} /></button>
          )}
          <button aria-label="How this sheet works" title="How this sheet works" onClick={() => setHelpOpen(true)}
            style={{ ...cornerBtn, fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700 }}>?</button>
        </div>
      </div>

      <div style={{ ...card, padding: 20, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        {shared ? (
          <Portrait photo={ch.photo} size={96} name={ch.name} />
        ) : (
          <label style={{ cursor: "pointer" }} title="Click to change portrait">
            <Portrait photo={ch.photo} size={96} name={ch.name} />
            <input type="file" accept="image/*" onChange={photoUpload} style={{ display: "none" }} />
          </label>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: T.gold }}>{ch.name}</div>
          <div style={{ color: T.ink }}>{ch.race} · {ch.classes.map((c, i) => <span key={c.name}>{i > 0 ? " / " : ""}<ClassTag name={c.name} /> {c.level}{c.subclass ? <span style={{ color: T.dim }}> (<span {...lorePress(c.subclass)}>{c.subclass}</span>)</span> : ""}</span>)}</div>
          <div style={{ color: T.dim, fontSize: 13 }}>Character level {lvl} · Proficiency +{pb} · <span {...lorePress(ch.background)} style={{ textDecoration: "underline dotted" }}>{ch.background}</span>{ch.alignment ? ` · ${ch.alignment}` : ""}</div>
        </div>
        {!shared && (
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            <button style={{ ...btn(true), opacity: lvl >= 20 ? 0.4 : 1 }} disabled={lvl >= 20} onClick={onLevelUp}><Icon name="up" /> Level Up</button>
            {!confirmDel
              ? <button style={{ ...btn(false), borderColor: T.blood, color: T.blood }} onClick={() => setConfirmDel(true)}>Delete</button>
              : <button style={{ ...btn(false), background: T.blood, color: T.ink, borderColor: T.blood }} onClick={onDelete}>Confirm delete?</button>}
          </div>
        )}
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
          {(fx.maxHp !== 0 || fx.halveMaxHp || fEff.hpPerLevel > 0) && (
            <div style={{ color: T.dim, fontSize: 10, marginTop: 4 }}>
              {fx.halveMaxHp ? "max halved by Exhaustion" : [fEff.hpPerLevel > 0 ? `Tough +${featHpBonus(ch)}` : null, fx.maxHp !== 0 ? `${fmtMod(fx.maxHp)} from effects` : null].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center", cursor: "pointer" }} title="Roll initiative"
          onClick={() => rollIt("Initiative", initPartsFor(), "check", "dex")}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Initiative <Icon name="d20" size={11} style={{ marginRight: 0 }} /></div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: fEff.init ? T.gold : T.ink }}>{fmtMod(initPartsFor().reduce((s, p) => s + p.value, 0))}</div>
          {fEff.init && <div style={{ color: T.dim, fontSize: 10, lineHeight: 1.4 }}>{fEff.init.label} +{fEff.init.value}</div>}
        </div>
        <div style={{ ...card, padding: 12, textAlign: "center" }} title={`+${pb} at character level ${lvl} — added to attack rolls, saving throws, and skills you're proficient with (doubled for Expertise)`}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase" }}>Proficiency</div>
          <div style={{ fontSize: 26, fontFamily: "Georgia, serif", color: T.gold }}>{fmtMod(pb)}</div>
          <div style={{ color: T.dim, fontSize: 10, lineHeight: 1.4 }}>character level {lvl}</div>
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

      {!shared && <div style={{ ...card, padding: 14, marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginRight: 4 }}>In Play</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "1 1 auto", minWidth: 0, flexWrap: "wrap" }}>
          <button style={{ ...btn(false), borderColor: T.blood, color: "#d76a76", flex: "1 1 auto", whiteSpace: "nowrap" }} onClick={() => applyHp(-hpAmt)} disabled={curHp <= 0 && tempHp <= 0}>− Damage</button>
          <input type="number" min={1} value={hpAmt}
            onChange={(e) => setHpAmt(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ width: 58, flex: "0 0 auto", textAlign: "center", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 4px", fontSize: 16, minHeight: 42, boxSizing: "border-box" }} />
          <button style={{ ...btn(false), borderColor: T.green, color: T.green, flex: "1 1 auto", whiteSpace: "nowrap" }} onClick={() => applyHp(hpAmt)} disabled={dmgRaw === 0}>+ Heal</button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "1 1 300px", minWidth: 0, flexWrap: "wrap" }}>
          <button style={{ ...btn(false), flex: "1 1 120px", whiteSpace: "nowrap" }} onClick={() => setRestAsk("short")} disabled={!shortWould} title="Recover pact slots; short-lived effects expire"><Icon name="moon" /> Short Rest</button>
          <button style={{ ...btn(false), flex: "1 1 120px", whiteSpace: "nowrap" }} onClick={() => setRestAsk("long")} disabled={!longWould} title="Full HP, all slots recovered, temp HP and expiring effects cleared, exhaustion eases"><Icon name="sun" /> Long Rest</button>
        </div>
        {restAsk && (
          <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setRestAsk(null)}>
            <div style={{ ...card, padding: 24, maxWidth: 380, width: "100%", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold }}>
                <Icon name={restAsk === "short" ? "moon" : "sun"} /> {restAsk === "short" ? "Take a short rest?" : "Take a long rest?"}
              </div>
              <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
                {restAsk === "short"
                  ? "An hour to catch your breath. Pact slots and short-rest features recover; short-lived effects expire."
                  : "A full night's sleep. HP restored to full, every slot and feature recovered, temp HP fades, expiring effects end, exhaustion eases."}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
                <button style={{ ...btn(false), flex: 1 }} onClick={() => setRestAsk(null)}>Not yet</button>
                <button style={{ ...btn(true), flex: 1, whiteSpace: "nowrap" }} onClick={() => { (restAsk === "short" ? shortRest : longRest)(); setRestAsk(null); }}>
                  {restAsk === "short" ? "Rest an hour" : "Rest the night"}
                </button>
              </div>
            </div>
          </div>
        )}
        {concNote && (
          <div style={{ width: "100%", color: "#b48ead", fontSize: 12.5, lineHeight: 1.5 }}>
            ⚠ {concNote} <span style={{ color: T.dim, cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => setConcNote(null)}>dismiss</span>
          </div>
        )}
      </div>}

      <EffectsCard ch={ch} customs={customs} fx={fx} onUpdate={onUpdate} readOnly={shared} />

      <MinionsCard ch={ch} customs={customs} onUpdate={onUpdate} onSummon={() => setSummoning({})}
        onRoll={setRollSpec} onDice={setDmgRoll} readOnly={shared} />
      {summoning && !shared && <AddMinionSheet ch={ch} customs={customs} preset={summoning.def ? summoning : null} onUpdate={onUpdate} onClose={() => setSummoning(null)} />}

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
              const dmgBonus = mod(ch.abilities[abil]) + (hasStyle(ch, "Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0) + fxDmg(it.type === "R" ? "ranged" : "melee", abil, props).reduce((s, b) => s + b.value, 0);
              return (
                <span key={it.name} style={{ display: "inline-flex", border: `1px solid ${T.edge}`, borderRadius: 10, overflow: "hidden" }}>
                  <button {...lorePress(it.name)} style={{ ...btn(false), border: "none", borderRadius: 0, padding: "8px 12px" }}
                    onClick={() => rollIt(`${it.name} attack`, atkParts, "attack", abil, undefined, [fireAmmo(it)].filter(Boolean))}>
                    <Icon name={it.type === "R" ? "bow" : "sword"} /> {it.name} {fmtMod(atkMod)}{shillTarget(it) ? " ✦" : ""}
                    {usesAmmo(it) && <span style={{ color: T.dim, fontSize: 11 }}> ▸{(ammoRowFor(ch, customs, it) || {}).qty || 0}</span>}
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
        {(feats.critRange < 20 || feats.archery > 0 || feats.lucky) && (
          <div style={{ color: T.dim, fontSize: 11, marginTop: 8 }}>
            {[feats.critRange < 20 ? `Champion: attacks crit on ${feats.critRange}–20` : null, feats.archery ? "Archery: +2 to ranged attacks" : null, feats.lucky ? "Lucky: natural 1s reroll themselves" : null].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      <InventoryCard ch={ch} customs={customs} onUpdate={onUpdate} onConsume={consume} readOnly={shared} />

      {(slots || pact) && (
        <div style={{ ...card, padding: 16, marginTop: 14 }}>
          <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Spell Slots {!shared && <span style={{ color: T.dim, fontSize: 12, fontFamily: "inherit" }}>· tap ◆ to expend, ◇ to recover</span>}</div>
          {slots && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {slots.map((n, i) => {
                const avail = n - usedOf(i);
                return (
                  <div key={i} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid ${T.edge}` }}>
                    <div style={{ color: T.dim, fontSize: 11 }}>Level {i + 1}</div>
                    <div>
                      {Array.from({ length: n }, (_, j) => (
                        <span key={j} style={{ ...pip(j < avail, T.ink), ...(shared ? { cursor: "default" } : {}) }}
                          onClick={shared ? undefined : () => setUsed(i, j < avail ? usedOf(i) + 1 : usedOf(i) - 1)}>
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
            <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Combined caster level: full casters count fully, Paladin at half rounded down, Ranger (2024) at half rounded up. Spells known/prepared are determined per class as if single-classed.</div>
          )}
          {pact && (
            <div style={{ marginTop: slots ? 12 : 0, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div {...lorePress("Pact Magic")} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid #b48ead55` }}>
                <div style={{ color: "#b48ead", fontSize: 11 }}>Pact · level {pact.lvl}</div>
                <div>
                  {Array.from({ length: pact.n }, (_, j) => (
                    <span key={j} style={{ ...pip(j < pact.n - usedPact, "#b48ead"), ...(shared ? { cursor: "default" } : {}) }}
                      onClick={shared ? undefined : () => onUpdate({ usedPact: j < pact.n - usedPact ? usedPact + 1 : usedPact - 1 })}>
                      {j < pact.n - usedPact ? "◆" : "◇"}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ color: "#b48ead", fontSize: 13 }}>
                <span {...lorePress("Pact Magic")} style={{ textDecoration: "underline dotted", cursor: "help" }}>Pact Magic</span> is separate from spell slots · all pact slots recharge on a short rest
                <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>
                  {(ch.spells?.Warlock?.spells || []).length > 0
                    ? <>Cast with pact slots (always at level {pact.lvl}): {(ch.spells?.Warlock?.spells || []).map((n, i) => <span key={n} {...lorePress(n)} onClick={() => openUse(n)} style={{ color: T.ink, cursor: "pointer" }}>{i > 0 ? ", " : ""}{n}</span>)}</>
                    : "No warlock spells known yet — add them in the Grimoire below to have something to cast with these slots."}
                  {(ch.spells?.Warlock?.cantrips || []).length > 0 && <> · cantrips are cast at will: {(ch.spells?.Warlock?.cantrips || []).map((n, i) => <span key={n} {...lorePress(n)} onClick={() => openUse(n)} style={{ color: T.ink, cursor: "pointer" }}>{i > 0 ? ", " : ""}{n}</span>)}</>}
                </div>
              </div>
              {arcLevels.map((aLvl) => (
                <div key={aLvl} style={{ textAlign: "center", padding: "8px 12px", background: T.panel2, borderRadius: 8, border: `1px solid #b48ead55` }}>
                  <div style={{ color: "#b48ead", fontSize: 11 }}>Arcanum {aLvl}th · {arcanum[aLvl]}</div>
                  <span style={{ ...pip(!usedArc.includes(aLvl), "#b48ead"), ...(shared ? { cursor: "default" } : {}) }} onClick={shared ? undefined : () => toggleArc(aLvl)}>
                    {usedArc.includes(aLvl) ? "◇" : "◆"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <FeatureUsesCard ch={ch} customs={customs} onUpdate={onUpdate} onUse={openUse} readOnly={shared} />

      <SpellManager ch={ch} customs={customs} onSpells={onSpells} onUpdate={onUpdate} onPrepare={canPrep && !shared ? () => setPrepOpen(true) : undefined} onUse={openUse} readOnly={shared} />
      {prepOpen && <PrepareSpells ch={ch} customs={customs} onSpells={onSpells} onClose={() => setPrepOpen(false)} />}
      {!shared && <ChoiceManager ch={ch} customs={customs} onUpdate={onUpdate} />}
      <InvocationManager ch={ch} onInvocations={onInvocations} readOnly={shared} />

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
                  <span key={i} {...lorePress(f)} onClick={() => openUse(f)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "3px 9px", fontSize: 12.5, color: T.ink, cursor: "pointer", opacity: featureSpent(f) ? 0.45 : 1 }}>
                    <span style={{ color: themed, fontSize: 10.5, fontWeight: 700, opacity: 0.9 }}>{l}</span>{f}{featureSpent(f) ? <span style={{ color: T.dim, fontSize: 10.5 }}>◇ spent</span> : ""}
                  </span>
                )) : <span style={{ color: T.dim }}>—</span>;
              })()}
              {c.name === "Rogue" && <span style={{ color: T.gold }}> · Sneak Attack {Math.ceil(c.level / 2)}d6</span>}
              {c.name === "Warlock" && ch.pactBoon && <span {...lorePress(ch.pactBoon)} style={{ color: "#b48ead", cursor: "pointer" }}> · {ch.pactBoon}</span>}
              {c.name === "Warlock" && INVOCATIONS(c.level) > 0 && <span style={{ color: "#b48ead" }}> · Invocations known: {INVOCATIONS(c.level)}</span>}
            </div>
          </div>
        ))}
        <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>{shared ? "Tap or hold a feature to read it." : "Tap a feature to use it — long-press to read."} Note: Extra Attack from multiple classes doesn't stack; Unarmored Defense can only be gained once.</div>
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
          {ch.feats?.length > 0 && (
            <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Feats: {ch.feats.map((f, i) => {
              const c = featChoiceOf(ch, f);
              const detail = [
                c.bump ? `+1 ${c.bump.toUpperCase()}` : null, c.choice,
                ...(c.skills || []), ...(c.expertise || []).map((x) => `★ ${x}`), ...(c.langs || []),
                ...(c.cantrips || []), ...(c.spells || []), ...(c.maneuvers || []),
              ].filter(Boolean).join(", ");
              return (
                <span key={f}>{i > 0 ? ", " : ""}
                  <span {...lorePress(f)} onClick={() => openUse(f)} style={{ cursor: "pointer" }}>{f}</span>
                  {detail ? <span style={{ opacity: 0.75 }}> ({detail})</span> : null}
                </span>
              );
            })}</div>
          )}
          {ch.metamagic?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Metamagic: {ch.metamagic.map((m, i) => <span key={m} {...lorePress(m)} onClick={() => openUse(m)} style={{ cursor: "pointer" }}>{i > 0 ? ", " : ""}{m}</span>)}</div>}
          {ch.rangerChoices && (() => {
            const foes = [ch.rangerChoices.favEnemy, ...(ch.rangerChoices.extraEnemies || [])].filter(Boolean);
            const lands = [ch.rangerChoices.natTerrain, ...(ch.rangerChoices.extraTerrains || [])].filter(Boolean);
            return (foes.length || lands.length) ? (
              <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>
                {foes.length > 0 && <>Favored {foes.length > 1 ? "Enemies" : "Enemy"}: <span {...lorePress("Favored Enemy")} style={{ color: T.ink }}>{foes.join(", ")}</span></>}
                {foes.length > 0 && lands.length > 0 && " · "}
                {lands.length > 0 && <>Natural Explorer: {lands.join(", ")}</>}
              </div>
            ) : null;
          })()}
          {ch.choices && Object.entries(ch.choices).filter(([k]) => !CHOICE_KEYS.has(k)).map(([k, v]) => (
            <div key={k} style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>{k}: {v.map((n, i) => <span key={n} {...lorePress(n)}>{i > 0 ? ", " : ""}{n}</span>)}</div>
          ))}
          {ch.styles?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Fighting Styles: {ch.styles.map((f) => `${f} (${STYLE_DESC[f]})`).join(" · ")}</div>}
          <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Proficiencies ({ch.classes[0].name}): {PROF_TEXT[ch.classes[0].name]}{ch.classes.length > 1 ? " — plus multiclass grants (see Chronicle)" : ""}</div>
          {ch.languages?.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Languages: {ch.languages.map((l, i) => <span key={l + i} {...lorePress(l)}>{i > 0 ? ", " : ""}{l}</span>)}</div>}
          <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>Racial traits: {RACES[ch.race].traits.map((t, i) => <span key={t} {...lorePress(t.replace(/\s*\(.*$/, ""))} onClick={() => openUse(t.replace(/\s*\(.*$/, ""))} style={{ cursor: "pointer" }}>{i > 0 ? " · " : ""}{t}</span>)}{ch.racialChoices?.ancestry ? ` · ${ch.racialChoices.ancestry} dragon ancestry (${ANCESTRIES[ch.racialChoices.ancestry]})` : ""}{ch.racialChoices?.cantrip ? ` · Cantrip: ${ch.racialChoices.cantrip}` : ""}{ch.racialChoices?.lineage ? ` · Lineage gift: ${ch.racialChoices.lineage === "darkvision" ? "Darkvision 60 ft" : "an extra skill proficiency"}` : ""}</div>
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
          {shared ? (
            <div style={{ color: ch.notes ? T.ink : T.dim, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ch.notes || "No notes recorded."}</div>
          ) : (
            <textarea defaultValue={ch.notes || ""} onBlur={(e) => onNotes(e.target.value)} rows={7}
              placeholder="Equipment, personality traits, ideals, bonds, flaws, debts owed to ravens…"
              style={{ width: "100%", boxSizing: "border-box", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, resize: "vertical", fontFamily: "inherit" }} />
          )}
        </div>
        {!shared && ( /* the chronicle is play history — it stays home when a sheet is shared */
          <div style={{ ...card, padding: 16 }}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Chronicle</div>
            <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.8, maxHeight: 220, overflowY: "auto" }}>
              {ch.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>

      {rollSpec && (
        <RollTray key={JSON.stringify(rollSpec) + advMode} title={rollSpec.title} mode={advMode} parts={rollSpec.parts}
          kind={rollSpec.kind} abil={rollSpec.abil} proficient={rollSpec.proficient} extra={rollSpec.extra} ch={ch} minion={rollSpec.minion}
          onClose={() => { setRollSpec(null); setPendingDmg(null); }}
          onDamage={pendingDmg ? () => { const d = pendingDmg; setPendingDmg(null); setRollSpec(null); setDmgRoll(d); } : undefined} />
      )}
      {dmgRoll && (
        <DiceTray title={dmgRoll.title} dice={dmgRoll.dice} note={dmgRoll.note} bonus={dmgRoll.bonus} bonusLabel={dmgRoll.bonusLabel}
          acceptLabel={dmgRoll.heal ? "Apply healing" : "Done"}
          onAccept={(total) => {
            if (dmgRoll.heal && total > 0 && dmgRaw > 0) onUpdate({ dmg: Math.max(0, dmgRaw - total), log: [...(ch.log || []), `${dmgRoll.title}: healed ${Math.min(total, dmgRaw)} HP.`] });
            setDmgRoll(null);
          }} />
      )}
      {useTarget && (
        <UsePrompt key={useTarget} name={useTarget} ch={ch} customs={customs} onUpdate={onUpdate} onDice={setDmgRoll} onBlade={castBlade} onStrike={castSpellStrike} onSummon={(def, slotLvl) => setSummoning({ def, slotLvl })} onClose={() => setUseTarget(null)} />
      )}
      {drinkRoll && (
        <DiceTray title={drinkRoll.title} dice={drinkRoll.dice} bonus={drinkRoll.bonus} bonusLabel="healing"
          note="Drink to apply the healing and spend the potion" acceptLabel="Drink"
          onAccept={(total) => {
            onUpdate({ dmg: Math.max(0, dmgRaw - total), inventory: decremented(drinkRoll.row), log: [...(ch.log || []), `Drank ${drinkRoll.row.name} — healed ${Math.min(total, dmgRaw)} HP.`] });
            setDrinkRoll(null);
          }} />
      )}
      {helpOpen && <GuideSheet onClose={() => setHelpOpen(false)} />}
      {shareOpen && <ShareSheet ch={ch} customs={customs} onClose={() => setShareOpen(false)} />}
    </div>
  );
}



/* ============ COMPENDIUM XML IMPORT ============ */
/* Fold a parsed compendium into stored custom content: duplicates are skipped unless the
   incoming copy carries rules text the stored one lacks (same rules as the Forge import). */
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
  out.spells = foldStarredSpells(out.spells);

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
/* scripts/bake-compendium.cjs drives the app's own parser to regenerate public/compendium.json */
if (typeof window !== "undefined") window.__parseCompendium = parseCompendiumXML;

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
/* ============ ACCOUNT — one ledger, every device ============ */
/* Lives in the tools drawer. The sync module (src/sync.js) arrives lazily
   and only when sync-config.js names a server, so this renders nothing on
   a purely local build. */
function CloudAccount({ cloud, account, syncState, onAccount, toolRow, hint }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!cloud) return null;
  const go = (fn) => async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try { await fn(email, pw); onAccount(cloud.getAccount()?.email || null); setOpen(false); }
    catch (err) { setMsg(err.message); }
    finally { setBusy(false); }
  };
  if (account) return (
    <div style={{ ...toolRow, cursor: "default" }}>
      <span title={syncState === "live" ? "Synced live" : "Waiting for signal"}
        style={{ width: 9, height: 9, borderRadius: "50%", flex: "0 0 auto", background: syncState === "live" ? "#7fb069" : T.dim, boxShadow: syncState === "live" ? "0 0 6px #7fb06988" : "none" }} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account}</span>
      <span style={{ ...hint, cursor: "pointer", textDecoration: "underline dotted" }}
        onClick={() => { cloud.signOut(); onAccount(null); }}>sign out</span>
    </div>
  );
  if (!open) return (
    <button style={toolRow} onClick={() => setOpen(true)}>
      <Icon name="share" size={15} /> Account sync <span style={hint}>live across devices</span>
    </button>
  );
  const field = { width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 15, background: "#241a10", color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 6, outline: "none" };
  const actBtn = (solid) => ({ flex: 1, padding: "9px 0", fontSize: 14, fontFamily: "inherit", borderRadius: 6, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
    background: solid ? T.gold : "transparent", color: solid ? "#141210" : T.gold, border: `1px solid ${T.gold}` });
  return (
    <form onSubmit={go(cloud.signIn)} style={{ display: "grid", gap: 8, padding: "9px 12px" }}>
      <input type="email" required autoFocus placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
      <input type="password" required minLength={8} placeholder="password" value={pw} onChange={(e) => setPw(e.target.value)} style={field} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={actBtn(true)}>Sign in</button>
        <button type="button" disabled={busy} onClick={go(cloud.register)} style={actBtn(false)}>Create account</button>
      </div>
      {msg && <div style={{ color: "#d76a76", fontSize: 12.5 }}>{msg}</div>}
    </form>
  );
}

export default function App() {
  const [chars, setChars] = useState(null);
  const [view, setView] = useState("roster");
  const [activeId, setActiveId] = useState(null);
  const [leveling, setLeveling] = useState(false);
  const [customs, setCustoms] = useState(EMPTY_CUSTOM);
  const [ioMsg, setIoMsg] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false); // the quiet drawer: homebrew, export, import
  const [srcOff, setSrcOff] = useState(() => new Set()); // sourcebooks turned off
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [cloud, setCloud] = useState(null);     // the lazily-loaded sync module
  const [account, setAccount] = useState(null); // signed-in email
  const [syncState, setSyncState] = useState("offline");
  const stateRef = useRef({});                  // live state for the sync handlers
  stateRef.current = { chars, customs, srcOff };
  const applySrcOff = (next) => { __SRC_OFF = next; setSrcOff(next); saveSrcPrefs(next); cloud?.pushPrefs([...next]); };
  const toggleSource = (name) => {
    const next = new Set(srcOff);
    next.has(name) ? next.delete(name) : next.add(name);
    applySrcOff(next);
  };

  useEffect(() => {
    (async () => {
      const [cs, stored, base, srcPrefs] = await Promise.all([loadChars(), loadCustom(), fetchBaseCompendium(), loadSrcPrefs()]);
      __SRC_OFF = srcPrefs;
      setSrcOff(srcPrefs);
      let effective = stored;
      if (base) {
        // stored customs layer over the built-in compendium; the user's versions win
        effective = mergeCompendium(stored, base).customs;
        const slim = stripBase(stored, base);
        // legacy stores carried a full imported copy of the base — shed it once
        const shrunk = (stored.spells || []).length !== slim.spells.length || (stored.items || []).length !== slim.items.length
          || (stored.feats || []).length !== slim.feats.length || Object.keys(stored.featureTexts || {}).length !== Object.keys(slim.featureTexts).length
          || Object.values(stored.subs || {}).flat().length !== Object.values(slim.subs).flat().length;
        if (shrunk) saveCustom(slim);
      }
      // legacy stores (or imports parsed before the fold) may still carry starred twins
      effective = { ...effective, spells: foldStarredSpells(effective.spells || []) };
      setCustoms(effective);

      // characters may reference spells by their old starred names — point them at the plain entry
      const names = new Set(effective.spells.map((sp) => sp.name));
      let starFixes = 0;
      const fixName = (n) => {
        if (typeof n === "string" && /\*$/.test(n)) {
          const plain = n.replace(/\*+$/, "");
          if (!names.has(n) && names.has(plain)) { starFixes++; return plain; }
        }
        return n;
      };
      const deStarChar = (ch) => ({
        ...ch,
        spells: Object.fromEntries(Object.entries(ch.spells || {}).map(([cls, b]) => [cls, {
          ...b,
          cantrips: (b.cantrips || []).map(fixName),
          spells: (b.spells || []).map(fixName),
          ...(b.arcanum ? { arcanum: Object.fromEntries(Object.entries(b.arcanum).map(([l, n]) => [l, fixName(n)])) } : {}),
        }])),
        ...(ch.boasRituals ? { boasRituals: ch.boasRituals.map(fixName) } : {}),
        ...(ch.tomeCantrips ? { tomeCantrips: ch.tomeCantrips.map(fixName) } : {}),
        ...(ch.racialChoices?.cantrip ? { racialChoices: { ...ch.racialChoices, cantrip: fixName(ch.racialChoices.cantrip) } } : {}),
        ...(ch.choices ? { choices: Object.fromEntries(Object.entries(ch.choices).map(([k, v]) => [k, Array.isArray(v) ? v.map(fixName) : v])) } : {}),
      });
      const migrated = cs.map(deStarChar);
      if (starFixes) saveChars(migrated);
      setChars(starFixes ? migrated : cs);
    })();
  }, []);
  /* ---- account sync: module boots lazily once the vault is open ---- */
  const booted = chars !== null;
  useEffect(() => {
    if (!booted || !SYNC_URL) return;
    import("./sync.js").then((m) => { setCloud(m); setAccount(m.getAccount()?.email || null); });
  }, [booted]);
  useEffect(() => {
    if (!cloud || !account) return;
    return cloud.start({
      getLocal: () => ({ chars: stateRef.current.chars || [], custom: stripBase(stateRef.current.customs, __BASE), prefs: [...stateRef.current.srcOff] }),
      chars: (arr) => { setChars(arr); saveChars(arr); },
      custom: (stored) => {
        const eff = __BASE ? mergeCompendium(stored, __BASE).customs : stored;
        const folded = { ...eff, spells: foldStarredSpells(eff.spells || []) };
        setCustoms(folded); saveCustom(stripBase(folded, __BASE));
      },
      prefs: (off) => { const s = new Set(off); __SRC_OFF = s; setSrcOff(s); saveSrcPrefs(s); },
      photo: (id, p) => { // an oversized portrait was re-shrunk for the wire; the local copy follows
        const next = (stateRef.current.chars || []).map((c) => (c.id === id ? { ...c, photo: p } : c));
        setChars(next); saveChars(next);
      },
      status: setSyncState,
      error: setIoMsg,
      signedOut: () => setAccount(null),
    });
  }, [cloud, account]);

  const persistCustom = (next) => { setCustoms(next); const s = stripBase(next, __BASE); saveCustom(s); cloud?.pushCustom(s); };
  const persist = (next) => { setChars(next); saveChars(next); cloud?.pushChars(next); };

  if (chars === null) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontFamily: "Georgia, serif" }}>
      Unsealing the vault…
    </div>
  );

  const active = chars.find((c) => c.id === activeId);

  return (
    <div style={SHELL_STYLE}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ textAlign: "center", padding: "26px 14px 6px", position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, color: T.gold, letterSpacing: 1 }}>The Adventurer's Ledger</div>
        <div style={{ color: T.dim, fontSize: 13 }}>5e SRD character forge · full multiclass rules</div>
      </div>

      {view === "roster" && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 20, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <button onClick={() => setView("create")}
              style={{
                flex: 1, minWidth: 0, cursor: "pointer", textAlign: "center", padding: "15px 18px",
                borderRadius: 14, border: "1px solid #c9a44c55",
                background: `linear-gradient(150deg, #a44b57, ${T.blood} 46%, #612a33)`,
                boxShadow: "0 6px 22px #8e3b4652, inset 0 1px 0 #e8dfd02e",
                color: T.ink, fontFamily: "Georgia, serif",
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Icon name="d20" size={19} /> Forge a New Character
              </div>
            </button>
            <button aria-label="Sourcebooks" title="Enable or disable sourcebooks" onClick={() => setSourcesOpen(true)}
              style={{ flex: "0 0 auto", width: 48, borderRadius: 14, border: `1px solid ${srcOff.size ? T.gold : T.edge}`, background: T.panel,
                color: srcOff.size ? T.gold : T.dim, lineHeight: 1, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
              <Icon name="gear" size={19} style={{ marginRight: 0 }} /></button>
            <button aria-label="Ledger tools" title="Homebrew, export & import" onClick={() => setToolsOpen(!toolsOpen)}
              style={{ flex: "0 0 auto", width: 48, borderRadius: 14, border: `1px solid ${toolsOpen ? T.gold : T.edge}`, background: T.panel,
                color: toolsOpen ? T.gold : T.dim, fontSize: 22, lineHeight: 1, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>⋯</button>
          </div>
          {toolsOpen && (() => {
            const toolRow = { display: "flex", gap: 10, alignItems: "center", width: "100%", boxSizing: "border-box", minHeight: 44, padding: "9px 12px",
              background: "transparent", border: "none", borderRadius: 8, color: T.ink, fontSize: 14, fontFamily: "inherit", fontWeight: 400,
              cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" };
            const hint = { color: T.dim, fontSize: 12, marginLeft: "auto", textAlign: "right", whiteSpace: "nowrap" };
            const cantExport = chars.length === 0 && customs.feats.length === 0 && customs.spells.length === 0;
            return (
              <div style={{ ...card, marginTop: 8, padding: 6 }}>
                <button style={{ ...toolRow, whiteSpace: "nowrap" }} onClick={() => { setToolsOpen(false); setView("forge"); }}>
                  <Icon name="hammer" size={15} /> Homebrew Forge <span style={hint}>subclasses, feats & more</span>
                </button>
                <button style={{ ...toolRow, opacity: cantExport ? 0.45 : 1, cursor: cantExport ? "default" : "pointer" }} disabled={cantExport}
                  onClick={() => exportLedger(chars, stripBase(customs, __BASE))}>
                  <Icon name="down" size={15} /> Export ledger <span style={hint}>every soul, one file</span>
                </button>
                <label style={toolRow}>
                  <Icon name="up" size={15} /> Import ledger <span style={hint}>merge a saved file</span>
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
                <CloudAccount cloud={cloud} account={account} syncState={syncState} onAccount={setAccount} toolRow={toolRow} hint={hint} />
                {ioMsg && <div style={{ color: T.dim, fontSize: 13, padding: "4px 12px 8px" }}>{ioMsg}</div>}
              </div>
            );
          })()}
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

      {view === "roster" && <HorizonArt />}

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
          onDelete={() => { cloud?.deleteChar(active.id); persist(chars.filter((c) => c.id !== active.id)); setView("roster"); }}
          onPhoto={(p) => persist(chars.map((c) => (c.id === active.id ? { ...c, photo: p } : c)))}
          onSources={() => setSourcesOpen(true)} />
      )}

      {leveling && active && (
        <LevelUp ch={active} customs={customs} onCancel={() => setLeveling(false)}
          onDone={(next) => { persist(chars.map((c) => (c.id === next.id ? next : c))); setLeveling(false); }} />
      )}

      {sourcesOpen && (
        <SourcebookSheet customs={customs} off={srcOff} onToggle={toggleSource}
          onEnableAll={() => applySrcOff(new Set())} onClose={() => setSourcesOpen(false)} />
      )}

      <LoreSheet customs={customs} />
    </div>
  );
}

/* ============ THE SHARED SHEET — a read-only window on one soul ============ */
/* Rendered instead of the gated app when the URL carries a #share= fragment
   (main.jsx makes that call). The character lives only in memory here: dice
   and trackers work at the table, but a refresh restores the snapshot, and
   the owner's ledger is a world away. Reusing <Sheet/> keeps this view
   pixel-identical to the owner's — and every future sheet feature arrives
   in shared links for free. */
export function SharedView({ token, onExit }) {
  // viewers are often ledger-keepers themselves — this door steps back into the
  // app in place, no reload, their own vault untouched
  const ledgerDoor = onExit && (
    <span onClick={onExit} style={{ color: T.gold, cursor: "pointer", textDecoration: "underline dotted", whiteSpace: "nowrap" }}>
      Open your own ledger →
    </span>
  );
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [payload, base] = await Promise.all([decodeShare(token), fetchBaseCompendium()]);
        // the traveling homebrew slice layers over the base compendium, exactly as the owner's does
        const customs = base ? mergeCompendium(payload.x, base).customs : payload.x;
        if (!live) return;
        // the tab and any bookmark name the soul, not just the app
        document.title = `${payload.c.name} · ${payload.c.classes.map((c) => `${c.name} ${c.level}`).join(" / ")} — The Adventurer's Ledger`;
        setState({ status: "ok", ch: payload.c, customs, when: payload.t });
      } catch {
        if (!live) return;
        document.title = "A faded link — The Adventurer's Ledger";
        setState({ status: "error" });
      }
    })();
    return () => { live = false; };
  }, [token]);
  const patchCh = (patch) => setState((s) => (s.status === "ok" ? { ...s, ch: { ...s.ch, ...patch } } : s));
  const shell = (body) => (
    <div style={SHELL_STYLE}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ textAlign: "center", padding: "26px 14px 6px", position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, color: T.gold, letterSpacing: 1 }}>The Adventurer's Ledger</div>
        <div style={{ color: T.dim, fontSize: 13 }}>a character sheet, shared</div>
      </div>
      {body}
    </div>
  );
  if (state.status === "loading") return shell(
    <div style={{ padding: 60, textAlign: "center", color: T.dim, fontFamily: "Georgia, serif" }}>Unsealing the scroll…</div>
  );
  if (state.status === "error") return shell(
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 20 }}>
      <div style={{ ...card, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>🕯️</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold }}>This link has faded</div>
        <div style={{ color: T.dim, fontSize: 13.5, lineHeight: 1.7, marginTop: 10 }}>
          It doesn't hold a character this ledger can read. Links sometimes arrive clipped by messaging apps,
          and older browsers lack the craft to unseal them — ask for a fresh link, or open this one in a current browser.
        </div>
        {ledgerDoor && <div style={{ fontSize: 13.5, marginTop: 14 }}>{ledgerDoor}</div>}
      </div>
    </div>
  );
  const { ch, customs, when } = state;
  return shell(
    <>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 20px 0" }}>
        <div style={{ ...card, padding: "12px 16px", borderColor: `${T.gold}55`, color: T.dim, fontSize: 13, lineHeight: 1.6 }}>
          <Icon name="eye" size={14} style={{ color: T.gold }} />
          A snapshot of <b style={{ color: T.ink }}>{ch.name}</b>{when ? `, shared ${when}` : ""}, sealed the day it was shared.
          Tap anything to roll its dice, hold anything to read its rules — but the sheet itself cannot be changed, here or anywhere.
          {ledgerDoor && <> {ledgerDoor}</>}
        </div>
      </div>
      <Sheet shared ch={ch} customs={customs}
        onUpdate={patchCh}
        onSpells={(sp) => patchCh({ spells: sp })}
        onInvocations={(inv) => patchCh({ invocations: inv })} />
      <LoreSheet customs={customs} />
    </>
  );
}
