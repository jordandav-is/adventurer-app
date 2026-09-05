import { ABILITIES, ALL_SKILLS, CLASSES, CLASS_BLURB, FEAT_CATS, FEAT_MECHANICS, LANGS, MANEUVERS, PROF_TEXT, SRD_FOOT, SUB_LORE, baseSubName } from "./data.js";
import { allFeats, crShow, featBlockedBy, featGrantedSpells, featureBody, fmtMod, infoFor, mod, schoolName, searchRank, sourceOf, spellFitsClass, subSpellData } from "./rules.js";
import { srcSpells } from "./compendium.js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { clampFrame, conjure, flushAssets, forge, frameRect, frameStyle, importPhoto, referenceImagePayload, thumbOf, useAssetUrl } from "./portrait.js";
const Stage = lazy(() => import("./stage.jsx"));
import { getAccount } from "./sync.js";
const T = {
  bg: "#161219", panel: "#221c26", panel2: "#2b2330", ink: "#e8dfd0", dim: "#a2937f",
  gold: "#c9a44c", blood: "#8e3b46", edge: "#3a3040", green: "#7da05f", error: "#d76a76",
};
const card = { background: T.panel, border: `1px solid ${T.edge}`, borderRadius: 10 };
const btn = (primary) => ({
  padding: "11px 18px", borderRadius: 12, cursor: "pointer", fontWeight: 700, letterSpacing: 0.5,
  minHeight: 44, WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontSize: 15,
  background: primary ? T.blood : "transparent", color: primary ? T.ink : T.gold,
  border: primary ? `1px solid ${T.blood}` : `1px solid ${T.gold}`, fontFamily: "Georgia, serif",
});
const cornerBtn = {
  flex: "0 0 auto", width: 44, borderRadius: 12, cursor: "pointer", boxSizing: "border-box",
  border: `1px solid ${T.edge}`, background: T.panel, color: T.gold, lineHeight: 1,
  display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85,
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
};
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
  @keyframes conjureBreathe { 0%, 100% { filter: brightness(0.75); box-shadow: 0 0 0 0 #c9a44c00; } 50% { filter: brightness(1.3); box-shadow: 0 0 22px 3px #c9a44c80; } }
  @keyframes sheetRise { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .sheet-tall { height: min(82vh, 700px); height: min(82dvh, 700px); }
  .sheet-cap { max-height: min(88vh, 700px); max-height: min(88dvh, 700px); }
  .sheet-body { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .horizon { position: fixed; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0;
    height: clamp(150px, 24vh, 250px); opacity: 0.72;
    background-image: linear-gradient(to bottom, ${T.bg} 0%, ${T.bg}f7 20%, ${T.bg}cc 42%, ${T.bg}80 64%, ${T.bg}33 85%, ${T.bg}00 100%), url('./horizon.jpg');
    background-size: cover; background-position: center 62%;
    animation: horizonIn 2.6s ease-out both; }
  @media (min-width: 700px) { .horizon { height: clamp(200px, 32vh, 360px); } }
  @keyframes horizonIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 0.72; transform: none; } }
  @keyframes nightSkyIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes campfireFlicker { 0%, 100% { opacity: 0.65; transform: scaleY(1); } 50% { opacity: 0.9; transform: scaleY(1.08); } }
  @keyframes emberRise { 0% { transform: translate(0, 0) scale(0.6); opacity: 0; } 25% { opacity: 0.95; } 75% { opacity: 0.7; } 100% { transform: translate(var(--dx, 15px), -140px) scale(0.2); opacity: 0; } }
  @keyframes headerShine { 0%, 100% { filter: drop-shadow(0 0 0 rgba(201,164,76,0)); } 50% { filter: drop-shadow(0 0 14px rgba(201,164,76,0.85)) drop-shadow(0 0 4px rgba(247,230,181,0.9)); } }
  @keyframes starTwinkle { 0%, 100% { opacity: 0.2; transform: scale(0.7); } 50% { opacity: 0.95; transform: scale(1.3); } }
  @keyframes critPulse { 0% { box-shadow: 0 0 0 0 rgba(201,164,76,0.6); } 70% { box-shadow: 0 0 0 16px rgba(201,164,76,0); } 100% { box-shadow: 0 0 0 0 rgba(201,164,76,0); } }
  @media (hover: none) and (pointer: coarse) {
    [data-lore] { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .lore-lock, .lore-lock * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
  }
`;
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
      <Section title="Bonus Actions" list={c.bonus} />
      <Section title="Reactions" list={c.reacts} />
      <Section title="Legendary Actions" list={c.leg} />
    </div>
  );
}
function FeatureLine({ name, cls, customs }) {
  const body = featureBody(name, cls, customs);
  return (
    <div style={{ marginTop: 8 }}>
      <span {...lorePress(name)} style={{ color: T.ink, fontWeight: 700, fontSize: 13.5 }}>{name}</span>
      {body && <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6, marginTop: 2 }}>{body}</div>}
    </div>
  );
}
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
let __showLore = null;
function loreLock(on) {
  document.documentElement.classList.toggle("lore-lock", on);
  if (on) { try { const sel = window.getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges(); } catch {} }
}
function lorePress(name) {
  return {
    "data-lore": "",
    onContextMenu: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const lockSelection = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      __showLore && __showLore(name, lockSelection);
    },
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = e.currentTarget;
      const lockSelection = e.pointerType === "touch";
      delete el.dataset.loreFired;
      const sx = e.clientX, sy = e.clientY;
      if (lockSelection) loreLock(true);
      const t = setTimeout(() => {
        el.dataset.loreFired = "1";
        if (__showLore) __showLore(name, lockSelection); else loreLock(false);
      }, 480);
      const move = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) end(); };
      const end = () => {
        clearTimeout(t);
        if (!el.dataset.loreFired) loreLock(false);
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
  __showLore = (name, lockSelection = false) => { openedAt.current = Date.now(); loreLock(lockSelection); setItem(infoFor(name, customs) || { title: String(name), meta: "", body: null }); };
  if (!item) return null;
  const close = () => { setItem(null); loreLock(false); };
  const dismiss = () => { if (Date.now() - openedAt.current > 400) close(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000c8", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={dismiss}>
      <div style={{ ...card, width: "min(620px, 100%)", maxHeight: "72vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 21, color: T.gold }}>{item.title}</div>
          <span style={{ color: T.dim, cursor: "pointer", fontSize: 20, lineHeight: 1 }} onClick={close}>✕</span>
        </div>
        {item.meta && <div style={{ color: "#b48ead", fontSize: 13, marginTop: 4, fontStyle: item.block ? "italic" : "normal" }}>{item.meta}</div>}
        {item.art && (
          // Shown whole at natural size, never cropped or upscaled: the art mixes tall cut-out figures with wide paintings.
          <div key={item.art} style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <img src={item.art} alt="" loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
              style={{ display: "block", maxWidth: "100%", maxHeight: "min(380px, 46vh)", width: "auto", height: "auto", borderRadius: 10 }} />
          </div>
        )}
        <div style={{ color: T.ink, fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
          {item.block
            ? <StatBlock c={item.block} />
            : item.body
            ? item.body.split(/\n+/).map((p, i) => <p key={i} style={{ margin: "0 0 10px" }}>{p}</p>)
            : item.traits
            ? null
            : <span style={{ color: T.dim }}>No lore recorded for this yet. Import a compendium XML in the Homebrew Forge to fill the library — or consult your books.</span>}
        </div>
        {item.traits && (
          <div style={{ marginTop: 6 }}>
            <div style={{ color: T.gold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>Racial traits</div>
            {item.traits.split(/\n+/).map((line, i) => {
              // Baked trait lines read "Name. Description" — the run-in heading style of the printed books.
              const m = line.match(/^([^.•]{1,48})\.\s+(.+)$/);
              return (
                <p key={i} style={{ margin: "6px 0 0", color: T.ink, fontSize: 13.5, lineHeight: 1.6 }}>
                  {m ? <><b style={{ color: T.gold }}>{m[1]}.</b> {m[2]}</> : line}
                </p>
              );
            })}
          </div>
        )}
        {item.foot && <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>{item.foot}</div>}
      </div>
    </div>
  );
}
// Portrait button: tap for the portrait menu — upload, conjure, reframe, remove. onChange receives
// the full patch { photo, portrait } (thumb plus framing record) or nulls on removal. `brief`, when
// given, is a function building the character brief the conjurer works from.
const veil = { position: "fixed", inset: 0, background: "#000000c8", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", animation: "sheetVeil 200ms ease" };
const pane = { ...card, padding: 20, width: "min(92vw, 360px)", boxSizing: "border-box" };
function PortraitButton({ photo, portrait, model, size, name, brief, onChange }) {
  const [mode, setMode] = useState(null); // null | "menu" | "conjure" | "evolve" | "forge" | "stage" | portrait record being framed
  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importPhoto(f).then(setMode).catch(() => {}); };
  const signedIn = !!getAccount();
  const canConjure = !!brief && signedIn;
  const hasPortrait = !!(portrait || photo);
  return (
    <>
      <div role="button" tabIndex={0} title="Portrait" style={{ cursor: "pointer" }} onClick={() => setMode("menu")}>
        <Portrait photo={photo} portrait={portrait} size={size} name={name} />
      </div>
      {mode === "menu" && (
        <div style={veil} onClick={() => setMode(null)}>
          <div style={{ ...pane, display: "flex", flexDirection: "column", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold, marginBottom: 4 }}>Portrait</div>
            {model && <button style={btn(false)} onClick={() => setMode("stage")}>View in 3D</button>}
            {portrait && signedIn && <button style={btn(false)} onClick={() => setMode("forge")}>{model ? "Forge the figure anew" : "Forge a 3D figure"}</button>}
            <label style={{ ...btn(false), display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>Upload a photo<input type="file" accept="image/*" onChange={pick} style={{ display: "none" }} /></label>
            {canConjure && hasPortrait && <button style={btn(false)} onClick={() => setMode("evolve")}>Evolve from current portrait</button>}
            {canConjure && <button style={btn(false)} onClick={() => setMode("conjure")}>{hasPortrait ? "Conjure a fresh portrait" : "Conjure one from your sheet"}</button>}
            {portrait && <button style={btn(false)} onClick={() => setMode(portrait)}>Reframe</button>}
            {portrait && <button style={{ ...btn(false), borderColor: T.blood, color: T.blood }} onClick={() => { onChange({ photo: null, portrait: null }); setMode(null); }}>Remove</button>}
          </div>
        </div>
      )}
      {mode === "forge" && <ForgeSheet imageId={portrait.id} onDone={(id) => { onChange({ model: { id, env: model?.env || "dawn" } }); setMode("stage"); }} onClose={() => setMode(null)} />}
      {mode === "stage" && <StageSheet model={model} name={name} onEnv={(env) => onChange({ model: { ...model, env } })} onPick={(blob) => importPhoto(blob).then(setMode)} onClose={() => setMode(null)} />}
      {(mode === "conjure" || mode === "evolve") && (
        <ConjureSheet
          brief={brief}
          reference={mode === "evolve" ? { photo, portrait, name } : null}
          onPick={(blob) => importPhoto(blob).then(setMode)}
          onClose={() => setMode(null)}
        />
      )}
      {mode && typeof mode === "object" && <PortraitEditor p={mode} onClose={() => setMode(null)}
        onSave={(img, p) => { onChange({ photo: thumbOf(img, p), portrait: p }); flushAssets([{ portrait: p }]); setMode(null); }} />}
    </>
  );
}
// Sculpt, rig and animate the current portrait. The Worker drives Tripo; we watch the stages go by.
const FORGE_STAGES = { image_to_model: "Sculpting the figure", animate_rig: "Setting the bones", animate_retarget: "Teaching it to breathe", deliver: "Carrying it home" };
function ForgeSheet({ imageId, onDone, onClose }) {
  const [stage, setStage] = useState("image_to_model");
  const [err, setErr] = useState(null);
  useEffect(() => { let on = true; forge(imageId, (s) => on && setStage(s)).then((id) => on && onDone(id)).catch((e) => on && setErr(e.message)); return () => { on = false; }; }, [imageId]);
  return (
    <div style={veil}>
      <div style={{ ...pane, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold }}>Forging a figure</div>
        {err ? <div style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{err}</div> : (
          <>
            <div style={{ margin: "18px auto 8px", width: 72, height: 72, borderRadius: "50%", background: T.panel2, border: `2px solid ${T.gold}`, animation: "conjureBreathe 1.8s ease-in-out infinite" }} />
            <div style={{ color: T.ink, fontSize: 14 }}>{FORGE_STAGES[stage] || stage}…</div>
            <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>A few minutes. You can close this; the forge keeps working and the menu will offer the figure when it's done.</div>
          </>
        )}
        <div style={{ marginTop: 16 }}><button style={btn(false)} onClick={onClose}>{err ? "Close" : "Leave it working"}</button></div>
      </div>
    </div>
  );
}
// Full-screen stage with the environment picker and a way to make the view the portrait.
function StageSheet({ model, name, onEnv, onPick, onClose }) {
  const url = useAssetUrl(model.id);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [envs, setEnvs] = useState(null);
  const handle = useRef(null);
  const chip = (on) => ({ ...btn(false), padding: "6px 12px", minHeight: 0, fontSize: 12.5, background: on ? T.panel2 : "transparent", borderColor: on ? T.gold : T.edge, color: on ? T.gold : T.ink });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: T.bg }}>
      {url && (
        <Suspense fallback={null}>
          <Stage url={url} env={model.env} onHandle={(h) => { handle.current = h; import("./stage.jsx").then((m) => setEnvs(m.ENVS)); }} onReady={(e) => setState(e ? "error" : "ready")} />
        </Suspense>
      )}
      {state !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: state === "error" ? T.error : T.dim, fontFamily: "Georgia, serif", fontSize: 18, pointerEvents: "none" }}>
          {state === "error" ? "The figure would not load." : "Raising the stage…"}
        </div>
      )}
      <div style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top))", left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.gold, textShadow: "0 1px 6px #000" }}>{name}</div>
        <button style={{ ...cornerBtn, pointerEvents: "auto" }} aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div style={{ position: "absolute", bottom: "calc(14px + env(safe-area-inset-bottom))", left: 12, right: 12, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        {envs && Object.entries(envs).map(([k, e]) => <button key={k} style={chip(k === model.env)} onClick={() => onEnv(k)}>{e.name}</button>)}
        {state === "ready" && <button style={{ ...btn(true), padding: "8px 14px", minHeight: 0, fontSize: 13 }} onClick={() => handle.current?.snapshot().then((b) => b && onPick(b))}>Use this view as portrait</button>}
      </div>
    </div>
  );
}
// Describe the character, let the aether paint four, choose one — or add a note and get four more.
const CONJURE_ROUNDS = Infinity;
function ConjureSheet({ brief, reference, onPick, onClose }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [rounds, setRounds] = useState([]); // [{ prompt, urls, blobs }]
  const [refPayload, setRefPayload] = useState(null);
  const isEvolve = !!reference;

  useEffect(() => {
    if (reference) {
      referenceImagePayload(reference).then(setRefPayload).catch(() => {});
    }
  }, [reference]);

  useEffect(() => () => rounds.forEach((r) => r.urls.forEach(URL.revokeObjectURL)), [rounds]);
  const last = rounds[rounds.length - 1];
  const go = () => {
    setBusy(true); setErr(null);
    conjure(
      { ...brief(), description: text.trim(), ...(last ? { previousPrompt: last.prompt, revision: note.trim() } : {}) },
      refPayload
    )
      .then((r) => { setRounds((rs) => [...rs, { ...r, urls: r.blobs.map((b) => URL.createObjectURL(b)) }]); setNote(""); })
      .catch((e) => setErr(e.message)).finally(() => setBusy(false));
  };
  const field = { width: "100%", boxSizing: "border-box", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 15, resize: "vertical", fontFamily: "inherit" };
  const tile = { width: "100%", aspectRatio: "9 / 16", borderRadius: 10, border: `1px solid ${T.edge}` };
  return (
    <div style={veil} onClick={busy ? undefined : onClose}>
      <div style={{ ...pane, width: "min(92vw, 420px)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold }}>{isEvolve ? "Evolve portrait" : "Conjure a portrait"}</div>
            <div style={{ color: T.dim, fontSize: 12.5, margin: "4px 0 10px" }}>
              {isEvolve
                ? "Your current portrait inspires this evolution — carrying your character forward with their new level and gear."
                : "Your sheet — ancestry, classes, gear, features, persona, notes — goes in with whatever you add here."}
            </div>
          </div>
          {isEvolve && (
            <div style={{ flexShrink: 0, marginBottom: 6 }}>
              <Portrait photo={reference.photo} portrait={reference.portrait} size={48} name={reference.name} />
            </div>
          )}
        </div>
        {!last && <textarea value={text} rows={4} maxLength={800} disabled={busy} onChange={(e) => setText(e.target.value)} style={field}
          placeholder={isEvolve
            ? "Level-up details to guide the muse — new scars, dyed hair, different expression, or leave blank to let your new gear shine…"
            : "Scar over the left eye, hair braided with copper rings, a grin that says the tavern is already on fire…"} />}
        {(last || busy) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {rounds.flatMap((r, ri) => r.urls.map((u, i) => <img key={u} src={u} alt={`Candidate ${ri * 4 + i + 1}`} onClick={() => onPick(r.blobs[i])} style={{ ...tile, objectFit: "cover", cursor: "pointer" }} />))}
            {busy && Array.from({ length: 4 }, (_, i) => <div key={i} style={{ ...tile, background: T.panel2, animation: `conjureBreathe 1.8s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        {last && <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Tap one to frame it. The muse read: <i>{last.prompt}</i></div>}
        {last && rounds.length < CONJURE_ROUNDS && !busy && <textarea value={note} rows={2} maxLength={800} onChange={(e) => setNote(e.target.value)} style={{ ...field, marginTop: 10 }}
          placeholder="Not quite? Say what to change — older, darker cloak, lose the hat — and conjure four more." />}
        {err && <div style={{ color: T.error, fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button style={btn(false)} disabled={busy} onClick={onClose}>{last ? "Close" : "Cancel"}</button>
          {(!last || rounds.length < CONJURE_ROUNDS) && (
            <button style={{ ...btn(true), animation: busy ? "conjureBreathe 1.8s ease-in-out infinite" : "none" }} disabled={busy} onClick={go}>
              {busy ? (isEvolve ? "Evolving…" : "Conjuring…") : last ? (isEvolve ? "Evolve four more" : "Conjure four more") : (isEvolve ? "Evolve" : "Conjure")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function PortraitEditor({ p: initial, onSave, onClose }) {
  const S = 260;
  const [p, setP] = useState(initial);
  useEffect(() => setP(initial), [initial]);
  const url = useAssetUrl(p.id);
  const img = useRef(null), pts = useRef(new Map());
  const k = S / frameRect(p).side;
  const nudge = (dx, dy, dz = 1) => setP((q) => clampFrame({ ...q, x: q.x - dx / (k * q.w), y: q.y - dy / (k * q.h), z: q.z * dz }));
  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, [e.clientX, e.clientY]); };
  const up = (e) => pts.current.delete(e.pointerId);
  const move = (e) => {
    const m = pts.current; if (!m.has(e.pointerId)) return;
    const [ox, oy] = m.get(e.pointerId), other = [...m].find(([id]) => id !== e.pointerId)?.[1];
    if (!other) nudge(e.clientX - ox, e.clientY - oy);
    else nudge((e.clientX - ox) / 2, (e.clientY - oy) / 2, Math.hypot(e.clientX - other[0], e.clientY - other[1]) / Math.hypot(ox - other[0], oy - other[1]));
    m.set(e.pointerId, [e.clientX, e.clientY]);
  };
  return (
    <div style={veil} onClick={onClose}>
      <div style={pane} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.gold, marginBottom: 12 }}>Frame the portrait</div>
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => nudge(0, 0, 1 - e.deltaY / 600)}
          style={{ position: "relative", width: S, height: S, margin: "0 auto", borderRadius: "50%", overflow: "hidden", border: `2px solid ${T.gold}`, background: T.panel2, touchAction: "none", cursor: "grab", userSelect: "none" }}>
          {url && <img ref={img} src={url} alt="" draggable={false} style={{ ...frameStyle(p, S), pointerEvents: "none" }} />}
        </div>
        <input type="range" min={1} max={4} step={0.01} value={p.z} aria-label="Zoom" onChange={(e) => setP((q) => clampFrame({ ...q, z: +e.target.value }))} style={{ width: "100%", marginTop: 14, accentColor: T.gold }} />
        <div style={{ color: T.dim, fontSize: 12, textAlign: "center" }}>Drag to move · scroll, pinch, or slide to zoom</div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={btn(false)} onClick={onClose}>Cancel</button>
          <button style={{ ...btn(true), opacity: url ? 1 : 0.4 }} disabled={!url} onClick={() => onSave(img.current, p)}>Save</button>
        </div>
      </div>
    </div>
  );
}
// Small circles use the 220px thumb; when the full-resolution original is at hand, frame that instead.
function Portrait({ photo, portrait, size = 72, name }) {
  const url = useAssetUrl(portrait?.id);
  const ring = { width: size, height: size, borderRadius: "50%", border: `2px solid ${T.gold}` };
  if (url && portrait) return <div style={{ ...ring, position: "relative", overflow: "hidden" }}><img src={url} alt={name} style={frameStyle(portrait, size)} /></div>;
  return photo ? (
    <img src={photo} alt={name} style={{ ...ring, objectFit: "cover" }} />
  ) : (
    <div style={{ ...ring, borderColor: T.edge, background: T.panel2, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, fontFamily: "Georgia, serif", fontSize: size * 0.4 }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}
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
function FeatChooser({ customs, abilities, level, caster, held = [], styles = [], skillsTaken = [], knownCantrips = [], knownLangs = [], profSkills = [], gearProfs, value, onChange, allowEpic = true, waiveLevel = false, note }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const pool = allFeats(customs)
    .filter((f) => !held.includes(f.name))
    .filter((f) => !(f.fx?.style && styles.includes(f.fx.style)))
    .filter((f) => allowEpic || f.cat !== "Epic Boon");
  const cats = ["All", ...FEAT_CATS.filter((c) => pool.some((f) => f.cat === c))];
  const needle = q.trim().toLowerCase();
  const shown = pool.filter((f) =>
    (cat === "All" || f.cat === cat) &&
    (!needle || f.name.toLowerCase().includes(needle) || (f.desc || "").toLowerCase().includes(needle)));
  const ctx = { abilities, level: waiveLevel ? Infinity : level, caster, armor: gearProfs?.armor, martial: gearProfs ? gearProfs.martial : undefined };

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
  const weaponPool = pk.weapons?.n ? (customs?.items || []).filter((it) => ["M", "R"].includes(it.type) && it.src === "PHB" && !it.bonus && !it.attune).map((it) => it.name).sort() : [];
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
      {pk.weapons?.n > 0 && chipRow("Weapon proficiencies · long-press to read", weaponPool, "weapons", pk.weapons.n, undefined, true)}
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
export { T, card, btn, cornerBtn, SHELL_STYLE, GLOBAL_CSS, ICON_PATHS, Icon, CLASS_THEMES, ClassTag, FeatureLine, SubclassDetail, ClassDetail, __showLore, lorePress, LoreSheet, PortraitButton, Portrait, LazyList, SpellPickGrid, FeatChooser };
