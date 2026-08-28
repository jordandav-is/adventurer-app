// ==UserScript==
// @name         Roll20 Drop Capture (Adventurer's Ledger)
// @namespace    adventurers-ledger
// @version      0.1
// @description  Read-only diagnostic: records what Roll20's own compendium drag & drop traffic looks like, for building the Ledger's drag bridge. Captures getPages requests/responses, native drop payloads, dragstart data, and compendium-related postMessage traffic. Download everything with the floating button.
// @match        https://app.roll20.net/editor/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* Install in Tampermonkey/Violentmonkey, open your game, then:
   1. Drag a compendium entry (spell, item, monster) from the sidebar onto a
      character sheet, and another onto the map.
   2. If you have the compendium open in a separate tab, drag from there too.
   3. Click the gold "Ledger capture" button (bottom-right) to download the
      JSON, and paste/attach it back to Claude.
   Purely observational — it never intercepts, blocks, or injects anything. */

(() => {
  "use strict";
  const cap = { started: new Date().toISOString(), getPages: [], drops: [], dragstarts: [], messages: [] };
  window.__r20cap = cap;
  const log = (...a) => console.log("[ledger-capture]", ...a);
  const clip = (s, n = 20000) => (typeof s === "string" && s.length > n ? s.slice(0, n) + `…<<clipped ${s.length} chars>>` : s);

  /* --- network: fetch + XHR carrying getPages --- */
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (/getPages|compendium/i.test(url)) {
        const body = await res.clone().text();
        cap.getPages.push({ when: new Date().toISOString(), via: "fetch", url, status: res.status, body: clip(body, 100000) });
        log("getPages via fetch", url);
      }
    } catch { /* diagnostics never break the app */ }
    return res;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (/getPages|compendium/i.test(String(url))) {
      this.addEventListener("load", () => {
        try {
          cap.getPages.push({ when: new Date().toISOString(), via: "xhr", method, url: String(url), status: this.status, body: clip(String(this.responseText), 100000) });
          log("getPages via xhr", url);
        } catch { /* ditto */ }
      });
    }
    return origOpen.call(this, method, url, ...rest);
  };

  /* --- native DnD: what arrives, and what Roll20 itself sets on dragstart --- */
  const dumpDT = (dt) => {
    const out = {};
    for (const t of [...(dt?.types || [])]) {
      try { out[t] = clip(dt.getData(t)); } catch (e) { out[t] = "<<unreadable: " + e + ">>"; }
    }
    return out;
  };
  window.addEventListener("drop", (e) => {
    const target = e.target?.closest?.("[class]")?.className || e.target?.tagName || "?";
    cap.drops.push({ when: new Date().toISOString(), target: String(target).slice(0, 120), types: dumpDT(e.dataTransfer) });
    log("drop on", target);
  }, true);
  window.addEventListener("dragstart", (e) => {
    // values are readable inside dragstart on the dragging page itself
    const src = e.target?.outerHTML ? clip(e.target.outerHTML, 2000) : String(e.target?.tagName);
    cap.dragstarts.push({ when: new Date().toISOString(), source: src, types: dumpDT(e.dataTransfer) });
    log("dragstart from", e.target);
  }, true);

  /* --- cross-frame traffic that smells like compendium/sheet-drop plumbing --- */
  window.addEventListener("message", (e) => {
    try {
      const s = typeof e.data === "string" ? e.data : JSON.stringify(e.data);
      if (s && /compendium|datarecord|drop/i.test(s) && cap.messages.length < 200) {
        cap.messages.push({ when: new Date().toISOString(), origin: e.origin, data: clip(s) });
        log("message", e.origin, s.slice(0, 120));
      }
    } catch { /* unserializable — skip */ }
  }, true);

  /* --- the download button --- */
  const mount = () => {
    const b = document.createElement("button");
    b.textContent = "Ledger capture: 0";
    Object.assign(b.style, {
      position: "fixed", bottom: "12px", right: "12px", zIndex: 999999,
      background: "#241f16", color: "#c9a227", border: "1px solid #5a4f3a",
      borderRadius: "8px", padding: "6px 12px", font: "13px Georgia, serif", cursor: "pointer",
    });
    b.title = "Download everything captured so far as JSON";
    setInterval(() => {
      b.textContent = `Ledger capture: ${cap.getPages.length + cap.drops.length + cap.dragstarts.length + cap.messages.length}`;
    }, 1000);
    b.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(cap, null, 2)], { type: "application/json" }));
      a.download = "r20-capture.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    document.body.appendChild(b);
  };
  if (document.body) mount(); else window.addEventListener("DOMContentLoaded", mount);
  log("armed — drag compendium entries around, then download via the gold button");
})();
