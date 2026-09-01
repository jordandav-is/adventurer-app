import { CLASSES, FEATS } from "./data.js";
import { parseCompendiumXML } from "./compendium.js";
import { useState } from "react";
import { T, btn, card } from "./ui.jsx";
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
        const oldFeats = new Map(customs.feats.map((f) => [f.name, f]));
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
    const inFeats = new Map(parsed.feats.map((f) => [f.name, f]));
    const feats = [...customs.feats.map((f) => inFeats.get(f.name) || f), ...parsed.feats.filter((f) => !customs.feats.some((o) => o.name === f.name))];
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
export { HomebrewForge };
