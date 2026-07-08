#!/usr/bin/env node
/* Regenerate public/compendium.json from a source XML using the app's OWN parser
   (parseCompendiumXML needs a real DOM, so this drives a headless Chromium through the
   built app rather than reimplementing the intricate subclass inference in Node).

   Usage:
     npm run build                       # the bake drives the built app
     node scripts/bake-compendium.cjs     # needs playwright-core + a Chromium
   Environment:
     CHROMIUM=/path/to/chrome            # defaults to the Playwright cache locations
   To update the compendium: drop the new source XML at data/Complete.xml, run this,
   commit the refreshed public/compendium.json, and delete the XML again. */
const { createServer } = require("http");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join, extname } = require("path");

const ROOT = join(__dirname, "..");
const XML = join(ROOT, "data", "Complete.xml");
const OUT = join(ROOT, "public", "compendium.json");
const DIST = join(ROOT, "dist");

if (!existsSync(XML)) { console.error(`No source XML at ${XML}`); process.exit(1); }
if (!existsSync(join(DIST, "index.html"))) { console.error("No dist/ build — run `npm run build` first."); process.exit(1); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".xml": "application/xml", ".png": "image/png" };
const server = createServer((req, res) => {
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const body = readFileSync(join(DIST, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});

(async () => {
  const { chromium } = require("playwright-core");
  const executablePath = process.env.CHROMIUM
    || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", `${process.env.HOME}/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`].find(existsSync);
  if (!executablePath) { console.error("No Chromium found — set CHROMIUM=/path/to/chrome"); process.exit(1); }
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => typeof window.__parseCompendium === "function");
  const xml = readFileSync(XML, "utf8");
  const parsed = await page.evaluate((text) => window.__parseCompendium(text), xml);
  writeFileSync(OUT, JSON.stringify(parsed));
  console.log(`Baked ${OUT}: ${parsed.spells.length} spells, ${parsed.items.length} items, ${parsed.feats.length} feats, ${Object.values(parsed.subs).flat().length} subclasses, ${Object.keys(parsed.featureTexts).length} feature texts (${(JSON.stringify(parsed).length / 1048576).toFixed(1)} MB)`);
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
