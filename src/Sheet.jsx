import { ABILITIES, ABIL_NAMES, ALL_SKILLS, ANCESTRIES, ARCANUM_UNLOCK, ASI, CANTRIPS_KNOWN, CHOICE_KEYS, CLASSES, DMG_TYPES, INVOCATIONS, INVOCATION_DATA, ITEM_TYPES, PACT, PREP_ALL_CLASSES, PROF_TEXT, RACES, SKILL_ABIL, SPELL_ABILITY, SPELL_LVL_HINT, STYLE_DESC, baseSubName } from "./data.js";
import { EFFECT_BY_KEY, EFFECT_LIB, SUMMON_LIB, allKnownCantrips, allSubFeats, ammoRowFor, applyEffectPatch, armorClass, b64uFromBytes, bladeRiderTier, bytesFromB64u, canEquip, characterChoiceGroups, classLevel, consumableEffectKey, crShow, creatureByName, describeCustomFx, effDefOf, effEnds, effMaxHp, effectsOf, equippedOf, featChoiceOf, featChoiceSummary, featEffects, featureBuckets, featHpBonus, featSpellsOf, findItem, fmtMod, fxMods, hasEffect, hasStyle, hasSub, healingDiceFor, instMaxHp, invocationFor, invocationSpellsOf, isArmorType, isBladeCantrip, isConcDef, isConcInst, isConsumableRow, isWeaponType, knownSpellNames, maxSpellLevel, minionApplyHp, minionAttackRolls, minionHp, minionSaves, minionSkills, minionsOf, mod, pipeBytes, profBonus, raceGrantedSpells, round2, schoolName, searchRank, shareCustomsFor, sourceOf, speedOf, spellCapacity, spellFitsClass, spellSlots, spiritAc, spiritDefFromSpell, spiritHp, strikeProfile, subSpellData, summonDefFor, summonFormsFor, summonerSpellAtk, totalLevel, useRecipe, useTrackersFor, usesAmmo } from "./rules.js";
import { EMPTY_CUSTOM, SRD_SRC, __BESTIARY, __SOURCES, creatureSrcOf, isSourceEnabled, sourceCodesOf, sourceLabelOf, spellSrcOf, srcSpells, uid } from "./compendium.js";
import React, { useEffect, useState } from "react";
import { CLASS_THEMES, ClassTag, ICON_PATHS, Icon, LazyList, Portrait, SpellPickGrid, T, __showLore, btn, card, cornerBtn, lorePress, usePhotoUpload } from "./ui.jsx";
import { DiceTray, RollTray, roll, rollFeatures, rollNotes } from "./dice.jsx";
const SHARE_W = 1200, SHARE_H = 630;
const CARD_SERIF = 'Georgia, "Liberation Serif", "Times New Roman", serif';
const CARD_SANS = '-apple-system, "SF Pro Text", "DejaVu Sans", system-ui, sans-serif';
const loadImg = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});
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
  ctx.strokeStyle = `${T.gold}99`; ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, SHARE_W - 32, SHARE_H - 32);
  ctx.strokeStyle = `${T.gold}40`; ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, SHARE_W - 52, SHARE_H - 52);

  const X = 64;
  ctx.fillStyle = T.dim;
  ctx.font = `24px ${CARD_SANS}`;
  try { ctx.letterSpacing = "8px"; } catch {}
  ctx.fillText("THE ADVENTURER'S LEDGER", X, 92);
  try { ctx.letterSpacing = "0px"; } catch {}

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

  ctx.fillStyle = T.gold;
  fitFont(ctx, ch.name, 700, 88, CARD_SERIF, rightEdge - X);
  ctx.fillText(ch.name, X, 196);

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

  ctx.fillStyle = T.dim; ctx.font = `22px ${CARD_SANS}`;
  ctx.fillText(`Read-only snapshot · shared ${new Date().toISOString().slice(0, 10)}`, X, SHARE_H - 58);
  return cv;
}
async function encodeShare(ch, customs) {
  const { photo, log, hpLog, ...soul } = ch;
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
  const payload = JSON.parse(json);
  const c = payload?.v === 1 ? payload.c : null;
  if (!c?.name || !RACES[c.race] || !Array.isArray(c.classes) || !c.classes.length || c.classes.some((x) => !CLASSES[x?.name]) || ABILITIES.some((a) => typeof c.abilities?.[a] !== "number")) {
    throw new Error("not a shared character");
  }
  payload.c = { ...c, photo: null, log: [], skills: Array.isArray(c.skills) ? c.skills : [], maxHp: typeof c.maxHp === "number" ? c.maxHp : 1 };
  payload.x = { ...EMPTY_CUSTOM, ...(payload.x || {}) };
  return payload;
}
function InventoryCard({ ch, customs, onUpdate, onConsume, readOnly }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [usableOnly, setUsableOnly] = useState(true);
  const [freeText, setFreeText] = useState("");
  const [coin, setCoin] = useState("10");
  const inv = ch.inventory || [];
  const pool = customs?.items || [];
  const save = (rows) => onUpdate({ inventory: rows });
  const gold = round2(Math.max(0, ch.gold ?? 0));
  const priceOf = (it) => parseFloat(it?.value) || 0;
  const coinAmt = Math.max(0, parseFloat(coin) || 0);
  const buy = (it) => {
    const price = priceOf(it);
    if (price > gold) return;
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
function InvocationManager({ ch, onInvocations, readOnly }) {
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const [open, setOpen] = useState(false);
  if (!wl || wl.level < 2) return null;
  const cap = INVOCATIONS(wl.level);
  const mine = ch.invocations || [];
  const knownCantrips = ch.spells?.Warlock?.cantrips || [];
  const hasEB = knownCantrips.some((n) => /eldritch blast/i.test(n));
  const reqMet = (req) => !req || (req === "eldritch blast cantrip" ? hasEB : ch.pactBoon === req);
  const options = INVOCATION_DATA.filter(([n, lvl, req, src, sources]) => !mine.includes(n) && wl.level >= lvl && isSourceEnabled({ src, sources }));
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
          const plain = (n) => n.replace(/\*+$/, "");
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
function SpellManager({ ch, customs, onSpells, onUpdate, onPrepare, onUse, readOnly }) {
  const casters = ch.classes.filter((c) => CLASSES[c.name].caster);
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const hasBoAS = (ch.invocations || []).includes("Book of Ancient Secrets");
  const hasTome = ch.pactBoon === "Pact of the Tome";
  const [adding, setAdding] = useState(null);
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

  const spLvl = (n) => pool.find((sp) => sp.name === n)?.level ?? SPELL_LVL_HINT[n] ?? 1;
  const slotsAll = spellSlots(ch.classes) || [];
  const usedSlotsArr = ch.usedSlots || [];
  const pactAll = wl ? PACT(wl.level) : null;
  const pactLeft = pactAll ? pactAll.n - Math.min(ch.usedPact || 0, pactAll.n) : 0;
  const featSpellNames = new Set([...featSp.flatMap((e) => e.names), ...raceGrantedSpells(ch), ...(classLevel(ch, "Ranger") >= 1 ? ["Hunter's Mark"] : [])]);
  const canPay = (n) => {
    const lvl = spLvl(n);
    if (lvl === 0) return true;
    if (featSpellNames.has(n)) return true;
    if (invocationFor(ch, n)?.atWill) return true;
    if (pool.find((s) => s.name === n)?.ritual) return true;
    if (Object.entries(book.Warlock?.arcanum || {}).some(([l, an]) => an === n && !(ch.usedArcanum || []).includes(+l))) return true;
    for (let L = lvl; L <= slotsAll.length; L++) if ((slotsAll[L - 1] || 0) - Math.min(usedSlotsArr[L - 1] || 0, slotsAll[L - 1] || 0) > 0) return true;
    return !!(pactAll && pactAll.lvl >= lvl && pactLeft > 0);
  };
  const activeFxNames = new Set(effectsOf(ch).map((e) => { const d = effDefOf(e); return d ? d.match || d.name : e.name; }));
  const groups = new Map();
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
  invocationSpellsOf(ch).forEach(({ invocation, spell, atWill }) =>
    addGroup(spLvl(spell), `${invocation} · invocation · ${atWill ? "at will" : "once per long rest · pact slot"}`, [spell], "#b48ead"));
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
function ChoiceManager({ ch, customs, onUpdate }) {
  const groups = characterChoiceGroups(ch, customs);
  const [open, setOpen] = useState(null);
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
const pillBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.edge}`, background: T.panel, color: T.gold, fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" };
const pip = (filled, color) => ({ cursor: "pointer", fontSize: 18, fontFamily: "Georgia, serif", color: filled ? color : T.dim, opacity: filled ? 1 : 0.45, userSelect: "none", padding: "0 1px" });
const fieldStyle = { background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: "8px 10px", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
const FX_KIND_COLOR = { Spell: "#6c91e0", Feature: "#7fb069", Feat: "#c77dca", Action: "#5eb1bf", Condition: "#d76a76", Custom: "#c9a44c", Bestiary: "#c9a44c" };
function EffectsCard({ ch, customs, fx, onUpdate, readOnly }) {
  const effects = effectsOf(ch);
  const tempHp = Math.max(0, ch.tempHp || 0);
  const dmgRaw = Math.max(0, ch.dmg || 0);
  const [adding, setAdding] = useState(false);
  // Ending a max HP grant refunds the amount from recorded damage so current HP only drops if above the new maximum.
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
function FeatureUsesCard({ ch, customs, onUpdate, onUse, readOnly }) {
  const trackers = useTrackersFor(ch, customs);
  const used = ch.usedFeatures || {};
  const [forging, setForging] = useState(false);
  const [form, setForm] = useState({ name: "", max: "3", per: "long" });
  const usedOf = (t) => Math.max(0, Math.min(used[t.key] || 0, t.max));
  const setUsed = (t, n) => onUpdate({ usedFeatures: { ...used, [t.key]: Math.max(0, Math.min(t.max, n)) } });
  const spend = (t) => {
    const patch = { usedFeatures: { ...used, [t.key]: usedOf(t) + 1 } };
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
  const [pending, setPending] = useState(null);
  const [val, setVal] = useState(1);
  const [ally, setAlly] = useState(false);
  const [concAsk, setConcAsk] = useState(null);
  const [custom, setCustom] = useState(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const sheetField = { ...fieldStyle, fontSize: 16 };
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
function MinionsCard({ ch, customs, onUpdate, onSummon, onRoll, onDice, readOnly }) {
  const minions = minionsOf(ch);
  const [amt, setAmt] = useState(1);
  const [rolling, setRolling] = useState(null);
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
        const slot = rolling.slot || null;
        const spellAtk = attacks.some((a) => a.useSpellAtk) ? summonerSpellAtk(ch, rolling.source) : null;
        const dmgBonus = (a) => a.bonus + (a.scaled && slot ? slot : 0);
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
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const sheetField = { ...fieldStyle, fontSize: 16 };
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
function SourcebookSheet({ customs, off, onToggle, onEnableAll, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const inv = new Map();
  const bump = (code, kind) => {
    if (!code) return;
    const e = inv.get(code) || { spells: 0, creatures: 0, items: 0, feats: 0 };
    e[kind] = (e[kind] || 0) + 1;
    inv.set(code, e);
  };
  (customs?.spells || []).forEach((sp) => sourceCodesOf(sp).forEach((c) => bump(c, "spells")));
  (customs?.feats || []).forEach((f) => sourceCodesOf(f).forEach((c) => bump(c, "feats")));
  (customs?.items || []).forEach((it) => sourceCodesOf(it).forEach((c) => bump(c, "items")));
  __BESTIARY.forEach((b) => sourceCodesOf(b).forEach((c) => bump(c, "creatures")));
  const sources = __SOURCES.length
    ? __SOURCES.filter((s) => inv.has(s.code))
    : [...inv.keys()].map((code) => ({ code, name: code, published: "2014-01-01" }));
  const rows = sources.map((s) => ({
    code: s.code,
    name: s.name,
    counts: inv.get(s.code) || {},
  })).sort((a, b) => {
    const isSRD_A = a.code === "SRD" || a.code === "PHB";
    const isSRD_B = b.code === "SRD" || b.code === "PHB";
    if (isSRD_A !== isSRD_B) return isSRD_A ? -1 : 1;
    return a.name.localeCompare(b.name);
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
            {rows.map((row) => {
              const on = !off.has(row.code);
              const n = row.counts;
              return (
                <div key={row.code} data-src-row={row.code} onClick={() => onToggle(row.code)}
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, boxSizing: "border-box", padding: "8px 12px", borderRadius: 10, cursor: "pointer", background: T.panel2, border: `1px solid ${on ? T.edge : "#8e3b4688"}`, opacity: on ? 1 : 0.6, WebkitTapHighlightColor: "transparent" }}>
                  <span style={{ fontSize: 17, fontFamily: "Georgia, serif", color: on ? T.gold : T.dim }}>{on ? "◆" : "◇"}</span>
                  <span style={{ flex: 1, color: T.ink, fontWeight: 700, fontSize: 13.5, textDecoration: on ? "none" : "line-through" }}>{row.name}</span>
                  <span style={{ color: T.dim, fontSize: 11.5, textAlign: "right" }}>
                    {[
                      n.spells ? `${n.spells} spell${n.spells > 1 ? "s" : ""}` : "",
                      n.creatures ? `${n.creatures} creature${n.creatures > 1 ? "s" : ""}` : "",
                      n.items ? `${n.items} item${n.items > 1 ? "s" : ""}` : "",
                      n.feats ? `${n.feats} feat${n.feats > 1 ? "s" : ""}` : "",
                    ].filter(Boolean).join(" · ")}
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
function UsePrompt({ name, ch, customs, onUpdate, onDice, onBlade, onStrike, onSummon, onClose }) {
  const recipe = useRecipe(name, ch, customs);
  const sp = recipe?.sp || null, tracker = recipe?.tracker || null, effs = recipe?.effs || [];
  const [variant, setVariant] = useState(0);
  const [bladeWpn, setBladeWpn] = useState(0);
  const eff = effs[Math.min(variant, Math.max(0, effs.length - 1))] || null;
  const blade = !!sp && isBladeCantrip(sp.name);
  const meleeOptions = blade ? equippedOf(ch).map((r) => findItem(r.name, customs)).filter((x) => x && x.type === "M") : [];
  const bladeLvl = totalLevel(ch);
  const bladeTier = bladeRiderTier(bladeLvl);
  const strike = sp && !blade && !eff ? strikeProfile(sp) : null;
  const damaging = !!strike;

  const slots = spellSlots(ch.classes) || [];
  const usedSlots = ch.usedSlots || [];
  const wl = ch.classes.find((c) => c.name === "Warlock");
  const pact = wl ? PACT(wl.level) : null;
  const usedPact = pact ? Math.min(ch.usedPact || 0, pact.n) : 0;
  const usedArc = ch.usedArcanum || [];
  const arcanum = ch.spells?.Warlock?.arcanum || {};
  const usedFeats = ch.usedFeatures || {};
  const boasOnly = sp ? (ch.boasRituals || []).includes(sp.name) && !knownSpellNames(ch, customs).has(sp.name) : false;
  const options = [];
  const atWillInv = sp && invocationFor(ch, sp.name)?.atWill ? invocationFor(ch, sp.name) : null;
  if (atWillInv) options.push({ id: "atwill", type: "atwill", lvl: sp.level, left: Infinity, label: `At will · ${atWillInv.invocation} — no slot` });
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

  const summonDef = summonDefFor(recipe.name) || spiritDefFromSpell(sp);

  const slotVal = chosen && chosen.lvl != null && chosen.type !== "ritual" && chosen.type !== "tracker" ? chosen.lvl : null;
  const clampIn = (v) => (eff?.input ? Math.max(eff.input.min, Math.min(eff.input.max, parseInt(v, 10) || eff.input.def)) : undefined);
  const effVal = eff?.input ? (eff.input.unit === "slot" ? clampIn(slotVal ?? eff.input.def) : clampIn(manual)) : undefined;
  const grantTemp = eff?.tempHp ? eff.tempHp(effVal, ch) : 0;

  const activeInst = effs.map((d) => effectsOf(ch).find((e) => e.key === d.key)).find(Boolean) || null;
  const concNow = effectsOf(ch).filter(isConcInst);
  const spConc = !eff && sp ? /concentration/i.test(sp.duration || "") : false;
  const concEnding = eff?.conc ? concNow.filter((e) => e.key !== eff.key) : spConc ? concNow.filter((e) => !(e.key === "custom" && e.name === sp.name)) : [];
  const verb = sp ? "Cast" : tracker ? "Use" : "Declare";
  const freeToggle = options.length === 0 && !!activeInst;
  const spellClassOf = () => {
    if (!sp) return null;
    for (const c of ch.classes) {
      const b = (ch.spells || {})[c.name];
      if (b && (["cantrips", "spells"].some((k) => (b[k] || []).includes(sp.name)) || Object.values(b.arcanum || {}).includes(sp.name))) return c.name;
    }
    if ((ch.tomeCantrips || []).includes(sp.name) || (ch.boasRituals || []).includes(sp.name) || invocationFor(ch, sp.name)) return "Warlock";
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
      else if (chosen.type === "atwill") bits.push(`at will by ${atWillInv.invocation} — no slot`);
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
function FeaturesCard({ ch, customs, onUpdate, onUse, spent, readOnly }) {
  const [readAll, setReadAll] = useState(false);
  const [draft, setDraft] = useState(null);
  const buckets = featureBuckets(ch, customs);
  const boons = ch.boons || [];
  const saveBoon = () => {
    const name = draft.name.trim();
    if (!name) return;
    onUpdate({ boons: [...boons, { id: uid(), name, source: draft.source.trim(), text: draft.text.trim() }], log: [...(ch.log || []), `Granted: ${name}${draft.source.trim() ? ` (${draft.source.trim()})` : ""}.`] });
    setDraft(null);
  };
  const removeBoon = (b) => onUpdate({ boons: boons.filter((x) => x.id !== b.id), log: [...(ch.log || []), `Boon removed: ${b.name}.`] });
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17 }}>Features & Traits</div>
        <button onClick={() => setReadAll((v) => !v)} style={{ background: "transparent", border: "none", color: T.dim, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline dotted", fontFamily: "inherit" }}>{readAll ? "names only" : "read everything"}</button>
      </div>
      {buckets.map((b) => {
        const themed = (b.cls && CLASS_THEMES[b.cls]?.color) || T.gold;
        return (
          <div key={b.key} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.edge}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: T.ink, fontWeight: 700, fontSize: 14 }}>{b.cls ? <ClassTag name={b.cls} size={14}>{b.title}</ClassTag> : b.title}</span>
              {b.label && <span style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>{b.label}</span>}
            </div>
            {b.items.length === 0 && <div style={{ color: T.dim, fontSize: 12.5, marginTop: 4 }}>Nothing granted yet — anything the DM bestows lives here.</div>}
            {b.items.map((it, i) => {
              const isSpent = it.lore ? spent(it.lore) : false;
              const showBody = it.body && it.body !== it.detail && (readAll || b.key === "boons");
              return (
                <div key={it.id || `${it.name}-${i}`} style={{ marginTop: 5, opacity: isSpent ? 0.5 : 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 13, lineHeight: 1.5 }}>
                    {it.level != null && <span style={{ color: themed, fontSize: 10.5, fontWeight: 700, minWidth: 14 }}>{it.level}</span>}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {it.lore
                        ? <span {...lorePress(it.lore)} onClick={() => onUse(it.lore)} style={{ color: T.ink, cursor: "pointer" }}>{it.name}</span>
                        : <span style={{ color: T.ink }}>{it.name}</span>}
                      {it.detail && <span style={{ color: T.dim }}> · {it.detail}</span>}
                      {isSpent && <span style={{ color: T.dim, fontSize: 10.5 }}> ◇ spent</span>}
                    </span>
                    {b.key === "boons" && !readOnly && <button aria-label={`Remove ${it.name}`} onClick={() => removeBoon(it)} style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>✕</button>}
                  </div>
                  {showBody && <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginLeft: it.level != null ? 20 : 0 }}>{it.body}</div>}
                </div>
              );
            })}
            {b.key === "boons" && !readOnly && (draft ? (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                <input autoFocus value={draft.name} placeholder="Name — Blessing of the Raven Queen" onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={fieldStyle} />
                <input value={draft.source} placeholder="Granted by (optional) — the DM, a relic, a bargain…" onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={fieldStyle} />
                <textarea value={draft.text} rows={3} placeholder="What it does." onChange={(e) => setDraft({ ...draft, text: e.target.value })} style={{ ...fieldStyle, resize: "vertical" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...btn(true), opacity: draft.name.trim() ? 1 : 0.4 }} disabled={!draft.name.trim()} onClick={saveBoon}>Grant it</button>
                  <button style={btn(false)} onClick={() => setDraft(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setDraft({ name: "", source: "", text: "" })} style={{ ...btn(false), marginTop: 8, padding: "7px 12px", minHeight: 0, fontSize: 13 }}>+ Add a boon or grant</button>
            ))}
          </div>
        );
      })}
      <div style={{ color: T.dim, fontSize: 11, marginTop: 10 }}>{readOnly ? "Tap or hold any name to read it." : "Tap a name to use it — long-press to read."} Everything this character is entitled to, in one place.</div>
    </div>
  );
}
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
    icon: "book", title: "Features & Traits",
    items: [
      ["One block for the DM", "every trait, feature, feat, and choice this character holds — bucketed by race, background, class, subclass, and feats."],
      ["Read everything", "flips the whole block from names to full rules text; names only folds it back."],
      ["Boons & grants", "anything the DM bestows outside the rules — a blessing, a relic's gift, a bargain's price — gets written in here and shows on shared sheets."],
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
function ShareSheet({ ch, customs, onClose }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState(null);
  useEffect(() => {
    let live = true;
    encodeShare(ch, customs).then((u) => { if (live) setUrl(u); }, () => { if (live) setFailed(true); });
    drawShareCard(ch, customs)
      .then((cv) => new Promise((res) => cv.toBlob((b) => res({ src: cv.toDataURL("image/png"), blob: b }), "image/png")))
      .then((c) => { if (live) setCard(c); })
      .catch(() => {});
    return () => { live = false; };
  }, [ch, customs]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch {
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
    if (card?.blob && navigator.canShare?.({ files: [new File([card.blob], "card.png", { type: "image/png" })] })) {
      const file = new File([card.blob], `${(ch.name || "character").replace(/[^\w -]/g, "")} — character card.png`, { type: "image/png" });
      try { await navigator.share({ files: [file], text: `${line}\n${url}` }); return; }
      catch (e) { if (e?.name === "AbortError") return; }
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

  const fx = fxMods(ch);
  const effMax = effMaxHp(ch, fx);
  const spd = speedOf(ch, customs, fx);
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
    const d = -delta;
    const fromTemp = Math.min(tempHp, d);
    const patch = {};
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
  const usedFeats = ch.usedFeatures || {};
  const trackers = useTrackersFor(ch, customs);
  const canPrep = ch.classes.some((c) => PREP_ALL_CLASSES.includes(c.name) && spellCapacity(c.name, c.level, ch.abilities).n > 0) && (customs?.spells || []).length > 0;
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
    const refund = effectsOf(ch).filter((e) => !kept.has(e.id)).reduce((s, e) => s + instMaxHp(e, ch), 0);
    onUpdate({ usedPact: 0, effects: restEffects("short"), usedFeatures: resetUses("short"), minions: restMinions("short"), ...(refund ? { dmg: Math.max(0, dmgRaw - refund) } : {}) });
  };
  const [prepOpen, setPrepOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [restAsk, setRestAsk] = useState(null);
  const [summoning, setSummoning] = useState(null);
  const longRest = () => {
    onUpdate({ dmg: 0, usedSlots: [], usedPact: 0, usedArcanum: [], tempHp: 0, effects: restEffects("long"), usedFeatures: {}, minions: restMinions("long") });
    if (canPrep) setPrepOpen(true);
  };

  const [rollSpec, setRollSpec] = useState(null);
  const [advMode, setAdvMode] = useState("normal");
  const [useTarget, setUseTarget] = useState(null);
  const openUse = (n) => {
    if (shared) { if (__showLore) __showLore(n); return; }
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
    ];
  };
  const rollIt = (title, parts, kind, abil, proficient, extra) => setRollSpec({ title, parts, kind, abil, proficient, extra });
  const fireAmmo = (it) => {
    if (shared || !usesAmmo(it)) return null;
    const row = ammoRowFor(ch, customs, it);
    if (!row) return `${it.name}: no ammunition in your pack — the quiver is empty!`;
    const left = (row.qty || 1) - 1;
    onUpdate({ inventory: left > 0 ? (ch.inventory || []).map((r) => (r.name === row.name ? { ...r, qty: left } : r)) : (ch.inventory || []).filter((r) => r.name !== row.name) });
    return `${row.name} spent — ${left > 0 ? `${left} left` : "that was the last one!"}`;
  };
  const [drinkRoll, setDrinkRoll] = useState(null);
  const decremented = (row) => (ch.inventory || []).flatMap((r) => (r.name === row.name ? ((r.qty || 1) > 1 ? [{ ...r, qty: (r.qty || 1) - 1 }] : []) : [r]));
  const consume = (row) => {
    const heal = healingDiceFor(row.name);
    if (heal) { setDrinkRoll({ row, title: row.name, dice: Array.from({ length: heal.n }, () => ({ sides: heal.sides, value: roll(heal.sides) })), bonus: heal.plus }); return; }
    const key = consumableEffectKey(row.name);
    const patch = { inventory: decremented(row), log: [...(ch.log || []), `Consumed ${row.name}.`] };
  };
  const acInfo = armorClass(ch, customs, fx);
  const [dmgRoll, setDmgRoll] = useState(null);
  const [pendingDmg, setPendingDmg] = useState(null);
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
  // Everything a weapon's damage roll shares with its attack roll: which ability, which properties, and the flat bonus.
  const weaponDamage = (it) => {
    const abil = weaponAbility(it);
    const props = (it.property || "").split(",").map((x) => x.trim());
    const dueling = hasStyle(ch, "Dueling") && it.type === "M" && !props.includes("2H") ? 2 : 0;
    const extras = fxDmg(it.type === "R" ? "ranged" : "melee", abil, props);
    const bonus = mod(ch.abilities[abil]) + dueling + extras.reduce((s, b) => s + b.value, 0);
    return { abil, props, dueling, extras, bonus };
  };
  const rollWeaponDamage = (it) => {
    const m = weaponDie(it).match(/(\d+)d(\d+)/);
    if (!m) return;
    const { abil, props, dueling, extras, bonus } = weaponDamage(it);
    const dmgNotes = rollNotes(ch, "dmg", abil);
    setDmgRoll({
      title: `${it.name} damage`,
      dice: Array.from({ length: +m[1] }, () => ({ sides: +m[2], value: roll(+m[2]) })),
      bonus, bonusLabel: [weaponAbilLabel(it, abil), dueling ? "Dueling" : null, ...extras.map((b) => b.label)].filter(Boolean).join(" + "),
      note: `${DMG_TYPES[it.dmgType] || "damage"}${it.dmg2 && !shillTarget(it) ? ` · versatile: ${it.dmg2} two-handed` : ""}${hasStyle(ch, "Great Weapon Fighting") && props.includes("2H") ? " · GWF: you may reroll 1s and 2s" : ""}${dmgNotes.length ? " · " + dmgNotes.join(" · ") : ""}`,
    });
  };
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
    const { abil, props, dueling, extras, bonus } = weaponDamage(it);
    const atkParts = [{ label: weaponAbilLabel(it, abil), value: mod(ch.abilities[abil]) }, { label: "proficiency", value: pb }, ...fxAtk("melee", abil, props)];
    const md = weaponDie(it).match(/(\d+)d(\d+)/);
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
  const strikeClassOf = (sp) =>
    ch.classes.find((c) => { const b = (ch.spells || {})[c.name]; return b && ["cantrips", "spells"].some((k) => (b[k] || []).includes(sp.name)); })?.name
    || ((ch.tomeCantrips || []).includes(sp.name) || invocationFor(ch, sp.name) ? "Warlock" : null)
    || ch.classes.find((c) => CLASSES[c.name].caster && spellFitsClass(sp, c.name, c.subclass))?.name
    || ch.classes.find((c) => CLASSES[c.name].caster)?.name || null;
  const bestMentalMod = () => Math.max(mod(ch.abilities.int), mod(ch.abilities.wis), mod(ch.abilities.cha));
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
      setDmgRoll(dmgSpec);
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
              const { abil, props, bonus: dmgBonus } = weaponDamage(it);
              const atkParts = [{ label: weaponAbilLabel(it, abil), value: mod(ch.abilities[abil]) }, { label: "proficiency", value: pb }, ...(it.type === "R" && feats.archery ? [{ label: "Archery", value: feats.archery }] : []), ...fxAtk(it.type === "R" ? "ranged" : "melee", abil, props)];
              const atkMod = atkParts.reduce((s, p) => s + p.value, 0);
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
                    .concat(CLASSES[c.name].asi.includes(l) && !(CLASSES[c.name].feats[l] || []).includes(ASI) ? [ASI] : [])
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
              const detail = featChoiceSummary(ch, f);
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
        <FeaturesCard ch={ch} customs={customs} onUpdate={onUpdate} onUse={openUse} spent={featureSpent} readOnly={shared} />
        {!shared && (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Chronicle</div>
            <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.8, maxHeight: 220, overflowY: "auto" }}>
              {ch.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...card, padding: 16, marginTop: 14 }}>
        <div style={{ color: T.gold, fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 8 }}>Notes</div>
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
          <textarea key={ch.notes || ""} defaultValue={ch.notes || ""} onBlur={(e) => onNotes(e.target.value)} rows={7}
            placeholder="Equipment, personality traits, ideals, bonds, flaws, debts owed to ravens…"
            style={{ width: "100%", boxSizing: "border-box", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 10, padding: 12, fontSize: 16, resize: "vertical", fontFamily: "inherit" }} />
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
      {!shared && drinkRoll && (
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
export { decodeShare, SourcebookSheet, Sheet };
