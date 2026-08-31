import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const DUMMY_SALT = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const HEX_32_RE = /^[0-9a-f]{32}$/i;
const HEX_64_RE = /^[0-9a-f]{64}$/i;

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0) {
    throw new TypeError("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const val = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(val)) {
      throw new TypeError("Invalid hex string");
    }
    bytes[i / 2] = val;
  }
  return bytes;
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function derivePbkdf2Sha256Hex(password, saltBytes, iterations = 600000) {
  const enc = new TextEncoder();
  const pwdBytes = typeof password === "string" ? enc.encode(password) : password;
  const salt = typeof saltBytes === "string" ? enc.encode(saltBytes) : saltBytes;
  const derived = await pbkdf2Async(sha256, pwdBytes, salt, {
    c: iterations,
    dkLen: 32,
    asyncTick: 10,
  });
  return bytesToHex(derived);
}

export function isValidPasswordRecord(record) {
  if (!record || typeof record !== "object") return false;
  if (record.v !== 1) return false;
  if (record.algo !== "PBKDF2-SHA256") return false;
  if (typeof record.salt !== "string" || !HEX_32_RE.test(record.salt)) return false;
  if (record.iter !== 600000) return false;
  if (typeof record.hash !== "string" || !HEX_64_RE.test(record.hash)) return false;
  return true;
}

export async function createPasswordRecord(password, options = {}) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password must be a non-empty string");
  }
  let saltBytes;
  if (options.saltBytes) {
    saltBytes = options.saltBytes;
  } else {
    saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
  }
  const salt = bytesToHex(saltBytes);
  const iter = 600000;
  const hash = await derivePbkdf2Sha256Hex(password, saltBytes, iter);
  return {
    v: 1,
    algo: "PBKDF2-SHA256",
    salt,
    iter,
    hash,
  };
}

export async function verifyPasswordRecord(password, record) {
  if (typeof password !== "string" || !isValidPasswordRecord(record)) {
    return false;
  }
  let saltBytes;
  try {
    saltBytes = hexToBytes(record.salt);
  } catch {
    return false;
  }
  const computedHash = await derivePbkdf2Sha256Hex(password, saltBytes, record.iter);
  return timingSafeEqualStr(computedHash, record.hash);
}

export async function dummyPasswordWork(password = "dummy-password") {
  const pwd = typeof password === "string" && password ? password : "dummy-password";
  return derivePbkdf2Sha256Hex(pwd, DUMMY_SALT, 600000);
}

export async function hashGatePassphrase(passphrase, saltStr, iterations = 600000) {
  const enc = new TextEncoder();
  return derivePbkdf2Sha256Hex(passphrase.trim(), enc.encode(saltStr), iterations);
}
