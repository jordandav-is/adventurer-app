import { useEffect, useMemo, useRef, useState } from "react";
import { buildRoll20Transfer } from "./roll20-export.js";
import importerSource from "../public/roll20-importer.js?raw";
import { T, btn, card } from "./ui.jsx";

const bookmarklet = `javascript:${encodeURIComponent(`void function () {\n${importerSource}\n}();`)}`;
const inputStyle = { width: "100%", boxSizing: "border-box", background: T.panel2, color: T.ink, border: `1px solid ${T.edge}`, borderRadius: 8, padding: 10, font: "inherit" };

export function Roll20TransferView({ ch, customs }) {
  const [selection, setSelection] = useState("full");
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState("core");
  const [status, setStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const bookmark = useRef(null);
  const result = useMemo(() => {
    try { return { transfer: buildRoll20Transfer(ch, customs) }; }
    catch (error) { return { error: error.message }; }
  }, [ch, customs]);
  const transfer = result.transfer;
  const choice = transfer?.choices.find((entry) => entry.id === selection);
  const selectedIds = choice ? new Set(choice.operationIds) : null;
  const selectedOperations = transfer ? transfer.payload.operations.filter((operation) => selection === "full" || selectedIds?.has(operation.id)) : [];
  const featuresOnly = selectedOperations.length > 0 && selectedOperations.every((operation) => operation.kind === "row" && operation.section === "traits");
  const operations = featuresOnly && destination === "bio" ? selectedOperations.map((operation) => ({
    id: `bio:${operation.id}`, group: "Bio", label: operation.label, kind: "bio", field: "additional_feature_and_traits",
    text: [operation.values.name, [operation.values.source, operation.values.source_type].filter(Boolean).join(" · "), operation.values.description].filter(Boolean).join("\n"),
  })) : selectedOperations;
  const label = selection === "full" ? `Full character: ${ch.name}` : choice?.label || "Choose something to copy";
  const payload = transfer ? { ...transfer.payload, label, operations } : null;
  const allChoices = (transfer?.choices || []).filter((entry) => entry.id !== "full");
  const matchingChoices = allChoices.filter((entry) =>
    `${entry.group} ${entry.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())
  );
  const categoryChoices = matchingChoices.filter((entry) => entry.isCategory);
  const groups = [...new Set(matchingChoices.map((entry) => entry.group))];
  useEffect(() => {
    if (bookmark.current) bookmark.current.setAttribute("href", bookmarklet);
  }, [showSetup]);

  const copy = async (text, message) => {
    setStatus("");
    setManualCopy(null);
    try {
      await navigator.clipboard.writeText(text);
      setStatus(message);
    } catch {
      setManualCopy(text);
      setStatus("Clipboard access is unavailable. Select the text below and copy it manually.");
    }
  };
  const choose = (id) => { setSelection(id); setDestination("core"); setStatus(""); setManualCopy(null); };
  const copyFull = () => {
    if (!transfer) return;
    choose("full");
    copy(JSON.stringify({ ...transfer.payload, label: `Full character: ${ch.name}` }), "Full character copied. Open Roll20, run Ledger → Roll20, paste, and review the target and changes.");
  };

  return (
    <div>
      <p style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>Copy one thing or {ch.name}’s full character sheet. Nothing changes in Roll20 until you review and apply it there.</p>
      {result.error ? <p role="alert" style={{ color: "#d76a76" }}>Cannot prepare this character: {result.error}</p> : <>
        <button onClick={copyFull} style={{ ...btn(true), width: "100%", marginBottom: 14 }}>Copy full character</button>
        <label htmlFor="roll20-search" style={{ display: "block", color: T.dim, fontSize: 13, marginBottom: 6 }}>Or find one spell, feature, feat, ability, proficiency, expertise, or section</label>
        <input id="roll20-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this character’s exportable content" style={inputStyle} />
        <label htmlFor="roll20-choice" style={{ display: "block", margin: "12px 0 6px", fontSize: 13 }}>What to copy</label>
        <select id="roll20-choice" value={selection} onChange={(event) => choose(event.target.value)} style={inputStyle}>
          <option value="full">⭐ Full Character Sheet ({ch.name})</option>
          {categoryChoices.length > 0 && (
            <optgroup label="📦 Entire Categories (Equipment, Spells, Skills…)">
              {categoryChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  📁 {c.label}
                </option>
              ))}
            </optgroup>
          )}
          {groups.map((group) => {
            const groupChoices = matchingChoices.filter((entry) => entry.group === group);
            return (
              <optgroup key={group} label={group}>
                {groupChoices.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.isCategory ? `📁 ${entry.label}` : entry.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {query && !matchingChoices.length && <p style={{ color: T.dim, fontSize: 13 }}>No matching content on this character.</p>}
        {featuresOnly && <fieldset style={{ border: `1px solid ${T.edge}`, borderRadius: 8, margin: "14px 0", padding: 10 }}>
          <legend style={{ color: T.dim, fontSize: 13 }}>Feature destination</legend>
          <label style={{ display: "block", marginBottom: 8 }}><input type="radio" name="roll20-destination" checked={destination === "core"} onChange={() => setDestination("core")} /> Core · Features & Traits</label>
          <label style={{ display: "block" }}><input type="radio" name="roll20-destination" checked={destination === "bio"} onChange={() => setDestination("bio")} /> Bio · Additional Features & Traits</label>
        </fieldset>}
        <div style={{ margin: "14px 0", padding: 12, borderRadius: 8, background: T.panel2, fontSize: 13 }}>
          <strong style={{ color: T.gold }}>{label}</strong>
          <div style={{ color: T.dim, marginTop: 6 }}>{operations.length} transfer {operations.length === 1 ? "entry" : "entries"}. Existing repeating content is skipped by default; updates require your choice in Roll20.</div>
          <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer" }}>Inspect included entries</summary><ul style={{ paddingLeft: 20, maxHeight: 180, overflowY: "auto" }}>{operations.map((operation) => <li key={operation.id}>{operation.group} · {operation.label}</li>)}</ul></details>
        </div>
        {!!payload?.warnings?.length && <details style={{ color: T.dim, fontSize: 13, marginBottom: 14 }} open><summary>Transfer notes ({payload.warnings.length})</summary><ul style={{ paddingLeft: 20 }}>{payload.warnings.map((warning, index) => <li key={index} style={{ marginTop: 6 }}>{warning}</li>)}</ul></details>}
        <button disabled={!operations.length} onClick={() => copy(JSON.stringify(payload), `${label} copied. Run the bookmarklet in Roll20, paste, and review.`)} style={{ ...btn(true), width: "100%" }}>Copy {selection === "full" ? "full character" : "selection"} for Roll20</button>
      </>}
      <div role="status" aria-live="polite" style={{ color: manualCopy ? T.gold : T.green, fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{status}</div>
      {manualCopy !== null && <textarea aria-label="Copy transfer text manually" readOnly value={manualCopy} onFocus={(event) => event.target.select()} rows={6} style={{ ...inputStyle, marginTop: 8, fontFamily: "monospace", fontSize: 12 }} />}
      <button onClick={() => setShowSetup(!showSetup)} aria-expanded={showSetup} style={{ ...btn(false), width: "100%", marginTop: 20 }}>{showSetup ? "Hide bookmarklet setup" : "Install the Roll20 bookmarklet"}</button>
      {showSetup && <div style={{ fontSize: 13, lineHeight: 1.6, color: T.dim }}>
        <ol style={{ paddingLeft: 20 }}>
          <li>Show your browser’s bookmarks bar. Drag the link below onto it, or create a bookmark and paste the copied bookmark URL into its URL field.</li>
          <li>Open your Roll20 game and the target <strong>D&amp;D 5E (2014) / OGL</strong> character sheet. Use a test character for your first transfer.</li>
          <li>Copy content here, switch to Roll20, click the bookmark, and paste into its input. Check the character, duplicates, and selected changes before Apply.</li>
        </ol>
        <a ref={bookmark} draggable onClick={(event) => event.preventDefault()} style={{ display: "block", border: `1px dashed ${T.gold}`, padding: 12, borderRadius: 8, textAlign: "center", color: T.gold, cursor: "grab" }}>Ledger → Roll20</a>
        <button onClick={() => copy(bookmarklet, "Bookmark URL copied. Paste it into a bookmark’s URL field, not into the game chat.")} style={{ ...btn(false), width: "100%", marginTop: 8 }}>Copy bookmark URL</button>
        <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer" }}>Console fallback</summary>
          <p>If your browser blocks the bookmark, run this same self-contained importer in the Roll20 game’s developer console. Review code before executing it; it runs with your character-edit permissions.</p>
          <button onClick={() => copy(importerSource, "Importer code copied. Run it in the Roll20 game console, then copy your selected transfer data again.")} style={btn(false)}>Copy importer code</button>
        </details>
        <p>This uses private Roll20 client APIs. It does not support the D&amp;D 2024 sheet or bypass permissions. Reopen the character after applying to check persistence. Portraits, token art, and Ledger’s 3D presentation are not installed by this bookmarklet.</p>
      </div>}
    </div>
  );
}

export function Roll20Transfer({ ch, customs, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  const keydown = (event) => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000000c8", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="roll20-transfer-title" tabIndex={-1} onKeyDown={keydown} onClick={(event) => event.stopPropagation()}
        style={{ ...card, width: "min(720px, 100%)", maxHeight: "92dvh", borderRadius: "16px 16px 0 0", overflowY: "auto", padding: "20px 20px calc(24px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
          <h2 id="roll20-transfer-title" style={{ margin: 0, color: T.gold, fontFamily: "Georgia, serif" }}>Send to Roll20</h2>
          <button aria-label="Close Roll20 transfer" onClick={onClose} style={{ ...btn(false), minWidth: 44 }}>×</button>
        </header>
        <Roll20TransferView ch={ch} customs={customs} />
      </section>
    </div>
  );
}
