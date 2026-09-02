import { ABILITIES, ABIL_MAX, ABIL_MIN, ABIL_NAMES, ALIGNMENTS, ALL_SKILLS, ANCESTRIES, BACKGROUNDS, CANTRIPS_KNOWN, CLASSES, FAVORED_ENEMIES, FEAT_MECHANICS, FIGHTING_STYLES, GEAR_LISTS, ITEM_TYPES, LANGS, PB_COST, RACES, RACE_LANGS, STARTING_GEAR, START_GOLD, STD_ARRAY, STYLE_DESC } from "./data.js";
import { allChoiceGroups, allFeats, allSubs, canEquip, choiceCum, choiceOptionsFor, groupMatches, featGrantedSpells, featPickDone, featPickOf, findItem, subclassProfsAt, fmtMod, formatStandardRaceBonus, getDefaultRacialSlots, getRacialBonusPool, isArmorType, isWeaponType, mod, searchRank, spellCapacity, spellFitsClass } from "./rules.js";
import { isSourceEnabled, srcSpells, uid } from "./compendium.js";
import { useEffect, useState } from "react";
import { ClassDetail, ClassTag, FeatChooser, Icon, LazyList, Portrait, SubclassDetail, PortraitButton, T, btn, card, lorePress } from "./ui.jsx";
import { DiceTray, roll } from "./dice.jsx";

