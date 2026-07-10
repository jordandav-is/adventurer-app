import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./storage-shim.js";
import App, { SharedView } from "./App.jsx";
import Gate from "./gate.jsx";

/* A #share= fragment means a shared read-only sheet, not the app: the character
   rides inside the fragment itself (it never reaches any server), so the viewer
   needs no passphrase — the link shows exactly one snapshot and nothing else,
   and the gate stays shut on everything that matters.

   The fragment is a LIVE route, not a boot-time fork. Sharers are usually
   ledger-keepers themselves, so a share link often lands in a tab where the
   app is already open — a fragment-only navigation that fires no reload. We
   listen for it and swap views in place, both directions: a link opens the
   shared sheet immediately, and its "your own ledger" door steps back into
   the app. Local storage is never touched on either crossing. */
const readShareToken = () => (window.location.hash.match(/^#share=([0-9A-Za-z_-]+)/) || [])[1] || null;

function Root() {
  const [token, setToken] = useState(readShareToken);
  useEffect(() => {
    const onHash = () => setToken(readShareToken());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const exitShare = () => {
    // shed the fragment without a reload, so the app boots warm and storage stays put
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    document.title = "The Adventurer's Ledger";
    setToken(null);
  };
  return token ? (
    <SharedView key={token} token={token} onExit={exitShare} />
  ) : (
    <Gate>
      <App />
    </Gate>
  );
}

createRoot(document.getElementById("root")).render(<Root />);

// Register the service worker for offline play at the table.
// Relative path works at any host root or GitHub Pages subpath.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
