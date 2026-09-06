import { useEffect, useRef, useState } from "react";
import Stage, { BACKGROUNDS, ENVS } from "./stage.jsx";
import { ClassTag } from "./ui.jsx";
import "./stage-preview.css";

const MOODS = {
  dawn: { color: "#e9c58a", time: "I" },
  noon: { color: "#cedede", time: "II" },
  dusk: { color: "#c38d88", time: "III" },
  night: { color: "#9baacb", time: "IV" },
};

export default function StageView({ url, name, classes, facing = 0, env = "dawn", background = "woodland", initialFraming = "full", onEnv, onBackground, onClose, onPick }) {
  const [localUrl, setLocalUrl] = useState(null);
  const [localName, setLocalName] = useState(null);
  const [motion, setMotion] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [framing, setFraming] = useState(initialFraming);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [backgroundResult, setBackgroundResult] = useState(null);
  const [panelOpen, setPanelOpen] = useState(!url);
  const handle = useRef(null);
  const source = localUrl || url;
  const displayName = localName || name;
  const displayClasses = localName ? null : classes;
  const backgroundKey = Object.hasOwn(BACKGROUNDS, background) ? background : "woodland";
  const backgroundState = backgroundResult?.key === backgroundKey ? backgroundResult.status : "loading";
  const state = result && result.source === source ? (result.error ? "error" : "ready") : source ? "loading" : "empty";
  const failure = error || (state === "error" ? result.error : "") || (backgroundState === "error" ? backgroundResult.error : "");
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const ready = (failure) => {
    setResult({ source, error: failure?.message || "" });
    if (!failure && !result) { setFraming(initialFraming); handle.current?.setFraming(initialFraming); }
  };
  const frame = (value) => { setFraming(value); handle.current?.setFraming(value); };
  const reset = () => { setFraming("full"); handle.current?.reset(); };
  const openModel = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) { setError("Choose a self-contained .glb file with embedded textures."); return; }
    setLocalUrl(URL.createObjectURL(file));
    setLocalName(file.name.replace(/\.glb$/i, "").replace(/[-_]/g, " "));
    setError(""); setFraming("full");
  };
  const snapshot = async () => {
    try {
      setError("");
      const blob = await handle.current.snapshot();
      if (onPick) { await onPick(blob); return; }
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl; link.download = `${backgroundKey}-portrait.jpg`; link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (failure) { setError(failure.message); }
  };

  return <div className="atelier" role="dialog" aria-modal="true" aria-label="3D figure viewer" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <Stage url={source} env={env} background={backgroundKey} motion={motion} facing={localUrl ? 0 : facing} onHandle={(api) => { handle.current = api; }} onReady={ready} onBackgroundState={setBackgroundResult} onFramingChange={setFraming} />
    <div className="atelier-shade" aria-hidden="true" />
    <div className="viewer-header">
      <div className="viewer-wordmark">The Adventurer's Ledger</div>
      {displayName && <div className="viewer-char-name">{displayName}</div>}
      {displayClasses?.length > 0 && (
        <div className="viewer-char-classes">
          {displayClasses.map((c, i) => (
            <span key={c.name || i} className="viewer-class-entry">
              {i > 0 ? " / " : ""}
              <ClassTag name={c.name} size={13} /> {c.level}
            </span>
          ))}
        </div>
      )}
    </div>
    <button className="viewer-close" aria-label="Close 3D viewer" onClick={onClose} autoFocus>×</button>
    <button className="settings-toggle" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen} aria-controls="scene-settings">{panelOpen ? "Close settings" : "Scene settings"}</button>
    <aside id="scene-settings" className={`scene-panel ${panelOpen ? "is-open" : ""}`} aria-label="Scene settings">
      <div className="panel-heading"><span className="eyebrow">THE ENVIRONMENT</span><span className="panel-ornament" aria-hidden="true">✧</span></div>
      <fieldset className="mood-picker background-picker">
        <legend>Background</legend>
        {Object.entries(BACKGROUNDS).map(([key, value]) => <label key={key} className={`mood-option background-option ${backgroundKey === key ? "selected" : ""}`}>
          <input type="radio" name="background" value={key} checked={backgroundKey === key} onChange={() => onBackground(key)} />
          <span className={`background-swatch background-${key}`} aria-hidden="true" />
          <span>{value.name}</span>
        </label>)}
      </fieldset>
      <div className="panel-divider" />
      <fieldset className="mood-picker">
        <legend>Light & atmosphere</legend>
        {Object.entries(ENVS).map(([key, value]) => <label key={key} className={`mood-option ${env === key ? "selected" : ""}`}>
          <input type="radio" name="mood" value={key} checked={env === key} onChange={() => onEnv(key)} />
          <span className={`mood-swatch mood-${key}`} style={{ "--mood": MOODS[key].color }} aria-hidden="true" />
          <span>{key === "night" && backgroundKey === "cathedral" ? "Moonlit vigil" : value.name}</span><small>{MOODS[key].time}</small>
        </label>)}
      </fieldset>
      <label className="motion-control"><input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} /><span>Living environment</span><span className="switch-track" aria-hidden="true" /></label>
      <div className="panel-divider" />
      <div className="panel-heading"><span className="eyebrow">FIGURE VIEW</span></div>
      {backgroundKey === "cathedral" && <button className={`outline-button grand-view ${framing === "grand" ? "active" : ""}`} aria-pressed={framing === "grand"} onClick={() => frame("grand")}>Grand view</button>}
      <div className="framing-control" aria-label="Character framing">
        <button className={framing === "full" ? "active" : ""} aria-pressed={framing === "full"} onClick={() => frame("full")}>Full figure</button>
        <button className={framing === "portrait" ? "active" : ""} aria-pressed={framing === "portrait"} onClick={() => frame("portrait")}>Portrait</button>
      </div>
      <div className="turn-controls">
        <button aria-label="Turn character left" title="Turn left" onClick={() => handle.current?.rotateBy(-Math.PI / 8)}>↶</button>
        <button className="reset-view" onClick={reset}>Reset view</button>
        <button aria-label="Turn character right" title="Turn right" onClick={() => handle.current?.rotateBy(Math.PI / 8)}>↷</button>
      </div>
      <div className="panel-divider" />
      <label className="outline-button open-model">Open a GLB file<input aria-label="Open a local GLB file" type="file" accept=".glb,model/gltf-binary" onChange={openModel} /></label>
      <button className="outline-button" disabled={state !== "ready" || backgroundState !== "ready" || !source} onClick={snapshot}>Save portrait</button>
    </aside>

    {(state === "loading" || backgroundState === "loading") && !failure && <div className="stage-status" role="status"><span className="loading-sigil" aria-hidden="true" /><span>Opening {backgroundKey === "cathedral" ? "the cathedral" : "the clearing"}…</span><small>{state === "loading" ? "Loading the figure and background" : "Loading the background textures"}</small></div>}
    {failure && <div className="stage-error" role="alert"><strong>{state === "error" ? "The viewer could not load" : "Could not complete that action"}</strong><span>{failure}</span><button onClick={() => setPanelOpen(true)}>Open scene settings</button></div>}

    <span className="gesture-hint">DRAG TO TURN <span>·</span> SCROLL TO ZOOM</span>
  </div>;
}
