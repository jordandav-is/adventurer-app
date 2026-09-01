import { baseSubName } from "./data.js";
import { classLevel, fmtMod, fxMods, hasEffect, hasFeat, hasStyle, hasSub, mod, profBonus, totalLevel } from "./rules.js";
import { useEffect, useState } from "react";
import { Icon, T, btn, card } from "./ui.jsx";
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
    const h = 0.15, rad = (d) => (d * Math.PI) / 180;
    for (let k = 0; k < 5; k++) {
      v.push([Math.cos(rad(k * 72)), Math.sin(rad(k * 72)), h]);
      v.push([Math.cos(rad(k * 72 + 36)), Math.sin(rad(k * 72 + 36)), -h]);
    }
    const [a, b, c] = [v[0], v[2], v[1]];
    const n = V3.cross(V3.sub(b, a), V3.sub(c, a));
    const za = Math.abs(V3.dot(n, a) / n[2]);
    v.push([0, 0, za], [0, 0, -za]);
    return v;
  }
  if (sides === 12) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]); }
    return v;
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]); }
  return v;
}
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
    let up = pts[0];
    if (sides === 6) up = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, (pts[0][2] + pts[1][2]) / 2];
    if (sides === 10) up = pts.reduce((best, p) => (Math.hypot(...V3.sub(p, c)) > Math.hypot(...V3.sub(best, c)) ? p : best), pts[0]);
    const w = V3.norm(V3.sub(up, c));
    const u = V3.norm(V3.cross(n, w));
    const flat = pts.map((p) => [V3.dot(V3.sub(p, c), u), -V3.dot(V3.sub(p, c), w)]);
    const rmax = Math.max(...flat.map(([x, y]) => Math.hypot(x, y)));
    const clip = "polygon(" + flat.map(([x, y]) => `${(50 + (x / rmax) * 49).toFixed(2)}% ${(50 + (y / rmax) * 49).toFixed(2)}%`).join(", ") + ")";
    const k = rmax / (size * 0.49);
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
  const bigK = { 4: 0.32, 6: 0.5, 8: 0.4, 10: 0.36, 12: 0.4, 20: 0.33 }[sides] || 0.4;
  const dur = (1.15 + delay / 1000).toFixed(2);
  const tumble = (final + sides) % 2 ? "diceTumbleA" : "diceTumbleB";
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    setLanded(false);
    const t = setTimeout(() => setLanded(true), 1200 + 2 * delay);
    return () => clearTimeout(t);
  }, [sides, final, delay]);
  return (
    // filter creates a stacking context that flattens preserve-3d child transforms.
    <div style={{ filter: "drop-shadow(0 10px 12px #00000073)", animation: `diceDrop 1.3s cubic-bezier(.22,1.6,.36,1) ${delay}ms both` }}>
      <div style={{ width: size, height: size, perspective: 700 }}>
        <div style={{ width: size, height: size, transformStyle: "preserve-3d", animation: `${tumble} ${dur}s cubic-bezier(.18,.8,.24,1.02) ${delay}ms both` }}>
          <div style={{ width: size, height: size, position: "relative", transformStyle: "preserve-3d", transform: target.land }}>
          {faces.map((f, i) => {
            const tilt = Math.max(0, V3.dot(target.n, f.n));
            return (
              // clip-path is placed on the child element to avoid Chromium 3D rasterization culling artifacts at steep angles.
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
function rollFeatures(ch) {
  const lvl = totalLevel(ch);
  const pb = profBonus(lvl);
  const clsLv = (name) => classLevel(ch, name);
  const champLvl = ch.classes.find((c) => baseSubName(c.subclass || "") === "Champion")?.level || 0;
  return {
    pb,
    lucky: ch.race === "Lightfoot Halfling",
    jack: clsLv("Bard") >= 2 ? Math.floor(pb / 2) : 0,
    athlete: champLvl >= 7 ? Math.ceil(pb / 2) : 0,
    reliable: clsLv("Rogue") >= 11,
    aura: clsLv("Paladin") >= 6 ? Math.max(1, mod(ch.abilities.cha)) : 0,
    diamondSoul: clsLv("Monk") >= 14,
    slipperyMind: clsLv("Rogue") >= 15,
    ironMind: clsLv("Ranger") >= 7 && hasSub(ch, "Gloom Stalker"),
    critRange: champLvl >= 15 ? 18 : champLvl >= 3 ? 19 : 20,
    archery: hasStyle(ch, "Archery") ? 2 : 0,
    barbarian: clsLv("Barbarian"),
    savageAttacks: ch.race === "Half-Orc",
    savageAttacker: hasFeat(ch, "Savage Attacker"),
  };
}
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
  if (hasFeat(ch, "Lucky")) n.push("Lucky: you may spend a Luck Point on this roll — long-press the feat for your table's wording");
  if (kind === "save" && abil === "con" && hasFeat(ch, "War Caster")) n.push("War Caster: advantage on Constitution saves to maintain Concentration");
  const fx = fxMods(ch);
  (fx.notes[kind === "skill" ? "check" : kind] || []).forEach((note) => {
    if (typeof note === "string") n.push(note);
    else if (!note.abil || !abil || [].concat(note.abil).includes(abil)) n.push(note.t);
  });
  return n;
}
function RollTray({ title, mode, parts, kind, abil, proficient, extra, ch, minion, onClose, onDamage }) {
  const f = minion ? { critRange: 20 } : rollFeatures(ch);
  // Initialize roll state once during mount so component re-renders do not re-roll dice.
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
export { DiceTray, roll, rollFeatures, rollNotes, RollTray };
