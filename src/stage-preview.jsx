import { useState } from "react";
import { createRoot } from "react-dom/client";
import StageView from "./stage-view.jsx";

function closePreview() {
  const referrer = document.referrer ? new URL(document.referrer) : null;
  if (referrer?.origin === location.origin && history.length > 1) history.back();
  else location.assign(import.meta.env.BASE_URL);
}

function StagePreview() {
  const [env, setEnv] = useState("dawn");
  const [background, setBackground] = useState(() => new URLSearchParams(location.search).get("background") === "woodland" ? "woodland" : "cathedral");
  return <StageView url={`${import.meta.env.BASE_URL}.preview-assets/ranger.glb`} name="The Horned Ranger" classes={[{ name: "Ranger", level: 1 }]} facing={-Math.PI / 2} env={env} onEnv={setEnv} background={background} onBackground={setBackground} initialFraming={new URLSearchParams(location.search).get("framing") || "full"} onClose={closePreview} />;
}

createRoot(document.getElementById("root")).render(<StagePreview />);
