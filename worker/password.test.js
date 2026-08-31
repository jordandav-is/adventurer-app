import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPasswordRecord,
  verifyPasswordRecord,
  isValidPasswordRecord,
  dummyPasswordWork,
  hashGatePassphrase,
  timingSafeEqualStr,
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
