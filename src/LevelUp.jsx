import { ABILITIES, ALL_SKILLS, CANTRIPS_KNOWN, CLASSES, FAVORED_ENEMIES, FIGHTING_STYLES, INVOCATIONS, INVOCATION_DATA, LAND_TERRAINS, LANGS, MC_PREREQ, MC_PROFS, MC_SKILL_GRANT, METAMAGIC, PACT_BOONS, SPELLS_KNOWN, STYLE_DESC, baseSubName } from "./data.js";
import { allChoiceGroups, allFeats, allKnownCantrips, allSubFeats, allSubs, choiceCum, gearProfsOf, subclassProfsAt, choiceOptionsFor, featPickDone, featPickOf, fmtMod, groupMatches, hasStyle, isTechnique, maxSpellLevel, meetsPrereq, mod, profBonus, spellFitsClass, totalLevel } from "./rules.js";
import { isSourceEnabled, srcSpells } from "./compendium.js";
import { useEffect, useRef, useState } from "react";
import { ClassTag, FeatChooser, FeatureLine, Icon, Portrait, SpellPickGrid, SubclassDetail, T, btn, card, lorePress } from "./ui.jsx";
import { DiceTray, roll } from "./dice.jsx";
function LevelUp({ ch, onDone, onCancel, customs }) {
  const lvl = totalLevel(ch);
  const [stage, setStage] = useState("class");
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [stage]);
  const [pick, setPick] = useState(() => [...ch.classes].sort((a, b) => b.level - a.level)[0]?.name || null);
  const [rollingHp, setRollingHp] = useState(false);
  const [hpGain, setHpGain] = useState(null);
  const [asiMode, setAsiMode] = useState(null);
  const [asiPicks, setAsiPicks] = useState([]);
  const [featSel, setFeatSel] = useState(null);
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
  const [boasPicks, setBoasPicks] = useState([]);
  const [tomePicks, setTomePicks] = useState([]);
  const [secretsPicks, setSecretsPicks] = useState([]);
  const [favEnemyPick, setFavEnemyPick] = useState(null);
  const [feHumanoids, setFeHumanoids] = useState("");
  const [favLang2, setFavLang2] = useState(null);
  const [terrainPick2, setTerrainPick2] = useState(null);
  const [deftExp, setDeftExp] = useState(null);
  const [deftLangs, setDeftLangs] = useState([]);
  const [subSkillPicks, setSubSkillPicks] = useState({});
  const [masteryPicks, setMasteryPicks] = useState({});
  const [signaturePicks, setSignaturePicks] = useState([]);
  const [groupPicks, setGroupPicks] = useState({});

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
    ...Object.keys(CLASSES).filter((n) => isSourceEnabled(CLASSES[n]) && !ch.classes.some((c) => c.name === n)),
  ];
  const options = classOrder.map((name) => {
    const isNew = !existing.includes(name);
    let ok = true, why = "";
    if (isNew) {
      if (!currentOk) { ok = false; why = "Current class prerequisites unmet — cannot multiclass"; }
      else if (!meetsPrereq(name, ch.abilities)) {
        ok = false;
        why = "Requires " + (MC_PREREQ[name] || [{ int: 13 }]).map((r) => Object.entries(r).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" & ")).join(" or ");
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
    subProfsNow.forEach((p) => { const got = [...(p.skills || []), ...(p.skillChoice || []).flatMap((c, i) => subSkillPicks[`${p.feature}:${i}`] || [])]; if (got.length) logBits.push(`${p.feature}: ${got.join(", ")}`); });
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
    const skills = [...ch.skills, ...(mcSkill ? [mcSkill] : []), ...featSkills, ...grantAll, ...subFixedSkills, ...Object.values(subSkillPicks).flat()].filter((v, i, a) => a.indexOf(v) === i);
    const languages = [...(ch.languages || []), ...(asiMode === "feat" ? [...(featSel?.langs || []), ...(featPk?.grantLangs || [])] : []), ...deftLangs, ...(favLang2 ? [favLang2] : [])].filter((v, i, a) => a.indexOf(v) === i);
    const expertise = [...(ch.expertise || []), ...expPicks, ...(asiMode === "feat" ? featSel?.expertise || [] : []), ...(deftExp ? [deftExp] : [])].filter((v, i, a) => a.indexOf(v) === i);
    const featChoices = asiMode === "feat" && featPick
      ? { ...(ch.featChoices || {}), [featPick]: {
          bump: featBump || null, skills: featSkills, choice: featSel.choice || null,
          expertise: featSel.expertise || [], langs: featSel.langs || [],
          cantrips: featSel.cantrips || [], spells: featSel.spells || [], maneuvers: featSel.maneuvers || [], weapons: featSel.weapons || [],
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
  const styleOptions = gainsStyle ? (FIGHTING_STYLES[styleClass] || []).filter((f) => !hasStyle(ch, f)) : [];
  const gainsTerrain = gainsSub && newSub === "Circle of the Land";
  const gainsExpertise = feats.some((f) => f.startsWith("Expertise"));
  const expPool = ch.skills.filter((sk) => !(ch.expertise || []).includes(sk));
  const gainsMeta = pick === "Sorcerer" && feats.some((f) => f.startsWith("Metamagic"));
  const metaNeed = newClsLevel === 3 ? 2 : 1;
  const metaPool = METAMAGIC.filter((m) => !(ch.metamagic || []).includes(m));
  const gainsBoon = feats.some((f) => f === "Pact Boon");

  const effSub = gainsSub ? (gainsTerrain && terrPick ? `${newSub} (${terrPick})` : newSub) : entry?.subclass;
  const book = ch.spells?.[pick] || { cantrips: [], spells: [] };
  const pool = srcSpells(customs?.spells || []);
  const fits = (sp) => spellFitsClass(sp, pick, effSub);

  const curInv = ch.invocations || [];
  const invCap = pick === "Warlock" ? INVOCATIONS(newClsLevel) : 0;
  const invNeed = Math.max(0, invCap - curInv.length);
  const canSwapInv = pick === "Warlock" && invCap > 0 && curInv.length > 0;
  const futureCantrips = [...(book.cantrips || []), ...cantripPicks];
  const hasEB = futureCantrips.some((n) => /eldritch blast/i.test(n));
  const boonHeld = boonPick || ch.pactBoon;
  const invReqMet = (req) => !req || (req === "eldritch blast cantrip" ? hasEB : boonHeld === req);
  const invTaken = [...curInv.filter((n) => n !== invSwapOut), ...invPicks, ...(invSwapIn ? [invSwapIn] : [])];
  const invOptions = INVOCATION_DATA.filter(([n, lvl, req, src, sources]) => newClsLevel >= lvl && !invTaken.includes(n) && isSourceEnabled({ src, sources }));

  const sortSp = (a, b) => a.level - b.level || a.name.localeCompare(b.name);
  const cantripTarget = CANTRIPS_KNOWN[pick] ? CANTRIPS_KNOWN[pick](newClsLevel) : 0;
  const cantripPrev = entry && CANTRIPS_KNOWN[pick] ? CANTRIPS_KNOWN[pick](newClsLevel - 1) : 0;
  const cantripAllow = Math.max(0, cantripTarget - (book.cantrips || []).length);
  const knownCans = allKnownCantrips(ch, customs);
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

  const arcLvlGained = pick === "Warlock" ? { 11: 6, 13: 7, 15: 8, 17: 9 }[newClsLevel] : null;
  const arcPool = arcLvlGained && !ch.spells?.Warlock?.arcanum?.[arcLvlGained]
    ? pool.filter((sp) => sp.level === arcLvlGained && fits(sp)).sort(sortSp) : [];
  const gainsArcanum = arcPool.length > 0;

  const takingBoAS = invPicks.includes("Book of Ancient Secrets") || invSwapIn === "Book of Ancient Secrets";
  const boasPool = takingBoAS && !(ch.boasRituals || []).length
    ? pool.filter((sp) => sp.level === 1 && sp.ritual && !boasPicks.includes(sp.name)).sort(sortSp) : [];
  const gainsBoAS = boasPool.length > 0 || boasPicks.length > 0;

  const tomePool = boonPick === "Pact of the Tome"
    ? pool.filter((sp) => sp.level === 0 && !knownCans.includes(sp.name) && !cantripPicks.includes(sp.name)).sort(sortSp) : [];
  const gainsTome = tomePool.length > 0;

  const secretsN = pick === "Bard"
    ? ([10, 14, 18].includes(newClsLevel) ? 2 : 0) + (baseSubName(effSub || "") === "College of Lore" && newClsLevel === 6 ? 2 : 0) : 0;
  const secretsPool = secretsN > 0
    ? pool.filter((sp) => !isTechnique(sp) && sp.level >= 1 && sp.level <= maxLvlNew && !(book.spells || []).includes(sp.name) && !spellPicks.includes(sp.name)).sort(sortSp) : [];
  const gainsSecrets = secretsPool.length > 0 || secretsPicks.length > 0;
  const secretsReq = Math.min(secretsN, secretsPool.length + secretsPicks.length);
  const countedSecrets = pick === "Bard" && [10, 14, 18].includes(newClsLevel) ? 2 : 0;
  const spellReqNet = Math.max(0, Math.min(spellReq, spellAllow - Math.min(countedSecrets, secretsPicks.length)));

  const rc = ch.rangerChoices || {};
  const enemiesTaken = [rc.favEnemy, ...(rc.extraEnemies || [])].filter(Boolean);
  const terrainsTaken = [rc.natTerrain, ...(rc.extraTerrains || [])].filter(Boolean);
  const gainsFavEnemy = pick === "Ranger" && [6, 14].includes(newClsLevel);
  const gainsNatTerrain = false;
  const gainsDeft = pick === "Ranger" && newClsLevel === 2;
  // Skills a subclass feature grants at this level: fixed ones arrive on their own, picks need a choice.
  const subProfsNow = subclassProfsAt(pick, newSub || entry?.subclass, newClsLevel, customs);
  const subFixedSkills = subProfsNow.flatMap((p) => p.skills || []).filter((s) => !ch.skills.includes(s));
  const subSkillChoices = subProfsNow.flatMap((p) => (p.skillChoice || []).map((c, i) => ({ key: `${p.feature}:${i}`, feature: p.feature, n: c.n, from: c.from.length ? c.from : ALL_SKILLS })));
  const gainsSubSkills = subSkillChoices.length > 0;

  const spLevel = (n) => pool.find((sp) => sp.name === n)?.level;
  const masteryPools = pick === "Wizard" && newClsLevel === 18 && !ch.choices?.["Spell Mastery"]
    ? { 1: (book.spells || []).filter((n) => spLevel(n) === 1), 2: (book.spells || []).filter((n) => spLevel(n) === 2) } : null;
  const gainsMastery = !!masteryPools && (masteryPools[1].length > 0 || masteryPools[2].length > 0);
  const signaturePool = pick === "Wizard" && newClsLevel === 20 && !ch.choices?.["Signature Spell"]
    ? (book.spells || []).filter((n) => spLevel(n) === 3) : [];
  const gainsSignature = signaturePool.length > 0;

  const choiceGroupsDue = allChoiceGroups(customs).map((g) => {
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
    gainsBoAS || gainsTome || gainsSecrets || gainsDeft || gainsSubSkills || gainsFavEnemy || gainsMastery || gainsSignature ||
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
    (!gainsDeft || (deftExp && deftLangs.length === 2)) && subSkillChoices.every((c) => (subSkillPicks[c.key] || []).length === c.n) &&
    (!gainsFavEnemy || (favEnemyPick && (favEnemyPick !== "Two humanoid races" || feHumanoids.trim()) && favLang2)) &&
    (!gainsMastery || ((masteryPools[1].length === 0 || masteryPicks[1]) && (masteryPools[2].length === 0 || masteryPicks[2]))) &&
    (!gainsSignature || signaturePicks.length >= Math.min(2, signaturePool.length)) &&
    choiceGroupsDue.every((d) => (groupPicks[d.g.key] || []).length >= d.need);

  return (
    <div ref={scrollRef} style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 50, overflowY: "auto", padding: "calc(30px + env(safe-area-inset-top)) 14px calc(30px + env(safe-area-inset-bottom))" }}>
      <div style={{ ...card, maxWidth: 640, margin: "0 auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Portrait photo={ch.photo} portrait={ch.portrait} size={64} name={ch.name} />
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.gold, marginBottom: 4 }}>Level {lvl} → {lvl + 1}</div>
            <div style={{ color: T.dim, fontSize: 13 }}>{ch.name} · proficiency bonus becomes +{profBonus(lvl + 1)}</div>
          </div>
        </div>

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
                    held={ch.feats || []} styles={ch.styles || []} skillsTaken={[...ch.skills, ...(mcSkill ? [mcSkill] : [])]} gearProfs={gearProfsOf(ch, customs)}
                    knownCantrips={allKnownCantrips(ch, customs)} knownLangs={ch.languages || []} profSkills={ch.skills}
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
            {subSkillChoices.map((c) => {
              const picked = subSkillPicks[c.key] || [];
              const taken = [...ch.skills, ...(mcSkill ? [mcSkill] : []), ...subFixedSkills, ...Object.entries(subSkillPicks).filter(([k]) => k !== c.key).flatMap(([, v]) => v)];
              return (
                <div key={c.key} style={{ ...card, background: T.panel2, padding: 14, marginBottom: 12 }}>
                  <div style={{ color: T.gold, marginBottom: 8 }}>{c.feature} — choose {c.n} skill{c.n > 1 ? "s" : ""} ({picked.length}/{c.n})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {c.from.filter((sk) => !taken.includes(sk)).map((sk) => (
                      <button key={sk} style={{ ...btn(picked.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                        onClick={() => setSubSkillPicks({ ...subSkillPicks, [c.key]: picked.includes(sk) ? picked.filter((x) => x !== sk) : picked.length < c.n ? [...picked, sk] : picked })}>{sk}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            {subFixedSkills.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>Your {pickData?.subName?.toLowerCase() || "subclass"} grants proficiency in {subFixedSkills.join(" and ")}.</div>}
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
export { LevelUp };
