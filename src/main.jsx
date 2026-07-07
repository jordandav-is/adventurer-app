import React from "react";
import { createRoot } from "react-dom/client";
import "./storage-shim.js";
import App from "./App.jsx";
import Gate from "./gate.jsx";

createRoot(document.getElementById("root")).render(
  <Gate>
    <App />
  </Gate>
);

// Register the service worker for offline play at the table.
// Relative path works at any host root or GitHub Pages subpath.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
