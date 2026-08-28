/* Roll20 drag bridge — makes compendium entries draggable into a Roll20 tab.

   BEST-GUESS FIRST PASS. Roll20 accepts native HTML5 drags from its own
   compendium site (compendium tab popped out, or roll20.net/compendium pages),
   so we mimic what a dragged compendium entry/link carries:
     - text/plain          "Category:Name" page key (the format its getPages
                           resolver uses, e.g. "Spells:Thunderwave")
     - text/uri-list +     the entry's compendium URL, the way a dragged <a>
       text/html           would populate them (its drop handler may parse the
                           URL rather than the bare key — unverified)
     - application/json    structured payload, incl. our full record, for a
       + x-adventurers-    future userscript bridge that populates homebrew
       ledger-r20          content the official compendium doesn't have
   The real contract gets confirmed by dragging a genuine Roll20 compendium
   entry onto public/r20-probe.html and reshaping these to match.

   Only official-compendium categories (Spells/Items/Feats/Monsters) get the
   page key and URL; features/traits carry just the name and JSON payload. */

let INDEX = new Map();

const featureText = (t) => (typeof t === "string" ? t : t?.text || "");

/* Called by App whenever customs (base compendium + homebrew) change. */
export function registerR20Source(customs) {
  INDEX = new Map();
  const add = (arr, category) =>
    (arr || []).forEach((e) => {
      if (!e?.name) return;
      const k = e.name.toLowerCase();
      if (!INDEX.has(k)) INDEX.set(k, { category, entry: e });
    });
  add(customs?.spells, "Spells");
  add(customs?.items, "Items");
  add(customs?.feats, "Feats");
  add(customs?.bestiary, "Monsters");
  Object.entries(customs?.featureTexts || {}).forEach(([n, t]) => {
    const k = n.toLowerCase();
    if (!INDEX.has(k)) INDEX.set(k, { category: "Features", entry: { name: n, text: featureText(t) } });
  });
}

/* Names arrive dressed up by the UI: "Fighting Style: Archery",
   "Thunderwave (Ritual Only)", "Rage (2/rest)" — try undressed forms too. */
function lookup(name) {
  if (typeof name !== "string" || !name) return null;
  const tries = [name, name.replace(/^[^:]+:\s*/, ""), name.replace(/\s*\([^)]*\)$/, ""), name.replace(/\*+$/, "")];
  for (const t of tries) {
    const hit = INDEX.get(t.trim().toLowerCase());
    if (hit) return hit;
  }
  return null;
}

const OFFICIAL = new Set(["Spells", "Items", "Feats", "Monsters"]);
const pageUrl = (name) => `https://roll20.net/compendium/dnd5e/${encodeURIComponent(name)}#content`;

/* Spread these onto any element rendering a compendium entry by name.
   Returns {} for names we can't classify, leaving the element untouched. */
export function r20DragProps(name) {
  const hit = lookup(name);
  if (!hit) return {};
  return {
    draggable: true,
    onDragStart: (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      const { category, entry } = hit;
      const official = OFFICIAL.has(category);
      const key = `${category}:${entry.name}`;
      const url = pageUrl(entry.name);
      const payload = {
        source: "adventurers-ledger",
        category,
        name: entry.name,
        page: official ? key : null,
        url: official ? url : null,
        data: entry,
      };
      try {
        dt.setData("text/plain", official ? key : entry.name);
        if (official) {
          dt.setData("text/uri-list", url);
          dt.setData("text/html", `<a href="${url}">${entry.name}</a>`);
        }
        const json = JSON.stringify(payload);
        dt.setData("application/json", json);
        dt.setData("application/x-adventurers-ledger-r20", json);
        dt.effectAllowed = "copy";
      } catch { /* some browsers reject exotic types mid-loop — the ones already set stand */ }
      window.__r20LastDrag = payload;
      try { if (localStorage.getItem("r20DragDebug")) console.log("[r20-drag]", payload); } catch { /* private mode */ }
    },
  };
}
