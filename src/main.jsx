import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./storage-shim.js";
import App, { SharedView } from "./App.jsx";
import Gate from "./gate.jsx";

// Dynamic #share=<token> hash route loads read-only SharedView via hashchange events without touching localStorage.
const readShareToken = () => (window.location.hash.match(/^#share=([0-9A-Za-z_-]+)/) || [])[1] || null;

function Root() {
  const [token, setToken] = useState(readShareToken);
  useEffect(() => {
    const onHash = () => setToken(readShareToken());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const exitShare = () => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    document.title = "The Adventurer's Ledger";
    setToken(null);
  };
  if (token) return <SharedView key={token} token={token} onExit={exitShare} />;
  const app = <App />;
  return import.meta.env.DEV ? app : <Gate>{app}</Gate>;
}

createRoot(document.getElementById("root")).render(<Root />);

// Relative path supports custom domain roots and GitHub Pages subpaths.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((r) => r.update()).catch(() => {});
  });
}
