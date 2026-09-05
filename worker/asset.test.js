import { register } from "node:module";
register("./mock-loader.mjs", import.meta.url);

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const { default: worker } = await import("./worker.js");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function createMockEnv(initialAssets = {}) {
  const assetsMap = new Map(Object.entries(initialAssets));

  const ASSETS = {
    async get(key) {
      const val = assetsMap.get(key);
      if (!val) return null;
      return {
        body: val.bytes,
        httpMetadata: { contentType: val.contentType || "image/jpeg" },
        async arrayBuffer() {
          return val.bytes.buffer.slice(val.bytes.byteOffset, val.bytes.byteOffset + val.bytes.byteLength);
        },
      };
    },
    async head(key) {
      return assetsMap.has(key) ? {} : null;
    },
    async put(key, bytes, opts = {}) {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      assetsMap.set(key, { bytes: u8, contentType: opts.httpMetadata?.contentType || "image/jpeg" });
    },
    async list() {
      const allKeys = [...assetsMap.keys()];
      return {
        objects: allKeys.map((k) => ({ key: k })),
        truncated: false,
      };
    },
    _map: assetsMap,
  };

  const mockAccount = {
    async touchSession(token) {
      return token === "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" ? "digest" : null;
    },
  };

  const ACCOUNT = {
    idFromName() {
      return "account-id";
    },
    get() {
      return mockAccount;
    },
  };

  const mockIdentity = {
    async getAccountById(id) {
      return id === "11111111-2222-4333-8444-555555555555" ? { id } : null;
    },
  };

  const IDENTITY = {
    idFromName() {
      return "singleton";
    },
    get() {
      return mockIdentity;
    },
  };

  return { ASSETS, ACCOUNT, IDENTITY };
}

describe("worker asset endpoint", () => {
  const testBytes = Buffer.from("fake-portrait-image-bytes-jpeg");
  const sha = sha256Hex(testBytes);

  it("serves flat content-addressed asset on unauthenticated GET with public cache headers", async () => {
    const env = createMockEnv({
      [sha]: { bytes: testBytes, contentType: "image/jpeg" },
    });

    const req = new Request(`https://example.com/asset/${sha}`, {
      method: "GET",
      headers: { origin: "https://jordandav-is.github.io" },
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(res.headers.get("access-control-allow-origin"), "https://jordandav-is.github.io");

    const body = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(body, testBytes);
  });

  it("serves asset on unauthenticated GET from an arbitrary origin (public access)", async () => {
    const env = createMockEnv({
      [sha]: { bytes: testBytes, contentType: "image/jpeg" },
    });

    const req = new Request(`https://example.com/asset/${sha}`, {
      method: "GET",
      headers: { origin: "https://some-other-origin.org" },
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });

  it("finds and self-heals legacy asset stored under accountId/sha on unauthenticated GET", async () => {
    const accountId = "11111111-2222-4333-8444-555555555555";
    const legacyKey = `${accountId}/${sha}`;
    const env = createMockEnv({
      [legacyKey]: { bytes: testBytes, contentType: "image/png" },
    });

    // Asset is not yet in flat key
    assert.equal(env.ASSETS._map.has(sha), false);

    // Unauthenticated GET without account query
    const req = new Request(`https://example.com/asset/${sha}`, {
      method: "GET",
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");

    // Self-healing: should have cached at flat key
    assert.equal(env.ASSETS._map.has(sha), true);
    assert.deepEqual(Buffer.from(env.ASSETS._map.get(sha).bytes), testBytes);
  });

  it("returns 404 for non-existent asset on GET", async () => {
    const env = createMockEnv({});
    const notFoundSha = "0000000000000000000000000000000000000000000000000000000000000000";

    const req = new Request(`https://example.com/asset/${notFoundSha}`, {
      method: "GET",
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 404);
  });

  it("rejects PUT without account or authorization", async () => {
    const env = createMockEnv({});

    const req = new Request(`https://example.com/asset/${sha}`, {
      method: "PUT",
      body: testBytes,
      headers: { "content-type": "image/jpeg" },
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 400);
  });

  it("accepts PUT with valid account and token, storing in both flat and account keys", async () => {
    const env = createMockEnv({});
    const accountId = "11111111-2222-4333-8444-555555555555";
    const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const req = new Request(`https://example.com/asset/${sha}?account=${accountId}`, {
      method: "PUT",
      body: testBytes,
      headers: {
        "content-type": "image/jpeg",
        "authorization": `Bearer ${token}`,
      },
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);

    // Verify stored at both keys
    assert.equal(env.ASSETS._map.has(sha), true);
    assert.equal(env.ASSETS._map.has(`${accountId}/${sha}`), true);
  });
});

describe("worker conjure endpoint validation", () => {
  it("rejects conjure request with invalid referenceImage", async () => {
    const env = createMockEnv({});
    const accountId = "11111111-2222-4333-8444-555555555555";
    const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const req = new Request("https://example.com/conjure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        token,
        brief: { description: "A warrior" },
        referenceImage: "not-an-object",
      }),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 400);
  });

  it("rejects conjure request with malformed referenceImage data", async () => {
    const env = createMockEnv({});
    const accountId = "11111111-2222-4333-8444-555555555555";
    const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const req = new Request("https://example.com/conjure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        token,
        brief: { description: "A warrior" },
        referenceImage: { data: 12345 },
      }),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 400);
  });

  it("rejects conjure request with oversized body", async () => {
    const env = createMockEnv({});
    const accountId = "11111111-2222-4333-8444-555555555555";
    const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const req = new Request("https://example.com/conjure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        token,
        brief: { description: "A warrior" },
        referenceImage: { data: "x".repeat(3 * 1024 * 1024) },
      }),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 413);
  });
});
