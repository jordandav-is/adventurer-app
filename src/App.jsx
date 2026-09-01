import { AccountPanel } from "./account.jsx";
import { EMPTY_CUSTOM, __BASE, exportLedger, fetchBaseCompendium, loadChars, loadCustom, loadSrcPrefs, mergeCompendium, mergeLedger, saveChars, saveCustom, saveSrcPrefs, setSourceExclusions, stripBase, unionCustoms } from "./compendium.js";
import { SYNC_URL } from "./sync-config.js";
import { effMaxHp, effectsOf, foldStarredSpells, totalLevel } from "./rules.js";
import { useEffect, useRef, useState } from "react";
import { ClassTag, GLOBAL_CSS, Icon, LoreSheet, Portrait, SHELL_STYLE, T, card } from "./ui.jsx";
import { CreateWizard, HorizonArt } from "./CreateWizard.jsx";
import { HomebrewForge } from "./HomebrewForge.jsx";
import { LevelUp } from "./LevelUp.jsx";
import { Sheet, SourcebookSheet, decodeShare } from "./Sheet.jsx";
export default function App() {
  const [chars, setChars] = useState(null);
  const [view, setView] = useState("roster");
  const [activeId, setActiveId] = useState(null);
  const [leveling, setLeveling] = useState(false);
  const [customs, setCustoms] = useState(EMPTY_CUSTOM);
  const [ioMsg, setIoMsg] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [srcOff, setSrcOff] = useState(() => new Set());
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [cloud, setCloud] = useState(null);
  const [account, setAccount] = useState(null);
  const [syncState, setSyncState] = useState("offline");
  const stateRef = useRef({});
  stateRef.current = { chars, customs, srcOff };
  const preload = useRef(null);
  const applySrcOff = (next) => { stateRef.current.srcOff = next; setSourceExclusions(next); setSrcOff(next); saveSrcPrefs(next); cloud ? cloud.pushPrefs([...next]) : (preload.current = { ...preload.current, prefs: [...next] }); };
  const toggleSource = (name) => {
    const next = new Set(srcOff);
    next.has(name) ? next.delete(name) : next.add(name);
    applySrcOff(next);
  };

  useEffect(() => {
    (async () => {
      const [cs, stored, base, srcPrefs] = await Promise.all([loadChars(), loadCustom(), fetchBaseCompendium(), loadSrcPrefs()]);
      setSourceExclusions(srcPrefs);
      setSrcOff(srcPrefs);
      let effective = stored;
      if (base) {
        effective = mergeCompendium(stored, base).customs;
        const slim = stripBase(stored, base);
        const shrunk = (stored.spells || []).length !== slim.spells.length || (stored.items || []).length !== slim.items.length
          || (stored.feats || []).length !== slim.feats.length || Object.keys(stored.featureTexts || {}).length !== Object.keys(slim.featureTexts).length
          || Object.values(stored.subs || {}).flat().length !== Object.values(slim.subs).flat().length;
        if (shrunk) saveCustom(slim);
      }
      effective = { ...effective, spells: foldStarredSpells(effective.spells || []) };
      setCustoms(effective);

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
  const booted = chars !== null;
  useEffect(() => {
    if (!booted || !SYNC_URL) return;
    const load = () => import("./sync.js").then((m) => {
      const p = preload.current; preload.current = null;
      if (p) { (p.del || []).forEach(m.deleteChar); p.chars && m.pushChars(p.chars, p.prevChars); p.custom && m.pushCustom(p.custom); p.prefs && m.pushPrefs(p.prefs); }
      setCloud(m); setAccount(m.getAccount()?.email || null);
    }).catch(() => addEventListener("online", load, { once: true }));
    load();
  }, [booted]);
  useEffect(() => {
    if (!cloud || !account) return;
    return cloud.start({
      getLocal: () => ({ chars: stateRef.current.chars || [], custom: stripBase(stateRef.current.customs, __BASE), prefs: [...stateRef.current.srcOff] }),
      chars: (arr) => { stateRef.current.chars = arr; setChars(arr); saveChars(arr); },
      custom: (stored, first) => {
        const base = first ? unionCustoms(stored, stripBase(stateRef.current.customs, __BASE)) : stored;
        const eff = __BASE ? mergeCompendium(base, __BASE).customs : base;
        const folded = { ...eff, spells: foldStarredSpells(eff.spells || []) };
        stateRef.current.customs = folded; setCustoms(folded);
        const s = stripBase(folded, __BASE); saveCustom(s);
        if (first) cloud.pushCustom(s);
      },
      prefs: (off) => { const s = new Set(off); stateRef.current.srcOff = s; setSourceExclusions(s); setSrcOff(s); saveSrcPrefs(s); },
      photo: (id, p) => {
        const next = (stateRef.current.chars || []).map((c) => (c.id === id ? { ...c, photo: p } : c));
        stateRef.current.chars = next; setChars(next); saveChars(next);
      },
      status: setSyncState,
      error: setIoMsg,
      signedOut: () => setAccount(null),
    });
  }, [cloud, account]);
  useEffect(() => { // Navigate back to the roster if a remote sync deletion removes the active character.
    if (activeId && chars && !chars.some((c) => c.id === activeId)) { setActiveId(null); setView((v) => (v === "sheet" ? "roster" : v)); }
  }, [chars, activeId]);

  const persistCustom = (next) => { stateRef.current.customs = next; setCustoms(next); const s = stripBase(next, __BASE); saveCustom(s); cloud ? cloud.pushCustom(s) : (preload.current = { ...preload.current, custom: s }); };
  const persist = (next) => {
    const prev = stateRef.current.chars;
    stateRef.current.chars = next; setChars(next); saveChars(next);
    cloud ? cloud.pushChars(next, prev) : (preload.current = { ...preload.current, chars: next, prevChars: preload.current?.prevChars ?? prev });
  };

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
            <button aria-label="Ledger tools" title="Homebrew, backups & account" onClick={() => setToolsOpen(!toolsOpen)}
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
                <AccountPanel cloud={cloud} account={account} syncState={syncState} onAccount={setAccount} toolRow={toolRow} hint={hint} theme={T} />
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
          onDelete={() => { cloud ? cloud.deleteChar(active.id) : (preload.current = { ...preload.current, del: [...(preload.current?.del || []), active.id] }); persist(chars.filter((c) => c.id !== active.id)); setView("roster"); }}
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
export function SharedView({ token, onExit }) {
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
        const customs = base ? mergeCompendium(payload.x, base).customs : payload.x;
        if (!live) return;
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
