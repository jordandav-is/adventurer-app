import React from "react";
import { createRoot } from "react-dom/client";
import "./storage-shim.js";
import App, { SharedView } from "./App.jsx";
import Gate from "./gate.jsx";

/* A #share= fragment means this visit is a shared read-only sheet, not the app:
   the character rides inside the fragment itself (it never reaches any server),
   so the viewer needs no passphrase — the link shows exactly one snapshot and
   nothing else, and the gate stays shut on everything that matters. */
const shareToken = (window.location.hash.match(/^#share=([0-9A-Za-z_-]+)/) || [])[1];

createRoot(document.getElementById("root")).render(
  shareToken ? (
    <SharedView token={shareToken} />
  ) : (
    <Gate>
      <App />
    </Gate>
  )
);

// Register the service worker for offline play at the table.
// Relative path works at any host root or GitHub Pages subpath.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
