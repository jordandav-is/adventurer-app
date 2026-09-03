import { DurableObject } from "cloudflare:workers";
import {
  createPasswordRecord,
  verifyPasswordRecord,
  isValidPasswordRecord,
  dummyPasswordWork,
  hashGatePassphrase,
  timingSafeEqualStr,
  generateRecoveryKey,
  normalizeRecoveryKey,
  isValidRecoveryKey,
  hashRecoveryKey,
} from "./password.js";

const ALLOWED_ORIGINS = new Set([
  "https://jordandav-is.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64_RE = /^[0-9a-f]{64}$/i;
const DATA_KEY = /^(c\/[\w-]{1,64}|m\/(custom|prefs))$/;
const ASSET_PATH = /^\/asset\/([0-9a-f]{64})$/;
const ASSET_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "model/gltf-binary"]);
const ASSET_MAX_BYTES = 48 * 1024 * 1024;
const FORGE_PATH = /^\/forge\/([0-9a-f]{64})$/;

// Portrait conjuring: Gemini writes the prompt, Gemini paints four candidates. Rounds are metered
// per account and globally so a runaway client cannot drain the image budget.
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/";
const CONJURE_TEXT_MODEL = "gemini-3.8-flash";
const CONJURE_IMAGE_MODEL = "gemini-3.1-flash-image";
// Round limits come from wrangler vars; 0 (or unset) means unmetered. CONJURE_UNMETERED lists
// emails that are never metered, comma-separated.
const roundLimit = (v) => Number(v) || Infinity;
const unmetered = (env, email) => (env.CONJURE_UNMETERED || "").split(",").map((e) => e.trim().toLowerCase()).includes(email);
const CONJURE_FRAME = `You are an art director writing a single, richly detailed image-generation prompt for Dungeons & Dragons 5e character art in the painterly Wizards of the Coast sourcebook style. You receive a character brief: the player's own description plus sheet facts (ancestry, classes, background, features, persona, notes). Write the prompt as labelled paragraphs, 300-450 words in total, in this order:

Character: who this is in one dense sentence or two — ancestry, apparent age, build, station in life, and what they should NOT be mistaken for (e.g. "not a nobleman, not an adventuring superhero").
Permanent visual anchors: skin, horns/ears/tail or other ancestry features, eye colour, hair, face shape, distinguishing marks, and the overall impression of the face. Be concrete and recognisable; say what is absent as well as what is present.
Gear and silhouette: clothing layers with named colours and materials, armour, the weapon in hand, pouches, tools, and how worn or repaired everything looks. Name the things that must not appear (no plate, no glowing weapon, etc.).
Class cues: how the class shows through lived-in details rather than costume clichés. If the brief holds a secret (a hidden class, patron, past), the image must keep it: say plainly which imagery is forbidden so nothing reveals it.
Mood and pose: acting direction — what they feel, what they have just heard, posture, hands, gaze.
Setting: a specific, grounded place that supports the identity: terrain, plants, weather, distance cues. Not fantastical scenery.
Light and format: "Painterly high-fantasy tabletop RPG character illustration reminiscent of premium modern Dungeons & Dragons sourcebook art: realistic anatomy and materials, expressive brushwork, restrained detail, textured traditional-media feel, sophisticated natural palette." Then the light (direction, time of day, atmosphere) and: full-body three-quarter character portrait, vertical composition, readable from head to boots, simple environmental background, no text, no watermark, no border.
Avoid: a comma-separated list of everything that would spoil it — photorealism, anime, videogame concept-art armour, exaggerated proportions, generic evil imagery, glowing magic, and anything the brief's secrets forbid.

Revision: if the brief carries previousPrompt and revision, the player has seen art from previousPrompt and wants changes. Rewrite previousPrompt applying the revision faithfully and keep everything else as it was, so the character stays the same person. An empty revision means "again, but different": vary pose, setting and light while keeping the anchors.

Rules: one character only. The player's description outranks sheet facts when they conflict; never change the stated ancestry or class. Invent tasteful, specific detail wherever the brief is thin — named colours, named plants, one small living touch such as a bird or a tucked sprig. Prefer weathered and accumulated over pristine. Respond with JSON: {"prompt": "<the full prompt with the labelled paragraphs separated by newlines>"}.`;

