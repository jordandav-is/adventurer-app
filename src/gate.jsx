import React, { useState } from "react";
import { GATE_SALT, GATE_HASH, GATE_ITERATIONS } from "./gate-config.js";

/* A client-side passphrase gate in the ledger's livery. Unlocking is
   remembered per device in localStorage, so the home-screen app only asks
   once. This keeps casual visitors out of a public Pages URL — it is not
   server-side auth. Characters live only in each device's own localStorage,
   so no visitor can ever see another's data regardless. */

const UNLOCK_KEY = "ledger-gate-unlock";

async function hashPhrase(phrase) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(phrase.trim()),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(GATE_SALT),
      iterations: GATE_ITERATIONS,
    },
    key,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Gate({ children }) {
  const [unlocked, setUnlocked] = useState(
    () => localStorage.getItem(UNLOCK_KEY) === GATE_HASH
  );
  const [phrase, setPhrase] = useState("");
  const [shake, setShake] = useState(false);

  if (unlocked) return children;

  const attempt = async (e) => {
    e.preventDefault();
    if ((await hashPhrase(phrase)) === GATE_HASH) {
      localStorage.setItem(UNLOCK_KEY, GATE_HASH);
      setUnlocked(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#141210",
        fontFamily: "Georgia, serif",
        padding: 24,
      }}
    >
      <form onSubmit={attempt} style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🗝️</div>
        <div style={{ color: "#d9b45e", fontSize: 20, marginBottom: 4 }}>
          The Adventurer's Ledger
        </div>
        <div style={{ color: "#a2937f", fontSize: 13, marginBottom: 20 }}>
          Speak the words of binding
        </div>
        <input
          type="password"
          autoFocus
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="passphrase"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: 16,
            background: "#241a10",
            color: "#e8dfd0",
            border: `1px solid ${shake ? "#d76a76" : "#8a6c2c"}`,
            borderRadius: 6,
            outline: "none",
            textAlign: "center",
          }}
        />
        <button
          type="submit"
          style={{
            marginTop: 14,
            padding: "10px 28px",
            fontSize: 15,
            fontFamily: "inherit",
            background: "#c9a44c",
            color: "#141210",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Enter
        </button>
        {shake && (
          <div style={{ color: "#d76a76", fontSize: 12, marginTop: 12 }}>
            The gate does not yield.
          </div>
        )}
      </form>
    </div>
  );
}