// Albert Bierstadt, On the Plains, Sunset (public domain)

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
function OriginAsiPicker({
  race,
  raceData,
  customOrigin,
  setCustomOrigin,
  slots,
  setSlots,
  raceAbilPicks,
  setRaceAbilPicks,
  scores,
  extra = {},
}) {
  const pool = getRacialBonusPool(raceData, race);
  const defaultSlots = getDefaultRacialSlots(raceData, race);
  const activeSlots = slots && slots.length === pool.length ? slots : defaultSlots;

  const handleSelect = (slotIdx, abil) => {
    const current = [...activeSlots];
    const existingIdx = current.indexOf(abil);
    if (existingIdx === slotIdx) return;
    if (existingIdx !== -1) {
      current[existingIdx] = current[slotIdx];
      current[slotIdx] = abil;
    } else {
      current[slotIdx] = abil;
    }
    setSlots(current);
  };

  return (
    <div style={{ ...card, padding: 14, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 16 }}>
          Racial Ability Bonuses · {race}
        </div>
        <div role="group" aria-label="Racial ability bonus method" style={{ display: "inline-flex", gap: 4, background: T.panel, padding: 3, borderRadius: 8, border: `1px solid ${T.edge}` }}>
          <button
            type="button"
            className="account-control"
            aria-pressed={!customOrigin}
            style={{ ...btn(!customOrigin), padding: "5px 10px", fontSize: 12, minHeight: 0 }}
            onClick={() => setCustomOrigin(false)}
          >
            Standard ({formatStandardRaceBonus(raceData, race)})
          </button>
          <button
            type="button"
            className="account-control"
            aria-pressed={customOrigin}
            style={{ ...btn(customOrigin), padding: "5px 10px", fontSize: 12, minHeight: 0 }}
            onClick={() => {
              if (!customOrigin && (!slots || slots.length !== pool.length)) {
                setSlots(defaultSlots);
              }
              setCustomOrigin(true);
            }}
          >
            Custom Origin (Tasha's)
          </button>
        </div>
      </div>

      {!customOrigin ? (
        <div>
          <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.5 }}>
            {race === "Human"
              ? "Human traits grant +1 to all six ability scores."
              : `Standard ${race} racial bonuses: ${Object.entries(raceData.bonus || {}).filter(([, v]) => v > 0).map(([a, v]) => `+${v} ${ABIL_NAMES[a]}`).join(", ") || "chosen bonuses below"}.`}
          </div>
          {raceData.choose > 0 && (
            <div style={{ marginTop: 10 }}>
              <LineageBonusPicker raceData={raceData} picks={raceAbilPicks} setPicks={setRaceAbilPicks} scores={scores} extra={extra} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.5 }}>
            <b style={{ color: T.gold }}>Tasha's Origin Customization:</b> Reallocate your race's {pool.map((v) => `+${v}`).join(", ")} bonuses to any ability scores. Each bonus must apply to a different score.
          </div>
          {pool.map((bonusVal, slotIdx) => {
            const currentAbil = activeSlots[slotIdx];
            return (
              <div key={slotIdx} style={{ display: "grid", gap: 6 }}>
                <div style={{ color: T.gold, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ padding: "2px 7px", background: T.blood, color: T.ink, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>+{bonusVal}</span>
                  <span>Assign to {slotIdx === 0 && pool.length > 1 ? "primary" : "secondary"} ability</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ABILITIES.map((a) => {
                    const isSelected = currentAbil === a;
                    const otherSlotIdx = activeSlots.findIndex((x, idx) => idx !== slotIdx && x === a);
                    const isUsedElsewhere = otherSlotIdx !== -1;
                    const baseScore = scores ? scores[a] + (extra[a] || 0) : null;
                    return (
                      <button
                        key={a}
                        type="button"
                        className="account-control"
                        aria-pressed={isSelected}
                        style={{
                          ...btn(isSelected),
                          padding: "6px 12px",
                          fontSize: 13,
                          borderColor: isSelected ? T.gold : isUsedElsewhere ? T.edge : T.edge,
                          opacity: isSelected ? 1 : isUsedElsewhere ? 0.65 : 1,
                        }}
                        onClick={() => handleSelect(slotIdx, a)}
                        title={isUsedElsewhere ? `Currently receiving +${pool[otherSlotIdx]} — tap to swap` : undefined}
                      >
                        {ABIL_NAMES[a]}
                        {isSelected && ` (+${bonusVal})`}
                        {isUsedElsewhere && ` (+${pool[otherSlotIdx]})`}
                        {baseScore !== null && isSelected && ` → ${baseScore + bonusVal}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function AbilityStep({ scores, setScores, method, setMethod, bonuses = {}, featBonus = {}, featLabel = "feat", children }) {
  const lift = (a) => (bonuses[a] || 0) + (featBonus[a] || 0);
  const [rolling, setRolling] = useState(null);
  const [rolled, setRolled] = useState([]);
  const [assignIdx, setAssignIdx] = useState({});
  const [typed, setTyped] = useState({});

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
function HorizonArt() {
  return <div className="horizon" aria-hidden="true" />;
}
function CreateWizard({ onDone, onCancel, customs }) {
  const [step, setStep] = useState(0);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState({ photo: null, portrait: null });
  const [race, setRace] = useState("Human");
  const [raceAbilPicks, setRaceAbilPicks] = useState([]);
  const [customOriginAsi, setCustomOriginAsi] = useState(false);
  const [customAsiSlots, setCustomAsiSlots] = useState([]);
  const [raceFeat, setRaceFeat] = useState(null);
  const [lineageTrait, setLineageTrait] = useState(null);
  const [cls, setCls] = useState("Fighter");
  const [subclass, setSubclass] = useState(null);
  const [skills, setSkills] = useState([]);
  const [subSkillPicks, setSubSkillPicks] = useState({});
  const [groupPicks1, setGroupPicks1] = useState({});
  const [alignment, setAlignment] = useState("True Neutral");
  const [bg, setBg] = useState("Acolyte");
  const [bgSkills, setBgSkills] = useState([]);
  const [style, setStyle] = useState(null);
  const [terrain, setTerrain] = useState(null);
  const [gold, setGold] = useState(null);
  const [spellPicks, setSpellPicks] = useState({ cantrips: [], spells: [] });
  const [rogueExp, setRogueExp] = useState([]);
  const [favEnemy, setFavEnemy] = useState(null);
  const [favHumanoids, setFavHumanoids] = useState("");
  const [favLang, setFavLang] = useState(null);
  const [natTerrain, setNatTerrain] = useState(null);
  const [persona, setPersona] = useState({ traits: "", ideals: "", bonds: "", flaws: "" });
  const [goldRoll, setGoldRoll] = useState(null);
  const [gearMode, setGearMode] = useState(null);
  const [gearPicks, setGearPicks] = useState({});
  const [purchases, setPurchases] = useState([]);
  const [shopQ, setShopQ] = useState("");
  const [langPicks, setLangPicks] = useState([]);
  const [ancestry, setAncestry] = useState(null);
  const [raceSkills, setRaceSkills] = useState([]);
  const [showExpanded, setShowExpanded] = useState(false);
  const [heCantrip, setHeCantrip] = useState("");
  const [method, setMethod] = useState("Standard Array");
  const [scores, setScores] = useState(Object.fromEntries(ABILITIES.map((a) => [a, 8])));

  const raceData = RACES[race];
  const clsData = CLASSES[cls];
  const raceChooseAmt = raceData.chooseAmt || 1;
  const raceAbilOpts = ABILITIES.filter((a) => !(raceData.chooseNot || []).includes(a));
  const raceFeatDef = raceData.feat && raceFeat?.name ? allFeats(customs).find((f) => f.name === raceFeat.name) : null;
  const raceFeatFx = raceFeat?.name ? FEAT_MECHANICS[raceFeat.name] : null;
  const featScoreCap = raceFeatDef?.cat === "Epic Boon" ? 30 : 20;

  const racialPool = getRacialBonusPool(raceData, race);
  const activeCustomSlots = customAsiSlots.length === racialPool.length ? customAsiSlots : getDefaultRacialSlots(raceData, race);

  const effectiveRaceBonuses = {};
  ABILITIES.forEach((a) => { effectiveRaceBonuses[a] = 0; });
  if (customOriginAsi) {
    racialPool.forEach((bonusVal, idx) => {
      const a = activeCustomSlots[idx];
      if (a) effectiveRaceBonuses[a] = (effectiveRaceBonuses[a] || 0) + bonusVal;
    });
  } else {
    ABILITIES.forEach((a) => { effectiveRaceBonuses[a] = raceData.bonus[a] || 0; });
    raceAbilPicks.forEach((a) => { effectiveRaceBonuses[a] = (effectiveRaceBonuses[a] || 0) + raceChooseAmt; });
  }

  const preFeatScores = { ...scores };
  ABILITIES.forEach((a) => { preFeatScores[a] += effectiveRaceBonuses[a] || 0; });
  const finalScores = { ...preFeatScores };
  if (raceFeat?.bump) finalScores[raceFeat.bump] = Math.min(featScoreCap, finalScores[raceFeat.bump] + 1);
  const featSkillsEff = raceData.feat ? (raceFeat?.skills || []) : [];
  const conMod = mod(finalScores.con);
  const toughBonus = raceFeatFx?.hpPerLevel || 0;
  const hp = clsData.die + conMod + (race === "Hill Dwarf" ? 1 : 0);

  const steps = ["Identity", "Race", "Origins", "Class", "Abilities", "Spells", "Gear", "Confirm"];
  const bgData = BACKGROUNDS[bg] || null;
  const bgLangs = bgData ? bgData.langs : 2;
  const langNeed = (RACE_LANGS[race].choose || 0) + bgLangs;
  const wizCantrips = srcSpells(customs?.spells || []).filter((x) => x.level === 0 && spellFitsClass(x, "Wizard"));
  const raceSkillNeed = (raceData.skills || 0) + (race === "Custom Lineage" && lineageTrait === "skill" ? 1 : 0);
  const raceSkillsEff = raceSkills.slice(0, raceSkillNeed);
  const bgGrantSkills = bgData ? bgData.skills : bgSkills;
  // A subclass chosen at level 1 may grant skills of its own (a Nature cleric's Acolyte of Nature, an Arcana cleric's Arcana).
  const subProfs1 = clsData.subLvl === 1 && subclass ? subclassProfsAt(cls, subclass, 1, customs) : [];
  const subFixedSkills = subProfs1.flatMap((p) => p.skills || []);
  const subSkillChoices = subProfs1.flatMap((p) => (p.skillChoice || []).map((c, i) => ({ key: `${p.feature}:${i}`, feature: p.feature, n: c.n, from: c.from.length ? c.from : ALL_SKILLS })));
  const subSkillsPicked = Object.values(subSkillPicks).flat();
  // Picks a level-1 subclass owes right away (a Nature cleric's druid cantrip, an Arcana cleric's wizard cantrips, a Draconic Bloodline's ancestor).
  const choiceGroups1 = clsData.subLvl === 1 && subclass
    ? allChoiceGroups(customs).filter((g) => groupMatches(g, cls, subclass) && choiceCum(g, 1) > 0).map((g) => ({ g, options: choiceOptionsFor(g, customs), need: choiceCum(g, 1) })).filter((d) => d.options.length)
    : [];
  const skillsElsewhere = [...bgGrantSkills, ...raceSkillsEff, ...featSkillsEff, ...(raceData.grantSkills || []), ...subFixedSkills, ...subSkillsPicked];
  let clsSkillOpts = clsData.skills.filter((s) => !skillsElsewhere.includes(s));
  if (clsSkillOpts.length < clsData.nSkills)
    clsSkillOpts = [...clsSkillOpts, ...ALL_SKILLS.filter((s) => !skillsElsewhere.includes(s) && !clsData.skills.includes(s))];
  const racialCantrip = race === "High Elf" ? heCantrip.trim() : "";
  const castsAt1 = !!CLASSES[cls].caster && CLASSES[cls].caster !== "half";
  const canCap1 = CANTRIPS_KNOWN[cls] ? CANTRIPS_KNOWN[cls](1) : 0;
  const spellCap1 = castsAt1 ? spellCapacity(cls, 1, finalScores).n : 0;
  const pool1 = srcSpells(customs?.spells || []).filter((x) => spellFitsClass(x, cls, subclass));
  const gearPlan = STARTING_GEAR[cls];
  const gearProto = { classes: [{ name: cls, level: 1, subclass: clsData.subLvl === 1 ? subclass : null }] };
  const gearUsable = (o) => [...(o.items || []), ...(o.extra || [])].every(([nm]) => { const it = findItem(nm, customs); return !it || !(isArmorType(it.type) || it.type === "S" || isWeaponType(it.type)) || canEquip(it, gearProto, customs); });
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
  const customAsiReady = customOriginAsi
    ? racialPool.every((_, i) => !!activeCustomSlots[i]) && new Set(activeCustomSlots.filter(Boolean)).size === racialPool.length
    : raceAbilPicks.length === (raceData.choose || 0);
  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? (!raceData.lineageTrait || !!lineageTrait) :
    step === 2 ? langPicks.length === langNeed && (bg !== "Custom" || bgSkills.length === 2) && (race !== "Dragonborn" || ancestry) && raceSkills.length === raceSkillNeed && (race !== "High Elf" || heCantrip.trim()) :
    step === 3 ? skills.length === clsData.nSkills && (clsData.subLvl > 1 || subclass) && subSkillChoices.every((c) => (subSkillPicks[c.key] || []).length === c.n) && choiceGroups1.every((d) => (groupPicks1[d.g.key] || []).length === Math.min(d.need, d.options.length)) && (cls !== "Fighter" || style) && (cls !== "Rogue" || rogueExp.length === 2) && (cls !== "Ranger" || (favEnemy && (favEnemy !== "Two humanoid races" || favHumanoids.trim()) && favLang)) :
    step === 4 ? customAsiReady && (!raceData.feat || featPickDone(raceFeatDef, raceFeat)) :
    step === 6 ? (gearMode === "standard" ? standardReady : gearMode === "gold" ? gold !== null : false) :
    true;

  const finish = () => {
    const inventory = gearMode === "standard" ? standardItems() : purchases.map(({ name: nm, qty }) => ({ name: nm, qty }));
    onDone({
      id: uid(), name: name.trim(), ...photo, race, background: bg, alignment,
      gold: gearMode === "standard" ? (bgData ? bgData.gold : 10) : Math.max(0, goldLeft),
      inventory,
      styles: style ? [style] : [], notes: "", persona,
      metamagic: [], pactBoon: null, invocations: [],
      rangerChoices: cls === "Ranger" ? { favEnemy: favEnemy === "Two humanoid races" ? `Humanoids (${favHumanoids.trim()})` : favEnemy } : null,

      spells: castsAt1 && (spellPicks.cantrips.length || spellPicks.spells.length) ? { [cls]: spellPicks } : {},
      abilities: finalScores, method,
      classes: [{ name: cls, level: 1, subclass: clsData.subLvl === 1 ? subclass : null }],
      choices: Object.fromEntries(choiceGroups1.map((d) => [d.g.key, groupPicks1[d.g.key] || []]).filter(([, v]) => v.length)),
      skills: [...skills, ...raceSkillsEff, ...bgGrantSkills, ...featSkillsEff, ...(raceData.grantSkills || []), ...subFixedSkills, ...subSkillsPicked].filter((v, i, a) => a.indexOf(v) === i),
      feats: raceFeat?.name ? [raceFeat.name] : [],
      featChoices: raceFeat?.name ? { [raceFeat.name]: {
        bump: raceFeat.bump || null, skills: raceFeat.skills || [], choice: raceFeat.choice || null,
        expertise: raceFeat.expertise || [], langs: raceFeat.langs || [],
        cantrips: raceFeat.cantrips || [], spells: raceFeat.spells || [], maneuvers: raceFeat.maneuvers || [], weapons: raceFeat.weapons || [],
      } } : {},
      expertise: [...rogueExp, ...(raceFeat?.expertise || [])].filter((v, i, a) => a.indexOf(v) === i),
      languages: [...RACE_LANGS[race].fixed, ...langPicks, ...(cls === "Ranger" && favLang ? [favLang] : []), ...(raceFeat?.langs || []), ...(raceFeat?.name ? featPickOf(raceFeat.name)?.grantLangs || [] : [])].filter((v, i, a) => a.indexOf(v) === i),
      racialChoices: {
        ancestry: race === "Dragonborn" ? ancestry : null,
        cantrip: race === "High Elf" ? heCantrip.trim() : null,
        lineage: raceData.lineageTrait ? lineageTrait : null,
        customOriginAsi: !!customOriginAsi,
        customAsi: customOriginAsi ? { ...effectiveRaceBonuses } : null,
      },
      maxHp: hp, hpLog: [{ cls, gained: hp, how: "1st level (max)" }],
      log: [`Created as ${race} ${cls} 1${style ? ` · ${style}` : ""}${customOriginAsi ? ` · Custom Origin (${racialPool.map((b, i) => `+${b} ${ABIL_NAMES[activeCustomSlots[i]]}`).join(", ")})` : ""} · ${bg} · ${alignment}${raceFeat?.name ? ` · Feat: ${raceFeat.name}` : ""}${gearMode === "standard" ? " · standard gear" : ` · bought gear (${Math.max(0, goldLeft)} gp left)`}`],
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
            <PortraitButton {...photo} size={84} name={name} onChange={setPhoto} />
            <div style={{ color: T.dim, fontSize: 13 }}>{photo.portrait ? "Tap the portrait to reframe or change it." : "Tap the circle to add a portrait."}</div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1", color: T.dim, fontSize: 11, marginBottom: -2 }}>Long-press or right-click a race for its lore, traits, and art.</div>
          {Object.entries(RACES).filter(([, d]) => !d.group && isSourceEnabled(d)).map(([r, d]) => (
            <div key={r} {...lorePress(r)} onClick={() => {
              setRace(r); setRaceAbilPicks([]); setCustomAsiSlots([]); setRaceSkills([]); setHeCantrip(""); setAncestry(null);
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
            <span style={{ color: T.dim, fontSize: 12 }}> · Tabaxi, Aasimar, Goliath, Genasi, and the rest of the wider world ({Object.values(RACES).filter((d) => d.group && isSourceEnabled(d)).length})</span>
          </div>
          {showExpanded && Object.entries(RACES).filter(([, d]) => d.group && isSourceEnabled(d)).map(([r, d]) => (
            <div key={r} {...lorePress(r)} onClick={() => {
              setRace(r); setRaceAbilPicks([]); setCustomAsiSlots([]); setRaceSkills([]); setHeCantrip(""); setAncestry(null);
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
              {[...Object.keys(BACKGROUNDS).filter((b) => isSourceEnabled(BACKGROUNDS[b])), "Custom"].map((b) => {
                const d = BACKGROUNDS[b];
                const pickBg = () => {
                  setBg(b); setBgSkills([]);
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
              <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.6 }}>
                {(() => {
                  const paras = String(bgData.flavor || "").split(/\n+/).filter(Boolean);
                  const feature = String(bgData.featureText || "").split(/\n+/).filter(Boolean);
                  return <>
                    {paras[0] && <p style={{ color: T.ink, margin: "0 0 8px" }}>{paras[0]}</p>}
                    {feature.map((t, i) => (
                      <p key={i} style={{ margin: "0 0 8px" }}>{i === 0 && <span style={{ color: "#b48ead", fontWeight: 700 }}>{bgData.feature}. </span>}{t}</p>
                    ))}
                    {paras.length > 1 && <div style={{ fontSize: 11.5 }}>Long-press the {bg} card to read the whole background.</div>}
                  </>;
                })()}
                {bgData.tools && <div style={{ marginTop: 6, fontSize: 11.5 }}>Tool proficiencies — {bgData.tools} — ride along as a note; the sheet doesn't track tools.</div>}
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
            {Object.entries(CLASSES).filter(([, d]) => isSourceEnabled(d)).map(([c, d]) => (
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
                  <button key={s} {...lorePress(s)} style={{ ...btn(subclass === s), padding: "6px 14px" }} onClick={() => { setSubclass(s); setSubSkillPicks({}); setGroupPicks1({}); setSkills(skills.filter((x) => !subclassProfsAt(cls, s, 1, customs).flatMap((p) => p.skills || []).includes(x))); }}>{s}</button>
                ))}
              </div>
              {subFixedSkills.length > 0 && <div style={{ color: T.dim, fontSize: 13, marginTop: 8 }}>{subclass} grants proficiency in {subFixedSkills.join(" and ")}.</div>}
              {choiceGroups1.map((d) => {
                const picked = groupPicks1[d.g.key] || [];
                const need = Math.min(d.need, d.options.length);
                return (
                  <div key={d.g.key} style={{ marginTop: 10 }}>
                    <div style={{ color: T.gold, fontSize: 13, marginBottom: 6 }}>{d.g.key} — choose {need} ({picked.length}/{need})</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 180, overflowY: "auto" }}>
                      {d.options.filter((o) => !spellPicks.cantrips.includes(o.name)).map((o) => (
                        <button key={o.name} {...lorePress(o.name)} style={{ ...btn(picked.includes(o.name)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                          onClick={() => setGroupPicks1({ ...groupPicks1, [d.g.key]: picked.includes(o.name) ? picked.filter((x) => x !== o.name) : picked.length < need ? [...picked, o.name] : picked })}>{o.name}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {subSkillChoices.map((c) => {
                const picked = subSkillPicks[c.key] || [];
                const taken = [...skillsElsewhere.filter((x) => !picked.includes(x)), ...skills];
                return (
                  <div key={c.key} style={{ marginTop: 10 }}>
                    <div style={{ color: T.gold, fontSize: 13, marginBottom: 6 }}>{c.feature} — choose {c.n} skill{c.n > 1 ? "s" : ""} ({picked.length}/{c.n})</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.from.filter((sk) => !taken.includes(sk)).map((sk) => (
                        <button key={sk} style={{ ...btn(picked.includes(sk)), padding: "5px 10px", fontSize: 13, minHeight: 0 }}
                          onClick={() => setSubSkillPicks({ ...subSkillPicks, [c.key]: picked.includes(sk) ? picked.filter((x) => x !== sk) : picked.length < c.n ? [...picked, sk] : picked })}>{sk}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
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
          bonuses={effectiveRaceBonuses}
          featBonus={raceFeat?.bump ? { [raceFeat.bump]: finalScores[raceFeat.bump] - preFeatScores[raceFeat.bump] } : {}}
          featLabel={raceFeat?.name || "feat"}>
          <OriginAsiPicker
            race={race}
            raceData={raceData}
            customOrigin={customOriginAsi}
            setCustomOrigin={setCustomOriginAsi}
            slots={activeCustomSlots}
            setSlots={setCustomAsiSlots}
            raceAbilPicks={raceAbilPicks}
            setRaceAbilPicks={setRaceAbilPicks}
            scores={scores}
            extra={raceFeat?.bump ? { [raceFeat.bump]: finalScores[raceFeat.bump] - preFeatScores[raceFeat.bump] } : {}}
          />
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
                      {s.options.map((o, j) => {
                        const usable = gearUsable(o);
                        return (
                          <button key={o.label} style={{ ...btn(gp?.opt === j), padding: "6px 12px", fontSize: 13, opacity: usable ? 1 : 0.45 }} disabled={!usable}
                            title={usable ? undefined : "Your class and subclass aren't proficient with this"}
                            onClick={() => setGearPicks({ ...gearPicks, [i]: { opt: j, picks: [] } })}>{o.label.replace(/ \(if proficient\)$/, "")}{usable ? "" : " — not proficient"}</button>
                        );
                      })}
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
                        items={(customs?.items || []).filter((x) => x.type !== "$" && isSourceEnabled(x) && x.name.toLowerCase().includes(shopQ.toLowerCase()))
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
            <Portrait {...photo} size={72} name={name} />
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
export { HorizonArt, CreateWizard };
