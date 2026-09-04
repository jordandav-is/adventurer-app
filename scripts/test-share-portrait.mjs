import assert from "node:assert/strict";
import { b64uFromBytes, bytesFromB64u } from "../src/rules.js";
import { RACES, CLASSES, ABILITIES } from "../src/data.js";
import { EMPTY_CUSTOM } from "../src/compendium.js";

const pipeBytes = async (bytes, transform) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());

function shareCustomsFor(_ch, customs) {
  return { ...EMPTY_CUSTOM, ...(customs || {}) };
}

async function encodeShare(ch, customs) {
  const { photo, log, hpLog, ...soul } = ch;
  if (soul.portrait) {
    soul.portrait = {
      id: String(soul.portrait.id || ""),
      w: Number(soul.portrait.w) || 0,
      h: Number(soul.portrait.h) || 0,
      x: typeof soul.portrait.x === "number" ? soul.portrait.x : 0.5,
      y: typeof soul.portrait.y === "number" ? soul.portrait.y : 0.5,
      z: typeof soul.portrait.z === "number" ? soul.portrait.z : 1,
    };
  }
  const payload = { v: 1, t: new Date().toISOString().slice(0, 10), c: soul, x: shareCustomsFor(ch, customs) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const canDeflate = typeof CompressionStream !== "undefined";
  const body = canDeflate ? await pipeBytes(bytes, new CompressionStream("deflate-raw")) : bytes;
  return `https://example.com/app/#share=${canDeflate ? "1" : "0"}${b64uFromBytes(body)}`;
}

async function decodeShare(token) {
  const body = bytesFromB64u(token.slice(1));
  const json = token[0] === "1"
    ? new TextDecoder().decode(await pipeBytes(body, new DecompressionStream("deflate-raw")))
    : token[0] === "0" ? new TextDecoder().decode(body)
    : null;
  const payload = JSON.parse(json);
  const c = payload?.v === 1 ? payload.c : null;
  if (!c?.name || !RACES[c.race] || !Array.isArray(c.classes) || !c.classes.length || c.classes.some((x) => !CLASSES[x?.name]) || ABILITIES.some((a) => typeof c.abilities?.[a] !== "number")) {
    throw new Error("not a shared character");
  }
  const portrait = c.portrait && typeof c.portrait.id === "string" && c.portrait.id.length === 64 ? {
    id: c.portrait.id,
    w: Number(c.portrait.w) || 0,
    h: Number(c.portrait.h) || 0,
    x: typeof c.portrait.x === "number" ? c.portrait.x : 0.5,
    y: typeof c.portrait.y === "number" ? c.portrait.y : 0.5,
    z: typeof c.portrait.z === "number" ? c.portrait.z : 1,
  } : null;
  payload.c = { ...c, photo: null, portrait, log: [], skills: Array.isArray(c.skills) ? c.skills : [], maxHp: typeof c.maxHp === "number" ? c.maxHp : 1 };
  payload.x = { ...EMPTY_CUSTOM, ...(payload.x || {}) };
  return payload;
}

async function run() {
  const sha = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const mockChar = {
    id: "yeyukx42",
    name: "Lorne Elderwood",
    race: "Half-Elf",
    background: "Hermit",
    alignment: "Chaotic Good",
    classes: [{ name: "Rogue", level: 1, subclass: null }],
    abilities: { str: 9, dex: 15, con: 14, int: 9, wis: 6, cha: 15 },
    skills: ["Stealth"],
    maxHp: 10,
    photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg==", // 220px thumb
    portrait: {
      id: sha,
      w: 1200,
      h: 1600,
      x: 0.45,
      y: 0.35,
      z: 1.5,
    },
    log: [{ event: "created" }],
    hpLog: [10],
  };

  const url = await encodeShare(mockChar, {});
  const token = url.match(/#share=([0-9A-Za-z_-]+)/)[1];
  const decoded = await decodeShare(token);

  // Assertions
  assert.equal(decoded.c.photo, null, "photo must be stripped to keep URL short");
  assert.deepEqual(decoded.c.log, [], "log must be empty");
  assert.ok(decoded.c.portrait, "portrait must be preserved");
  assert.equal(decoded.c.portrait.id, sha, "portrait.id must match");
  assert.equal(decoded.c.portrait.w, 1200);
  assert.equal(decoded.c.portrait.h, 1600);
  assert.equal(decoded.c.portrait.x, 0.45);
  assert.equal(decoded.c.portrait.y, 0.35);
  assert.equal(decoded.c.portrait.z, 1.5);

  // Test character without portrait
  const noPortraitChar = { ...mockChar, photo: null, portrait: null };
  const url2 = await encodeShare(noPortraitChar, {});
  const decoded2 = await decodeShare(url2.match(/#share=([0-9A-Za-z_-]+)/)[1]);
  assert.equal(decoded2.c.portrait, null, "null portrait must decode as null");
  assert.equal(decoded2.c.photo, null);

  // Test malformed portrait (not 64 hex chars)
  const badPortraitChar = { ...mockChar, portrait: { id: "not-a-sha" } };
  const url3 = await encodeShare(badPortraitChar, {});
  const decoded3 = await decodeShare(url3.match(/#share=([0-9A-Za-z_-]+)/)[1]);
  assert.equal(decoded3.c.portrait, null, "invalid portrait id must decode as null");

  // Test decoding the user's legacy token from production
  const legacyToken = "1jVPLbhsxDPyVBS-5KIBtuAGim-MGcYEWNZLcAh9oLa0lrBU3ktYPGP73QvIjPhW5UeTszPCxB9iAHipIoGE0GD3cDx7vB2NQYEAfgGvQsKd9v96NR6DAY0ug4bcET9WzqylsRWpQENDkwgzd6v7ZrUDBEs3aBul9pphRaDmBAnRsfUs-y00blMSmejlRWHE16IEC9hvyScIe9MfhKkmYGgrVJLQSQMFn2hff9Nlz11ENOoWejur6wU-0lq7I0X-Q7w3ThuJd9S7i4pX7BvHWSEhxK6H-jnJBL2X7HewkBNleNUeDm9JTH6zDcBerOZr1l62Fgpj2jiLoj4UCLymHAAo6ClE85sWlgJzOaa4J3Tleiq_P4crhtoRHBS0lbNGyOXF2aNKTiAfte-fKRsRgYvFn0YDeUpg2wiaLn1CxI5d1DkcFuGTHiXPxADEF0I8KatqBHv5QYDL1cJyJU6lsOYJ-UGAazIiTo0by6byKc9W4fsgn6TDG0vd1SK9iewIFjjbkyqhjvyy4k6s8LXOxmY3FNReTHzCnsJLQojeZYE4h9hhZPCj45SPbJt_rJDWOEpu8ojdHOVvJqpqhz6fwlghdakDBH6rZsM9Mr-TYZp6FghVhOo8sh9NbJ7TrKCSOlM3c6sxvjC0UOPS2R1v6hqm0bbH47DYcs_KUHMXE6EDBi5c2Z8uGDKP7EoRMF1P-qU7bMuhT4O7ydOwJLV2rfUzS_g1s2U8ig16hi3TJl0wZr4IWd7MO9HBwVLAr2-6X5w5vur_cRo45UXszlD7QO-0y8HA8Hv8B";
  const decodedLegacy = await decodeShare(legacyToken);
  assert.equal(decodedLegacy.c.name, "Lorne Elderwood");
  assert.equal(decodedLegacy.c.portrait, null, "legacy share token without portrait gracefully decodes with null portrait");

  console.log("All share encode/decode tests passed successfully!");
}

run();
