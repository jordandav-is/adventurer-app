import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createPasswordRecord,
  verifyPasswordRecord,
  isValidPasswordRecord,
  dummyPasswordWork,
  hashGatePassphrase,
  timingSafeEqualStr,
  derivePbkdf2Sha256Hex,
  bytesToHex,
  hexToBytes,
} from "./password.js";

describe("password module", () => {
  it("creates and verifies a valid password record", async () => {
    const password = "correct horse battery staple";
    const record = await createPasswordRecord(password);

    assert.equal(record.v, 1);
    assert.equal(record.algo, "PBKDF2-SHA256");
    assert.equal(record.iter, 600000);
    assert.match(record.salt, /^[0-9a-f]{32}$/i);
    assert.match(record.hash, /^[0-9a-f]{64}$/i);

    const valid = await verifyPasswordRecord(password, record);
    assert.equal(valid, true);

    const invalid = await verifyPasswordRecord("wrong horse battery staple", record);
    assert.equal(invalid, false);
  });

  it("matches standard Node crypto pbkdf2Sync output across iteration counts", async () => {
    const password = "standardPasswordTest";
    const saltBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);

    const nodeHash1k = crypto.pbkdf2Sync(password, saltBytes, 1000, 32, "sha256").toString("hex");
    const nobleHash1k = await derivePbkdf2Sha256Hex(password, saltBytes, 1000);
    assert.equal(nobleHash1k, nodeHash1k);

    const nodeHash600k = crypto.pbkdf2Sync(password, saltBytes, 600000, 32, "sha256").toString("hex");
    const nobleHash600k = await derivePbkdf2Sha256Hex(password, saltBytes, 600000);
    assert.equal(nobleHash600k, nodeHash600k);
  });

  it("generates distinct salts and hashes for the same password", async () => {
    const password = "mySecretPassword123!";
    const rec1 = await createPasswordRecord(password);
    const rec2 = await createPasswordRecord(password);

    assert.notEqual(rec1.salt, rec2.salt);
    assert.notEqual(rec1.hash, rec2.hash);
    assert.equal(await verifyPasswordRecord(password, rec1), true);
    assert.equal(await verifyPasswordRecord(password, rec2), true);
  });

  it("rejects malformed or version-mismatched records", async () => {
    const validRec = await createPasswordRecord("validPassword456");

    assert.equal(isValidPasswordRecord(null), false);
    assert.equal(isValidPasswordRecord(undefined), false);
    assert.equal(isValidPasswordRecord("not-an-object"), false);
    assert.equal(isValidPasswordRecord([]), false);
    assert.equal(isValidPasswordRecord(123), false);

    assert.equal(isValidPasswordRecord({ ...validRec, v: 2 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, v: 0 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, algo: "argon2id" }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, salt: "tooshort" }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, salt: "g".repeat(32) }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, iter: 0 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, iter: -100 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, iter: "600000" }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, iter: 599999 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, iter: 600001 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, iter: 100000 }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, hash: "short" }), false);
    assert.equal(isValidPasswordRecord({ ...validRec, hash: "z".repeat(64) }), false);

    assert.equal(await verifyPasswordRecord("validPassword456", null), false);
    assert.equal(await verifyPasswordRecord("validPassword456", { ...validRec, v: 2 }), false);
    assert.equal(await verifyPasswordRecord("validPassword456", { ...validRec, algo: "bcrypt" }), false);
    assert.equal(await verifyPasswordRecord("validPassword456", { ...validRec, hash: "00".repeat(32) }), false);
  });

  it("executes dummy password work with 600k iterations shape", async () => {
    const dummyHash = await dummyPasswordWork("wrongPassword");
    assert.match(dummyHash, /^[0-9a-f]{64}$/i);

    const dummyHashEmpty = await dummyPasswordWork("");
    assert.match(dummyHashEmpty, /^[0-9a-f]{64}$/i);
  });

  it("evaluates timing safe equality correctly", () => {
    assert.equal(timingSafeEqualStr("hello", "hello"), true);
    assert.equal(timingSafeEqualStr("hello", "world"), false);
    assert.equal(timingSafeEqualStr("hello", "hell"), false);
    assert.equal(timingSafeEqualStr("hello", ""), false);
    assert.equal(timingSafeEqualStr(null, "hello"), false);
    assert.equal(timingSafeEqualStr("hello", 123), false);
  });

  it("hashes gate passphrase correctly with salt and iterations", async () => {
    const salt = "edffce3ce9712cbd6f997900359f6dd9";
    const hash = await hashGatePassphrase("testpass", salt, 1000);
    assert.match(hash, /^[0-9a-f]{64}$/i);

    const expected = crypto.pbkdf2Sync("testpass", salt, 1000, 32, "sha256").toString("hex");
    assert.equal(hash, expected);
  });

  it("converts hex and bytes correctly", () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const hex = bytesToHex(bytes);
    assert.equal(hex, "deadbeef");
    assert.deepEqual(hexToBytes("deadbeef"), bytes);
    assert.throws(() => hexToBytes("deadbee"), TypeError);
    assert.throws(() => hexToBytes("invalid!"), TypeError);
  });
});