// Tripo: image -> mesh with PBR textures -> rig -> idle animation. Each step is a task; the job
// record in the Account DO remembers the chain so a poll can advance it. Keyed by image hash, so
// forging the same image twice costs nothing.
const TRIPO = "https://api.tripo3d.ai/v2/openapi";
const TRIPO_MODEL_VERSION = "v3.1-20260211";
async function tripo(env, path, init) {
  const res = await fetch(TRIPO + path, { ...init, headers: { authorization: `Bearer ${env.TRIPO_API_KEY}`, ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== 0) throw new Error(data?.message || data?.error || `Tripo ${res.status}`);
  return data.data;
}
const tripoTask = (env, body) => tripo(env, "/task", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((d) => d.task_id);
// The next task in the chain, given the finished steps. Rigging failures fall back to the raw model.
const FORGE_CHAIN = [
  (steps, tok) => ({ type: "image_to_model", file: { type: "jpg", file_token: tok }, model_version: TRIPO_MODEL_VERSION, texture: true, pbr: true, texture_quality: "detailed", geometry_quality: "detailed", face_limit: 60000 }),
  (steps) => ({ type: "animate_rig", original_model_task_id: steps[0].task, out_format: "glb" }),
  (steps) => ({ type: "animate_retarget", original_model_task_id: steps[1].task, animation: "preset:idle", out_format: "glb" }),
];

async function gemini(env, model, body) {
  const res = await fetch(`${GEMINI}${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GOOGLE_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`);
  return data?.candidates?.[0]?.content?.parts || [];
}

// Counts a round against a limit inside one SQLite kv table. Negative n refunds.
function takeQuota(sql, key, limit, n = 1) {
  const used = Number([...sql.exec("SELECT v FROM auth_state WHERE k = ?", key)][0]?.v || 0);
  if (n > 0 && used + n > limit) return false;
  sql.exec("INSERT INTO auth_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", key, String(used + n));
  return true;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SIXTY_SECONDS_MS = 60 * 1000;

function getCorsHeaders(origin) {
  const headers = {
    "vary": "Origin",
    "cache-control": "no-store",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "POST, GET, PUT, OPTIONS";
    headers["access-control-allow-headers"] = "content-type, authorization";
  }
  return headers;
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "content-type": "application/json",
    },
  });
}

function err(status, message, origin) {
  return json(status, { error: message }, origin);
}

async function sha256Hex(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytesCount = 32) {
  const buf = new Uint8Array(bytesCount);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getAuthWorkStub(env, key) {
  const digest = await sha256Hex(key);
  const bucket = parseInt(digest.slice(0, 4), 16) % 16;
  return env.ACCOUNT.get(env.ACCOUNT.idFromName(`auth-work:${bucket}`));
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Origin not allowed", { status: 403, headers: getCorsHeaders(origin) });
    }

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    const identityStub = env.IDENTITY.get(env.IDENTITY.idFromName("singleton"));

    if (path === "/ws") {
      if (req.method !== "GET") return err(405, "Method not allowed", origin);
      const accountId = url.searchParams.get("account") || "";
      const ticket = url.searchParams.get("ticket") || "";
      if (!UUID_RE.test(accountId) || !HEX_64_RE.test(ticket)) {
        return err(400, "Bad request", origin);
      }
      const account = await identityStub.getAccountById(accountId);
      if (!account) {
        return err(401, "Unauthorized", origin);
      }
      return env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId)).fetch(req);
    }

    const asset = path.match(ASSET_PATH);
    if (asset) {
      // Content-addressed originals in R2 under <account>/<sha256>: immutable, so cache forever.
      if (req.method !== "GET" && req.method !== "PUT") return err(405, "Method not allowed", origin);
      if (!env.ASSETS) return err(503, "Assets not configured", origin);
      const accountId = url.searchParams.get("account") || "";
      const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      if (!UUID_RE.test(accountId) || !HEX_64_RE.test(token)) return err(400, "Bad request", origin);
      const account = await identityStub.getAccountById(accountId);
      const live = account && (await env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId)).touchSession(token));
      if (!live) return err(401, "Unauthorized", origin);
      const key = `${accountId}/${asset[1]}`;
      if (req.method === "GET") {
        const obj = await env.ASSETS.get(key);
        if (!obj) return err(404, "Not found", origin);
        return new Response(obj.body, {
          headers: { ...getCorsHeaders(origin), "content-type": obj.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" },
        });
      }
      if (await env.ASSETS.head(key)) return json(200, { ok: true }, origin);
      const type = req.headers.get("content-type") || "";
      if (!ASSET_TYPES.has(type)) return err(415, "Unsupported media type", origin);
      if (parseInt(req.headers.get("content-length") || "0", 10) > ASSET_MAX_BYTES) return err(413, "Payload too large", origin);
      const bytes = await req.arrayBuffer();
      if (bytes.byteLength > ASSET_MAX_BYTES) return err(413, "Payload too large", origin);
      if ((await sha256Hex(bytes)) !== asset[1]) return err(400, "Digest mismatch", origin);
      await env.ASSETS.put(key, bytes, { httpMetadata: { contentType: type } });
      return json(200, { ok: true }, origin);
    }

    const forgeM = path.match(FORGE_PATH);
    if (forgeM) {
      if (req.method !== "GET" && req.method !== "POST") return err(405, "Method not allowed", origin);
      if (!env.ASSETS || !env.TRIPO_API_KEY) return err(503, "The forge is not configured", origin);
      const accountId = url.searchParams.get("account") || "";
      const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      if (!UUID_RE.test(accountId) || !HEX_64_RE.test(token)) return err(400, "Bad request", origin);
      const account = await identityStub.getAccountById(accountId);
      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId));
      if (!account || !(await accountStub.touchSession(token))) return err(401, "Unauthorized", origin);
      const imageId = forgeM[1], jobKey = "forge:" + imageId;
      let job = await accountStub.state(jobKey);
      const reply = () => json(200, job.done ? { done: job.done } : { stage: job.steps[job.steps.length - 1].type }, origin);
      try {
        if (!job) {
          if (req.method !== "POST") return err(404, "No such forging", origin);
          const img = await env.ASSETS.get(`${accountId}/${imageId}`);
          if (!img) return err(404, "Upload the portrait first", origin);
          const form = new FormData();
          form.append("file", new Blob([await img.arrayBuffer()], { type: img.httpMetadata?.contentType || "image/jpeg" }), "portrait.jpg");
          const up = await tripo(env, "/upload/sts", { method: "POST", body: form });
          job = { steps: [{ type: "image_to_model", task: await tripoTask(env, FORGE_CHAIN[0]([], up.image_token || up.file_token)) }] };
          await accountStub.state(jobKey, job);
          return reply();
        }
        if (job.done) return reply();
        const cur = job.steps[job.steps.length - 1];
        const t = await tripo(env, `/task/${cur.task}`);
        if (t.status === "queued" || t.status === "running") return reply();
        if (t.status === "success") cur.output = t.output?.pbr_model || t.output?.model || t.output?.base_model;
        const failed = t.status !== "success" || !cur.output;
        if (failed && job.steps.length === 1) { await accountStub.state(jobKey, null); return err(502, `The forge failed while sculpting (${t.status}).`, origin); }
        const next = !failed && FORGE_CHAIN[job.steps.length];
        if (next) {
          job.steps.push({ type: next([]).type, task: await tripoTask(env, next(job.steps)) });
          await accountStub.state(jobKey, job);
          return reply();
        }
        // Finished, or rigging gave up: deliver the best output we have into R2 as an asset.
        const best = [...job.steps].reverse().find((s) => s.output).output;
        const bytes = await (await fetch(best)).arrayBuffer();
        if (bytes.byteLength > ASSET_MAX_BYTES) throw new Error("the figure is too large to keep");
        const id = await sha256Hex(bytes);
        await env.ASSETS.put(`${accountId}/${id}`, bytes, { httpMetadata: { contentType: "model/gltf-binary" } });
        job.done = id;
        await accountStub.state(jobKey, job);
        return reply();
      } catch (e) {
        return err(502, `The forge faltered: ${e.message}`, origin);
      }
    }

    if (req.method !== "POST") {
      return err(405, "Method not allowed", origin);
    }

    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 65536) {
      return err(413, "Payload too large", origin);
    }
    const rawText = await req.text();
    if (rawText.length > 65536) {
      return err(413, "Payload too large", origin);
    }
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return err(400, "Bad request", origin);
    }
    if (!body || typeof body !== "object") {
      return err(400, "Bad request", origin);
    }

    if (path === "/register") {
      const { email, password, passphrase, registrationId } = body;
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        typeof passphrase !== "string" ||
        typeof registrationId !== "string" ||
        email.length > 254 ||
        password.length < 8 ||
        password.length > 256 ||
        passphrase.length < 1 ||
        passphrase.length > 256 ||
        !HEX_64_RE.test(registrationId)
      ) {
        return err(400, "Bad request", origin);
      }

      const normEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) {
        return err(400, "Bad request", origin);
      }

      const gateSalt = env.GATE_SALT || "edffce3ce9712cbd6f997900359f6dd9";
      const gateHash = env.GATE_HASH || "faf79b899def21c5e3f3cdce3ac6813f2ac2c01c8b4f9c6cce222cf84ad4aed1";
      const gateIter = Number(env.GATE_ITERATIONS || 600000);

      const authWorkStub = await getAuthWorkStub(env, normEmail);
      const gateRes = await authWorkStub.verifyGate({
        passphrase,
        gateSalt,
        gateHash,
        gateIter,
      });

      if (!gateRes.ok) {
        return err(403, "The gate does not yield.", origin);
      }
      const regDigest = await sha256Hex(registrationId);
      const prepRes = await identityStub.prepareRegistration({
        email: normEmail,
        regDigest,
      });

      if (!prepRes.ok) {
        return err(prepRes.status || 409, "Email already registered", origin);
      }

      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(prepRes.accountId));
      const initRes = await accountStub.initializePassword({
        password,
        regDigest,
      });

      if (!initRes.ok) {
        return err(initRes.status || 409, "Registration failed", origin);
      }

      const actRes = await identityStub.activateAccount({
        accountId: prepRes.accountId,
        regDigest,
        email: normEmail,
      });

      if (!actRes.ok) {
        return err(actRes.status || 409, "Registration failed", origin);
      }

      return json(200, {
        account: {
          id: prepRes.accountId,
          email: normEmail,
          hasPassword: true,
        },
        token: initRes.token,
        recoveryKey: initRes.recoveryKey,
      }, origin);
    }

    if (path === "/login") {
      const { email, password } = body;
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        email.length > 254 ||
        password.length < 8 ||
        password.length > 256
      ) {
        return err(400, "Bad request", origin);
      }
      const normEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) {
        return err(401, "Invalid email or password.", origin);
      }

      const account = await identityStub.getAccountByEmail(normEmail);
      if (!account) {
        const authWorkStub = await getAuthWorkStub(env, normEmail);
        await authWorkStub.runDummyPassword(password);
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Invalid email or password.", origin);
      }
      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(account.id));
      const res = await accountStub.loginPassword(password);
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Invalid email or password.", origin);
      }

      return json(200, {
        account: {
          id: account.id,
          email: account.email,
          hasPassword: true,
        },
        token: res.token,
      }, origin);
    }

    if (path === "/password") {
      const { accountId, token, currentPassword, newPassword } = body;
      if (
        typeof accountId !== "string" ||
        typeof token !== "string" ||
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !UUID_RE.test(accountId) ||
        !HEX_64_RE.test(token) ||
        currentPassword.length < 8 ||
        currentPassword.length > 256 ||
        newPassword.length < 8 ||
        newPassword.length > 256
      ) {
        return err(400, "Bad request", origin);
      }

      const account = await identityStub.getAccountById(accountId);
      if (!account) {
        const authWorkStub = await getAuthWorkStub(env, accountId);
        await authWorkStub.runDummyPassword(currentPassword);
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Unauthorized", origin);
      }
      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId));
      const setRes = await accountStub.changePassword({
        token,
        currentPassword,
        newPassword,
      });
      if (!setRes.ok) {
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Unauthorized", origin);
      }
      return json(200, {
        account: {
          id: account.id,
          email: account.email,
          hasPassword: true,
        },
        token: setRes.token,
        recoveryKey: setRes.recoveryKey,
      }, origin);
    }

    if (path === "/recover") {
      const { email, recoveryKey, newPassword } = body;
      if (
        typeof email !== "string" ||
        typeof recoveryKey !== "string" ||
        typeof newPassword !== "string" ||
        email.length > 254 ||
        newPassword.length < 8 ||
        newPassword.length > 256 ||
        !isValidRecoveryKey(recoveryKey)
      ) {
        return err(400, "Bad request", origin);
      }

      const normEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) {
        return err(401, "Invalid recovery key or email.", origin);
      }

      const account = await identityStub.getAccountByEmail(normEmail);
      if (!account) {
        const authWorkStub = await getAuthWorkStub(env, normEmail);
        await authWorkStub.runDummyPassword(newPassword);
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Invalid recovery key or email.", origin);
      }

      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(account.id));
      const res = await accountStub.recoverPassword({ recoveryKey, newPassword });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Invalid recovery key or email.", origin);
      }

      return json(200, {
        account: {
          id: account.id,
          email: account.email,
          hasPassword: true,
        },
        token: res.token,
        recoveryKey: res.recoveryKey,
      }, origin);
    }

    if (path === "/recovery-key") {
      const { accountId, token, currentPassword } = body;
      if (
        typeof accountId !== "string" ||
        typeof token !== "string" ||
        typeof currentPassword !== "string" ||
        !UUID_RE.test(accountId) ||
        !HEX_64_RE.test(token) ||
        currentPassword.length < 8 ||
        currentPassword.length > 256
      ) {
        return err(400, "Bad request", origin);
      }

      const account = await identityStub.getAccountById(accountId);
      if (!account) {
        const authWorkStub = await getAuthWorkStub(env, accountId);
        await authWorkStub.runDummyPassword(currentPassword);
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Unauthorized", origin);
      }

      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId));
      const res = await accountStub.rotateRecoveryKey({ token, currentPassword });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 200));
        return err(401, "Unauthorized", origin);
      }

      return json(200, {
        recoveryKey: res.recoveryKey,
      }, origin);
    }

    if (path === "/logout") {
      const { accountId, token } = body;
      if (
        typeof accountId !== "string" ||
        typeof token !== "string" ||
        !UUID_RE.test(accountId) ||
        !HEX_64_RE.test(token)
      ) {
        return err(400, "Bad request", origin);
      }
      const account = await identityStub.getAccountById(accountId);
      if (!account) {
        return err(401, "Unauthorized", origin);
      }
      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId));
      await accountStub.revokeSession(token);
      return json(200, { ok: true }, origin);
    }

    if (path === "/conjure") {
      const { accountId, token, brief } = body;
      if (typeof accountId !== "string" || typeof token !== "string" || !UUID_RE.test(accountId) || !HEX_64_RE.test(token) || !brief || typeof brief !== "object" || typeof brief.description !== "string" || brief.description.length > 800 || (brief.revision != null && (typeof brief.revision !== "string" || brief.revision.length > 800 || typeof brief.previousPrompt !== "string" || brief.previousPrompt.length > 6000))) {
        return err(400, "Bad request", origin);
      }
      if (!env.GOOGLE_API_KEY) return err(503, "Conjuring is not configured", origin);
      const account = await identityStub.getAccountById(accountId);
      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId));
      if (!account || !(await accountStub.touchSession(token))) return err(401, "Unauthorized", origin);
      const perAccount = unmetered(env, account.email) ? Infinity : roundLimit(env.CONJURE_ROUNDS_PER_ACCOUNT);
      const global = unmetered(env, account.email) ? Infinity : roundLimit(env.CONJURE_ROUNDS_GLOBAL);
      if (!(await accountStub.takeQuota("conjure", perAccount))) return err(429, `This account has used all ${perAccount} conjuring rounds.`, origin);
      if (!(await identityStub.takeQuota("conjure", global))) {
        await accountStub.takeQuota("conjure", perAccount, -1);
        return err(429, "The conjuring well has run dry for now.", origin);
      }
      try {
        const [textPart] = await gemini(env, CONJURE_TEXT_MODEL, {
          systemInstruction: { parts: [{ text: CONJURE_FRAME }] },
          contents: [{ parts: [{ text: JSON.stringify(brief) }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { prompt: { type: "STRING" } }, required: ["prompt"] } },
        });
        const prompt = JSON.parse(textPart?.text || "{}").prompt;
        if (typeof prompt !== "string" || !prompt) throw new Error("no prompt");
        const images = (await Promise.all(Array.from({ length: 4 }, () => gemini(env, CONJURE_IMAGE_MODEL, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
        })))).map((parts) => parts.find((p) => p.inlineData)?.inlineData).filter(Boolean).map((d) => ({ mime: d.mimeType, data: d.data }));
        if (!images.length) throw new Error("no images");
        return json(200, { prompt, images }, origin);
      } catch (e) {
        await Promise.all([accountStub.takeQuota("conjure", perAccount, -1), identityStub.takeQuota("conjure", global, -1)]);
        return err(502, `The muse did not answer: ${e.message}`, origin);
      }
    }

    if (path === "/ws-ticket") {
      const { accountId, token } = body;
      if (
        typeof accountId !== "string" ||
        typeof token !== "string" ||
        !UUID_RE.test(accountId) ||
        !HEX_64_RE.test(token)
      ) {
        return err(400, "Bad request", origin);
      }
      const account = await identityStub.getAccountById(accountId);
      if (!account) {
        return err(401, "Unauthorized", origin);
      }
      const accountStub = env.ACCOUNT.get(env.ACCOUNT.idFromName(accountId));
      const ticket = await accountStub.createWsTicket(token);
      if (!ticket) {
        return err(401, "Unauthorized", origin);
      }
      return json(200, { ticket }, origin);
    }

    return err(404, "Not found", origin);
  },
};

export class Identity extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        reg_digest TEXT,
        retry_expires_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS pending_accounts (
        email TEXT PRIMARY KEY,
        id TEXT UNIQUE NOT NULL,
        digest TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_state (k TEXT PRIMARY KEY, v TEXT);
    `);
  }
  takeQuota(key, limit, n) {
    return takeQuota(this.ctx.storage.sql, "meter:" + key, limit, n);
    const cols = new Set([...this.ctx.storage.sql.exec("PRAGMA table_info(accounts)")].map((r) => r.name));
    if (!cols.has("reg_digest")) {
      this.ctx.storage.sql.exec("ALTER TABLE accounts ADD COLUMN reg_digest TEXT");
    }
    if (!cols.has("retry_expires_at")) {
      this.ctx.storage.sql.exec("ALTER TABLE accounts ADD COLUMN retry_expires_at INTEGER");
    }
  }

  purgePending() {
    this.ctx.storage.sql.exec("DELETE FROM pending_accounts WHERE expires_at < ?", Date.now());
  }

  prepareRegistration({ email, regDigest }) {
    const now = Date.now();
    const expiresAt = now + FIVE_MINUTES_MS;
    return this.ctx.storage.transactionSync(() => {
      this.purgePending();
      const active = [...this.ctx.storage.sql.exec(
        "SELECT id, reg_digest, retry_expires_at FROM accounts WHERE email = ?",
        email
      )][0];
      if (active) {
        if (active.reg_digest === regDigest && active.retry_expires_at >= now) {
          return { ok: true, accountId: active.id };
        }
        return { ok: false, error: "email_exists", status: 409 };
      }
      const pending = [...this.ctx.storage.sql.exec(
        "SELECT id, digest, expires_at FROM pending_accounts WHERE email = ?",
        email
      )][0];
      if (pending) {
        if (pending.digest === regDigest && pending.expires_at >= now) {
          return { ok: true, accountId: pending.id };
        }
        return { ok: false, error: "conflict", status: 409 };
      }
      const accountId = crypto.randomUUID();
      this.ctx.storage.sql.exec(
        "INSERT INTO pending_accounts (email, id, digest, expires_at) VALUES (?, ?, ?, ?)",
        email,
        accountId,
        regDigest,
        expiresAt
      );
      return { ok: true, accountId };
    });
  }

  activateAccount({ accountId, regDigest, email }) {
    const now = Date.now();
    const retryExpiresAt = now + FIVE_MINUTES_MS;
    return this.ctx.storage.transactionSync(() => {
      this.purgePending();
      const pending = [...this.ctx.storage.sql.exec(
        "SELECT email, digest FROM pending_accounts WHERE id = ? AND digest = ?",
        accountId,
        regDigest
      )][0];
      if (pending) {
        const emailCollision = [...this.ctx.storage.sql.exec(
          "SELECT id FROM accounts WHERE email = ?",
          pending.email
        )][0];
        if (emailCollision && emailCollision.id !== accountId) {
          return { ok: false, error: "email_collision", status: 409 };
        }
        this.ctx.storage.sql.exec(
          "INSERT INTO accounts (id, email, created_at, reg_digest, retry_expires_at) VALUES (?, ?, ?, ?, ?)",
          accountId,
          pending.email,
          now,
          regDigest,
          retryExpiresAt
        );
        this.ctx.storage.sql.exec(
          "DELETE FROM pending_accounts WHERE id = ?",
          accountId
        );
        return { ok: true };
      }
      const active = [...this.ctx.storage.sql.exec(
        "SELECT id, email, reg_digest, retry_expires_at FROM accounts WHERE id = ?",
        accountId
      )][0];
      if (active && active.email === email && active.reg_digest === regDigest && active.retry_expires_at >= now) {
        return { ok: true };
      }
      return { ok: false, error: "invalid_pending", status: 409 };
    });
  }

  getAccountByEmail(email) {
    const row = [...this.ctx.storage.sql.exec(
      "SELECT id, email FROM accounts WHERE email = ?",
      email
    )][0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      hasPassword: true,
    };
  }

  getAccountById(id) {
    const row = [...this.ctx.storage.sql.exec(
      "SELECT id, email FROM accounts WHERE id = ?",
      id
    )][0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      hasPassword: true,
    };
  }
}

export class Account extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, ts INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_active INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ws_tickets (digest TEXT PRIMARY KEY, session_digest TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_state (k TEXT PRIMARY KEY, v TEXT);
    `);
  }
  takeQuota(key, limit, n) {
    return takeQuota(this.ctx.storage.sql, "meter:" + key, limit, n);
  }
  // Small JSON state slot: read with one argument, write with two (null deletes).
  state(key, value) {
    if (value === undefined) { const row = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = ?", key)][0]; return row ? JSON.parse(row.v) : null; }
    if (value === null) this.ctx.storage.sql.exec("DELETE FROM auth_state WHERE k = ?", key);
    else this.ctx.storage.sql.exec("INSERT INTO auth_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", key, JSON.stringify(value));
    return value;
  }
  async verifyGate({ passphrase, gateSalt, gateHash, gateIter }) {
    const computed = await hashGatePassphrase(passphrase, gateSalt, gateIter);
    return { ok: timingSafeEqualStr(computed, gateHash) };
  }

  async runDummyPassword(password) {
    await dummyPasswordWork(password);
    return { ok: true };
  }


  purgeSessions() {
    const activeDigests = new Set(
      [...this.ctx.storage.sql.exec(
        "SELECT digest FROM sessions WHERE created_at >= ? AND last_active >= ?",
        Date.now() - SEVEN_DAYS_MS,
        Date.now() - TWENTY_FOUR_HOURS_MS
      )].map((r) => r.digest)
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM sessions WHERE created_at < ? OR last_active < ?",
      Date.now() - SEVEN_DAYS_MS,
      Date.now() - TWENTY_FOUR_HOURS_MS
    );
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment();
        if (!att || !att.sessionDigest || !activeDigests.has(att.sessionDigest)) {
          ws.close(4001, "expired");
        }
      } catch {}
    }
  }

  purgeWsTickets() {
    this.ctx.storage.sql.exec("DELETE FROM ws_tickets WHERE expires_at < ?", Date.now());
  }

  insertSessionSync(digest) {
    this.purgeSessions();
    const all = [...this.ctx.storage.sql.exec("SELECT digest FROM sessions ORDER BY last_active DESC")];
    if (all.length >= 10) {
      const evicted = all.slice(9);
      for (const s of evicted) {
        this.ctx.storage.sql.exec("DELETE FROM sessions WHERE digest = ?", s.digest);
        for (const ws of this.ctx.getWebSockets()) {
          try {
            const att = ws.deserializeAttachment();
            if (att && att.sessionDigest === s.digest) {
              ws.close(4001, "expired");
            }
          } catch {}
        }
      }
    }
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "INSERT INTO sessions (digest, created_at, last_active) VALUES (?, ?, ?)",
      digest,
      now,
      now
    );
  }

  async createSession() {
    const token = randomHex(32);
    const digest = await sha256Hex(token);
    this.ctx.storage.transactionSync(() => {
      this.insertSessionSync(digest);
    });
    return token;
  }

  async revokeSession(token) {
    if (typeof token !== "string" || !token) return;
    const digest = await sha256Hex(token);
    this.ctx.storage.sql.exec("DELETE FROM sessions WHERE digest = ?", digest);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment();
        if (att && att.sessionDigest === digest) {
          ws.close(4001, "revoked");
        }
      } catch {}
    }
  }

  // Validates a session token and marks it active. Returns the session digest, or null.
  async touchSession(token) {
    if (typeof token !== "string" || !token) return null;
    const sessionDigest = await sha256Hex(token);
    this.purgeSessions();
    const session = [...this.ctx.storage.sql.exec(
      "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
      sessionDigest,
      Date.now() - SEVEN_DAYS_MS,
      Date.now() - TWENTY_FOUR_HOURS_MS
    )][0];
    if (!session) return null;

    this.ctx.storage.sql.exec(
      "UPDATE sessions SET last_active = ? WHERE digest = ?",
      Date.now(),
      sessionDigest
    );
    return sessionDigest;
  }

  async createWsTicket(token) {
    const sessionDigest = await this.touchSession(token);
    if (!sessionDigest) return null;

    this.purgeWsTickets();
    const ticket = randomHex(32);
    const ticketDigest = await sha256Hex(ticket);
    this.ctx.storage.sql.exec(
      "INSERT INTO ws_tickets (digest, session_digest, expires_at) VALUES (?, ?, ?)",
      ticketDigest,
      sessionDigest,
      Date.now() + SIXTY_SECONDS_MS
    );
    return ticket;
  }

  async initializePassword({ password, regDigest }) {
    const regDigestRow = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'registration_digest'")][0]?.v || null;
    const rawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
    const sessionToken = randomHex(32);
    const sessionDigest = await sha256Hex(sessionToken);

    if (regDigestRow) {
      if (regDigestRow !== regDigest) {
        return { ok: false, status: 409 };
      }
      if (!rawAuth) {
        return { ok: false, status: 409 };
      }
      let parsedAuth;
      try {
        parsedAuth = JSON.parse(rawAuth);
      } catch {
        return { ok: false, status: 409 };
      }
      if (!isValidPasswordRecord(parsedAuth)) {
        return { ok: false, status: 409 };
      }
      const isMatch = await verifyPasswordRecord(password, parsedAuth);
      if (!isMatch) {
        return { ok: false, status: 409 };
      }
      const newRecoveryKey = generateRecoveryKey();
      const newRecoveryDigest = hashRecoveryKey(newRecoveryKey);

      return this.ctx.storage.transactionSync(() => {
        const curReg = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'registration_digest'")][0]?.v || null;
        const curAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
        if (curReg !== regDigestRow || curAuth !== rawAuth) {
          return { ok: false, status: 409 };
        }
        this.ctx.storage.sql.exec(
          "INSERT INTO auth_state (k, v) VALUES ('recovery_digest', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
          newRecoveryDigest
        );
        this.insertSessionSync(sessionDigest);
        return { ok: true, token: sessionToken, recoveryKey: newRecoveryKey };
      });
    }

    if (rawAuth) {
      return { ok: false, status: 409 };
    }

    const record = await createPasswordRecord(password);
    const authPayload = JSON.stringify(record);
    const recoveryKey = generateRecoveryKey();
    const recoveryDigest = hashRecoveryKey(recoveryKey);

    return this.ctx.storage.transactionSync(() => {
      const curReg = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'registration_digest'")][0]?.v || null;
      const curAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
      if (curReg || curAuth) {
        return { ok: false, status: 409 };
      }
      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('registration_digest', ?)",
        regDigest
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('password', ?)",
        authPayload
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('recovery_digest', ?)",
        recoveryDigest
      );
      this.insertSessionSync(sessionDigest);
      return { ok: true, token: sessionToken, recoveryKey };
    });
  }

  async loginPassword(password) {
    const rawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
    let isValid = false;

    if (rawAuth) {
      let parsedAuth;
      try {
        parsedAuth = JSON.parse(rawAuth);
      } catch {}
      if (isValidPasswordRecord(parsedAuth)) {
        isValid = await verifyPasswordRecord(password, parsedAuth);
      } else {
        await dummyPasswordWork(password);
      }
    } else {
      await dummyPasswordWork(password);
    }

    const sessionToken = randomHex(32);
    const sessionDigest = await sha256Hex(sessionToken);

    if (!isValid) {
      return { ok: false };
    }

    return this.ctx.storage.transactionSync(() => {
      const currentRawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
      if (currentRawAuth !== rawAuth) {
        return { ok: false };
      }
      this.insertSessionSync(sessionDigest);
      return { ok: true, token: sessionToken };
    });
  }

  async changePassword({ token, currentPassword, newPassword }) {
    const tokenDigest = await sha256Hex(token);
    this.purgeSessions();
    const now = Date.now();
    const session = [...this.ctx.storage.sql.exec(
      "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
      tokenDigest,
      now - SEVEN_DAYS_MS,
      now - TWENTY_FOUR_HOURS_MS
    )][0];

    if (!session) {
      await dummyPasswordWork(currentPassword);
      return { ok: false };
    }

    const rawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
    if (!rawAuth) {
      await dummyPasswordWork(currentPassword);
      return { ok: false };
    }

    let parsedAuth;
    try {
      parsedAuth = JSON.parse(rawAuth);
    } catch {}

    if (!isValidPasswordRecord(parsedAuth)) {
      await dummyPasswordWork(currentPassword);
      return { ok: false };
    }

    const isCurrentValid = await verifyPasswordRecord(currentPassword, parsedAuth);
    if (!isCurrentValid) {
      return { ok: false };
    }

    const newRecord = await createPasswordRecord(newPassword);
    const newAuthPayload = JSON.stringify(newRecord);
    const newRecoveryKey = generateRecoveryKey();
    const newRecoveryDigest = hashRecoveryKey(newRecoveryKey);
    const replacementToken = randomHex(32);
    const replacementDigest = await sha256Hex(replacementToken);

    return this.ctx.storage.transactionSync(() => {
      this.purgeSessions();
      const commitNow = Date.now();
      const currentSession = [...this.ctx.storage.sql.exec(
        "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
        tokenDigest,
        commitNow - SEVEN_DAYS_MS,
        commitNow - TWENTY_FOUR_HOURS_MS
      )][0];

      if (!currentSession) {
        return { ok: false };
      }

      const currentRawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
      if (currentRawAuth !== rawAuth) {
        return { ok: false };
      }

      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('password', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        newAuthPayload
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('recovery_digest', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        newRecoveryDigest
      );

      this.ctx.storage.sql.exec("DELETE FROM sessions");
      this.ctx.storage.sql.exec("DELETE FROM ws_tickets");
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.close(4001, "revoked"); } catch {}
      }

      this.ctx.storage.sql.exec(
        "INSERT INTO sessions (digest, created_at, last_active) VALUES (?, ?, ?)",
        replacementDigest,
        commitNow,
        commitNow
      );

      return { ok: true, token: replacementToken, recoveryKey: newRecoveryKey };
    });
  }

  async recoverPassword({ recoveryKey, newPassword }) {
    const rawDigest = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'recovery_digest'")][0]?.v || null;
    const normKey = normalizeRecoveryKey(recoveryKey);

    if (!rawDigest || !normKey) {
      await dummyPasswordWork(newPassword);
      return { ok: false };
    }

    const computedDigest = hashRecoveryKey(normKey);
    if (!timingSafeEqualStr(computedDigest, rawDigest)) {
      await dummyPasswordWork(newPassword);
      return { ok: false };
    }

    const newRecord = await createPasswordRecord(newPassword);
    const newAuthPayload = JSON.stringify(newRecord);
    const newRecoveryKey = generateRecoveryKey();
    const newRecoveryDigest = hashRecoveryKey(newRecoveryKey);
    const sessionToken = randomHex(32);
    const sessionDigest = await sha256Hex(sessionToken);

    return this.ctx.storage.transactionSync(() => {
      const curDigest = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'recovery_digest'")][0]?.v || null;
      if (curDigest !== rawDigest) {
        return { ok: false };
      }

      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('password', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        newAuthPayload
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('recovery_digest', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        newRecoveryDigest
      );

      this.ctx.storage.sql.exec("DELETE FROM sessions");
      this.ctx.storage.sql.exec("DELETE FROM ws_tickets");
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.close(4001, "revoked"); } catch {}
      }

      this.insertSessionSync(sessionDigest);
      return { ok: true, token: sessionToken, recoveryKey: newRecoveryKey };
    });
  }

  async rotateRecoveryKey({ token, currentPassword }) {
    const tokenDigest = await sha256Hex(token);
    this.purgeSessions();
    const now = Date.now();
    const session = [...this.ctx.storage.sql.exec(
      "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
      tokenDigest,
      now - SEVEN_DAYS_MS,
      now - TWENTY_FOUR_HOURS_MS
    )][0];

    if (!session) {
      await dummyPasswordWork(currentPassword);
      return { ok: false };
    }

    const rawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
    if (!rawAuth) {
      await dummyPasswordWork(currentPassword);
      return { ok: false };
    }

    let parsedAuth;
    try {
      parsedAuth = JSON.parse(rawAuth);
    } catch {}

    if (!isValidPasswordRecord(parsedAuth)) {
      await dummyPasswordWork(currentPassword);
      return { ok: false };
    }

    const isCurrentValid = await verifyPasswordRecord(currentPassword, parsedAuth);
    if (!isCurrentValid) {
      return { ok: false };
    }

    const newRecoveryKey = generateRecoveryKey();
    const newRecoveryDigest = hashRecoveryKey(newRecoveryKey);

    return this.ctx.storage.transactionSync(() => {
      this.purgeSessions();
      const commitNow = Date.now();
      const currentSession = [...this.ctx.storage.sql.exec(
        "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
        tokenDigest,
        commitNow - SEVEN_DAYS_MS,
        commitNow - TWENTY_FOUR_HOURS_MS
      )][0];

      if (!currentSession) {
        return { ok: false };
      }

      const currentRawAuth = [...this.ctx.storage.sql.exec("SELECT v FROM auth_state WHERE k = 'password'")][0]?.v || null;
      if (currentRawAuth !== rawAuth) {
        return { ok: false };
      }

      this.ctx.storage.sql.exec(
        "INSERT INTO auth_state (k, v) VALUES ('recovery_digest', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        newRecoveryDigest
      );

      return { ok: true, recoveryKey: newRecoveryKey };
    });
  }

  mutate(k, v, ts) {
    const cur = [...this.ctx.storage.sql.exec("SELECT v, ts FROM kv WHERE k = ?", k)][0];
    if (cur && ts <= cur.ts) {
      return { ok: false, k, v: cur.v, ts: cur.ts };
    }
    this.ctx.storage.sql.exec(
      "INSERT INTO kv (k, v, ts) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ts = excluded.ts",
      k,
      v,
      ts
    );
    return { ok: true, k, v, ts };
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      return this.connect(url.searchParams.get("ticket"));
    }
    return new Response("Not found", { status: 404 });
  }

  async connect(ticket) {
    const pair = new WebSocketPair();
    const clientWs = pair[0];
    const serverWs = pair[1];

    if (typeof ticket !== "string" || !HEX_64_RE.test(ticket)) {
      serverWs.accept();
      serverWs.close(4001, "unauthorized");
      return new Response(null, { status: 101, webSocket: clientWs });
    }

    this.purgeWsTickets();
    const ticketDigest = await sha256Hex(ticket);
    const ticketRow = [...this.ctx.storage.sql.exec(
      "SELECT session_digest FROM ws_tickets WHERE digest = ? AND expires_at >= ?",
      ticketDigest,
      Date.now()
    )][0];

    if (!ticketRow) {
      serverWs.accept();
      serverWs.close(4001, "unauthorized");
      return new Response(null, { status: 101, webSocket: clientWs });
    }

    this.ctx.storage.sql.exec("DELETE FROM ws_tickets WHERE digest = ?", ticketDigest);

    this.purgeSessions();
    const session = [...this.ctx.storage.sql.exec(
      "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
      ticketRow.session_digest,
      Date.now() - SEVEN_DAYS_MS,
      Date.now() - TWENTY_FOUR_HOURS_MS
    )][0];

    if (!session) {
      serverWs.accept();
      serverWs.close(4001, "unauthorized");
      return new Response(null, { status: 101, webSocket: clientWs });
    }

    this.ctx.acceptWebSocket(serverWs);
    serverWs.serializeAttachment({ sessionDigest: ticketRow.session_digest });

    for (const row of this.ctx.storage.sql.exec("SELECT k, v, ts FROM kv WHERE k LIKE 'c/%' OR k LIKE 'm/%'")) {
      serverWs.send(JSON.stringify({ t: "ch", k: row.k, v: row.v, ts: row.ts }));
    }
    serverWs.send('{"t":"synced"}');

    return new Response(null, { status: 101, webSocket: clientWs });
  }

  webSocketMessage(ws, msg) {
    const att = ws.deserializeAttachment();
    if (!att || !att.sessionDigest) {
      try { ws.close(4001, "unauthorized"); } catch {}
      return;
    }

    const session = [...this.ctx.storage.sql.exec(
      "SELECT digest FROM sessions WHERE digest = ? AND created_at >= ? AND last_active >= ?",
      att.sessionDigest,
      Date.now() - SEVEN_DAYS_MS,
      Date.now() - TWENTY_FOUR_HOURS_MS
    )][0];

    if (!session) {
      try { ws.close(4001, "unauthorized"); } catch {}
      return;
    }

    this.ctx.storage.sql.exec(
      "UPDATE sessions SET last_active = ? WHERE digest = ?",
      Date.now(),
      att.sessionDigest
    );

    if (msg === "ping") {
      try { ws.send("pong"); } catch {}
      return;
    }

    if (typeof msg !== "string" || msg.length > 2000000) return;
    let m; try { m = JSON.parse(msg); } catch { return; }
    if ((m.t !== "put" && m.t !== "del") || !DATA_KEY.test(m.k || "")) return;
    if (!Number.isSafeInteger(m.ts) || m.ts <= 0) {
      return void ws.send(JSON.stringify({ t: "err", n: m.n, m: "bad timestamp" }));
    }
    if (m.t === "put" && (typeof m.v !== "string" || m.v.length > 1500000)) {
      return void ws.send(JSON.stringify({ t: "err", n: m.n, m: "too large" }));
    }

    // Clamp future client clocks so they cannot dominate LWW ordering.
    const ts = Math.min(m.ts, Date.now());

    let res;
    try {
      res = this.mutate(m.k, m.t === "put" ? m.v : null, ts);
    } catch {
      return void ws.send(JSON.stringify({ t: "err", n: m.n, m: "storage full" }));
    }

    ws.send(JSON.stringify({ t: "ack", n: m.n, ok: res.ok, k: res.k, v: res.v, ts: res.ts }));
    if (res.ok) {
      const out = JSON.stringify({ t: "ch", k: res.k, v: res.v, ts: res.ts });
      const activeDigests = new Set(
        [...this.ctx.storage.sql.exec(
          "SELECT digest FROM sessions WHERE created_at >= ? AND last_active >= ?",
          Date.now() - SEVEN_DAYS_MS,
          Date.now() - TWENTY_FOUR_HOURS_MS
        )].map((r) => r.digest)
      );
      for (const sock of this.ctx.getWebSockets()) {
        if (sock !== ws && sock.readyState === WebSocket.OPEN) {
          try {
            const sockAtt = sock.deserializeAttachment();
            if (sockAtt && sockAtt.sessionDigest && activeDigests.has(sockAtt.sessionDigest)) {
              sock.send(out);
            }
          } catch {}
        }
      }
    }
  }

  webSocketError(ws) {
    try { ws.close(1011, "error"); } catch {}
  }

  webSocketClose() {}
}
