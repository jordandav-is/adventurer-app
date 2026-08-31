import React, { useState, useRef } from "react";

function generateRegistrationId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const ShareIcon = ({ size = 15, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: "-2px", marginRight: 6, ...style }}
  >
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="m8 6 4-4 4 4" />
    <path d="M12 2v13" />
  </svg>
);

export function AccountPanel({ cloud, account, syncState, onAccount, toolRow, hint, theme = {} }) {
  const T = theme;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showChangePw, setShowChangePw] = useState(false);
  const [showRotateKey, setShowRotateKey] = useState(false);
  const [newlyIssuedKey, setNewlyIssuedKey] = useState(null);
  const [copyState, setCopyState] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const registrationIdRef = useRef(null);

  const resetForms = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPassphrase("");
    setRecoveryKeyInput("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    registrationIdRef.current = null;
    setMsg("");
    setPwSuccess("");
    setCopyState("");
  };

  const field = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 44,
    padding: "9px 12px",
    fontSize: 14,
    background: T.panel2,
    color: T.ink,
    border: `1px solid ${T.edge}`,
    borderRadius: 8,
    fontFamily: "inherit",
    opacity: busy ? 0.7 : 1,
    "--account-focus": T.gold || "#c9a44c",
  };

  const actBtn = (solid, isBusy) => ({
    minHeight: 44,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 600,
    borderRadius: 12,
    cursor: isBusy ? "default" : "pointer",
    opacity: isBusy ? 0.6 : 1,
    background: solid ? T.blood : "transparent",
    color: solid ? T.ink : T.gold,
    border: solid ? `1px solid ${T.blood}` : `1px solid ${T.gold}`,
    textAlign: "center",
    "--account-focus": T.gold || "#c9a44c",
  });

  const tabBtn = (active, isBusy) => ({
    flex: 1,
    minHeight: 44,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 6px",
    fontSize: 12.5,
    fontFamily: "inherit",
    fontWeight: active ? 700 : 500,
    borderRadius: 8,
    cursor: isBusy ? "default" : "pointer",
    opacity: isBusy ? 0.6 : 1,
    background: active ? T.blood : "transparent",
    color: active ? T.ink : T.dim,
    border: active ? `1px solid ${T.blood}` : `1px solid ${T.edge}`,
    textAlign: "center",
    transition: "all 0.15s ease",
    "--account-focus": T.gold || "#c9a44c",
  });

  if (!cloud) return null;

  const renderKeyModal = () => {
    if (!newlyIssuedKey) return null;
    return (
      <div
        role="region"
        aria-label={newlyIssuedKey.title}
        style={{
          display: "grid",
          gap: 10,
          padding: "14px",
          background: T.panel || "#1c1815",
          border: `1px solid ${T.gold || "#c9a44c"}`,
          borderRadius: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: T.gold, fontSize: 16 }}>✦</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.gold, fontFamily: "Georgia, serif" }}>
            {newlyIssuedKey.title}
          </span>
        </div>
        <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.45 }}>
          {newlyIssuedKey.subtitle}
        </div>
        <div
          style={{
            display: "grid",
            gap: 4,
            padding: "10px 12px",
            background: T.panel2,
            borderRadius: 8,
            border: `1px solid ${T.edge}`,
          }}
        >
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Recovery Key (save now)
          </div>
          <div
            tabIndex={0}
            aria-label="Recovery key value"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
              wordBreak: "break-all",
              color: T.ink,
              userSelect: "all",
              WebkitUserSelect: "all",
              lineHeight: 1.5,
              padding: "4px 0",
            }}
          >
            {newlyIssuedKey.key}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="account-control"
            style={{ ...actBtn(false, false), flex: "1 1 120px" }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(newlyIssuedKey.key);
                setCopyState("Copied to clipboard!");
                setTimeout(() => setCopyState(""), 3000);
              } catch {
                setCopyState("Please select and copy the text manually.");
              }
            }}
          >
            Copy key
          </button>
          <button
            type="button"
            className="account-control"
            style={{ ...actBtn(true, false), flex: "1 1 140px" }}
            onClick={() => {
              setNewlyIssuedKey(null);
              setCopyState("");
            }}
          >
            I have saved this key
          </button>
        </div>
        {copyState && (
          <div role="status" style={{ color: T.green, fontSize: 12 }}>
            {copyState}
          </div>
        )}
      </div>
    );
  };

  if (account) {
    const handleChangePassword = async (e) => {
      e.preventDefault();
      if (!currentPassword) {
        setMsg("Current password is required.");
        return;
      }
      if (newPassword.length < 8 || newPassword.length > 256) {
        setMsg("New password must be between 8 and 256 characters.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setMsg("New passwords do not match.");
        return;
      }
      setBusy(true);
      setMsg("");
      setPwSuccess("");
      try {
        const data = await cloud.changePassword(currentPassword, newPassword);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setShowChangePw(false);
        setPwSuccess("Password updated.");
        onAccount(cloud.getAccount()?.email || null);
        if (data?.recoveryKey) {
          setNewlyIssuedKey({
            key: data.recoveryKey,
            title: "Password Updated — New Recovery Key",
            subtitle: "Your password was changed and old sessions revoked. Save your new replacement recovery key below.",
          });
        }
      } catch (err) {
        setMsg(err.message || "Failed to change password.");
      } finally {
        setBusy(false);
      }
    };

    const handleRotateKey = async (e) => {
      e.preventDefault();
      if (!currentPassword) {
        setMsg("Current password is required.");
        return;
      }
      setBusy(true);
      setMsg("");
      try {
        const data = await cloud.rotateRecoveryKey(currentPassword);
        setCurrentPassword("");
        setShowRotateKey(false);
        if (data?.recoveryKey) {
          setNewlyIssuedKey({
            key: data.recoveryKey,
            title: "New Recovery Key Issued",
            subtitle: "Your previous recovery key has been replaced. Save this new recovery key in a safe place.",
          });
        }
      } catch (err) {
        setMsg(err.message || "Failed to generate new recovery key.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <div style={{ display: "grid", gap: 6, width: "100%", minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
        {renderKeyModal()}
        <div style={{ ...toolRow, cursor: "default", minWidth: 0, maxWidth: "100%", flexWrap: "wrap" }}>
          <span
            title={syncState === "live" ? "Synced live" : "Waiting for signal"}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              flex: "0 0 auto",
              background: syncState === "live" ? T.green : T.dim,
              boxShadow: syncState === "live" ? `0 0 6px ${T.green}88` : "none",
            }}
          />
          <span
            title={account}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {account}
          </span>
          <button
            type="button"
            className="account-control"
            aria-expanded={showChangePw}
            aria-controls="change-password-form"
            disabled={busy}
            style={{
              color: T.dim,
              fontSize: 12,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              padding: "0 4px",
              font: "inherit",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              textDecoration: "underline dotted",
              "--account-focus": T.gold || "#c9a44c",
            }}
            onClick={() => {
              setShowChangePw(!showChangePw);
              setShowRotateKey(false);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmNewPassword("");
              setMsg("");
              setPwSuccess("");
            }}
          >
            {showChangePw ? "cancel" : "change password"}
          </button>
          <button
            type="button"
            className="account-control"
            aria-expanded={showRotateKey}
            aria-controls="rotate-key-form"
            disabled={busy}
            style={{
              color: T.dim,
              fontSize: 12,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              padding: "0 4px",
              font: "inherit",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              textDecoration: "underline dotted",
              "--account-focus": T.gold || "#c9a44c",
            }}
            onClick={() => {
              setShowRotateKey(!showRotateKey);
              setShowChangePw(false);
              setCurrentPassword("");
              setMsg("");
              setPwSuccess("");
            }}
          >
            {showRotateKey ? "cancel" : "recovery key"}
          </button>
          <button
            type="button"
            className="account-control"
            disabled={busy}
            style={{
              color: T.dim,
              fontSize: 12,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              padding: "0 4px",
              font: "inherit",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              textDecoration: "underline dotted",
              "--account-focus": T.gold || "#c9a44c",
            }}
            onClick={() => {
              cloud.signOut();
              resetForms();
              setShowChangePw(false);
              setShowRotateKey(false);
              setNewlyIssuedKey(null);
              onAccount(null);
            }}
          >
            sign out
          </button>
        </div>

        {showChangePw && (
          <form
            id="change-password-form"
            aria-busy={busy}
            onSubmit={handleChangePassword}
            style={{ display: "grid", gap: 8, padding: "8px 12px 10px", background: T.panel2, borderRadius: 8, border: `1px solid ${T.edge}` }}
          >
            <div style={{ fontSize: 12.5, color: T.gold, fontWeight: 600 }}>
              Change account password
            </div>
            <input
              type="password"
              required
              aria-label="Current password"
              disabled={busy}
              className="account-control"
              autoComplete="current-password"
              minLength={8}
              maxLength={256}
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={field}
            />
            <input
              type="password"
              required
              aria-label="New password"
              disabled={busy}
              className="account-control"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              placeholder="New password (8–256 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={field}
            />
            <input
              type="password"
              required
              aria-label="Confirm new password"
              disabled={busy}
              className="account-control"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              style={field}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={busy} className="account-control" style={{ ...actBtn(true, busy), flex: 1 }}>
                {busy ? "Saving…" : "Save password"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="account-control"
                onClick={() => {
                  setShowChangePw(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setMsg("");
                }}
                style={actBtn(false, busy)}
              >
                Cancel
              </button>
            </div>
            {msg && <div role="alert" style={{ color: T.error, fontSize: 12 }}>{msg}</div>}
          </form>
        )}

        {showRotateKey && (
          <form
            id="rotate-key-form"
            aria-busy={busy}
            onSubmit={handleRotateKey}
            style={{ display: "grid", gap: 8, padding: "8px 12px 10px", background: T.panel2, borderRadius: 8, border: `1px solid ${T.edge}` }}
          >
            <div style={{ fontSize: 12.5, color: T.gold, fontWeight: 600 }}>
              Issue new recovery key
            </div>
            <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.4 }}>
              Enter your current password to replace your existing recovery key.
            </div>
            <input
              type="password"
              required
              aria-label="Current password for recovery key"
              disabled={busy}
              className="account-control"
              autoComplete="current-password"
              minLength={8}
              maxLength={256}
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={field}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={busy} className="account-control" style={{ ...actBtn(true, busy), flex: 1 }}>
                {busy ? "Generating…" : "Generate new key"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="account-control"
                onClick={() => {
                  setShowRotateKey(false);
                  setCurrentPassword("");
                  setMsg("");
                }}
                style={actBtn(false, busy)}
              >
                Cancel
              </button>
            </div>
            {msg && <div role="alert" style={{ color: T.error, fontSize: 12 }}>{msg}</div>}
          </form>
        )}

        {pwSuccess && <div role="status" style={{ color: T.green, fontSize: 12.5, padding: "0 12px" }}>{pwSuccess}</div>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        className="account-control"
        style={{ ...toolRow, "--account-focus": T.gold || "#c9a44c" }}
        onClick={() => { setOpen(true); setMode("signin"); resetForms(); }}
      >
        <ShareIcon size={15} /> Account sync <span style={hint}>live across devices</span>
      </button>
    );
  }

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setMsg("Email and password are required.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await cloud.signInPassword(email, password);
      resetForms();
      onAccount(cloud.getAccount()?.email || null);
      setOpen(false);
    } catch (err) {
      setMsg(err.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || cleanEmail.length > 254) {
      setMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 8 || password.length > 256) {
      setMsg("Password must be between 8 and 256 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }
    if (!passphrase.trim() || passphrase.length > 256) {
      setMsg("Ledger passphrase is required.");
      return;
    }

    if (!registrationIdRef.current) {
      registrationIdRef.current = generateRegistrationId();
    }

    setBusy(true);
    setMsg("");
    try {
      const data = await cloud.registerPassword(cleanEmail, password, passphrase, registrationIdRef.current);
      resetForms();
      onAccount(cloud.getAccount()?.email || null);
      if (data?.recoveryKey) {
        setNewlyIssuedKey({
          key: data.recoveryKey,
          title: "Account Created — Save Your Recovery Key",
          subtitle: "This key is the ONLY way to recover your account if you forget your password. Store it somewhere safe.",
        });
      } else {
        setOpen(false);
      }
    } catch (err) {
      setMsg(err.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || cleanEmail.length > 254) {
      setMsg("Please enter a valid email address.");
      return;
    }
    if (!recoveryKeyInput.trim()) {
      setMsg("Please enter your recovery key.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 256) {
      setMsg("New password must be between 8 and 256 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setMsg("New passwords do not match.");
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const data = await cloud.recoverPassword(cleanEmail, recoveryKeyInput.trim(), newPassword);
      resetForms();
      onAccount(cloud.getAccount()?.email || null);
      if (data?.recoveryKey) {
        setNewlyIssuedKey({
          key: data.recoveryKey,
          title: "Account Recovered — New Recovery Key",
          subtitle: "Your password has been reset and old sessions revoked. Save your new replacement recovery key below.",
        });
      } else {
        setOpen(false);
      }
    } catch (err) {
      setMsg(err.message || "Recovery failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12, padding: "12px", background: T.panel2, borderRadius: 8, border: `1px solid ${T.edge}`, marginTop: 4 }}>
      {renderKeyModal()}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.gold }}>Account Sync</span>
        <button
          type="button"
          aria-label="Close account panel"
          className="account-control"
          disabled={busy}
          style={{
            ...hint,
            minHeight: 44,
            minWidth: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            padding: 0,
            margin: "-8px -8px -8px auto",
            font: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
            fontSize: 14,
            "--account-focus": T.gold || "#c9a44c",
          }}
          onClick={() => {
            setOpen(false);
            resetForms();
            setNewlyIssuedKey(null);
          }}
        >
          ✕
        </button>
      </div>

      <div role="group" aria-label="Account access mode" style={{ display: "flex", gap: 4, background: T.panel || T.panel2, padding: 3, borderRadius: 10, border: `1px solid ${T.edge}` }}>
        <button
          type="button"
          className="account-control"
          aria-pressed={mode === "signin"}
          disabled={busy}
          style={tabBtn(mode === "signin", busy)}
          onClick={() => { setMode("signin"); setMsg(""); setPwSuccess(""); }}
        >
          Sign in
        </button>
        <button
          type="button"
          className="account-control"
          aria-pressed={mode === "register"}
          disabled={busy}
          style={tabBtn(mode === "register", busy)}
          onClick={() => { setMode("register"); setMsg(""); setPwSuccess(""); }}
        >
          Create account
        </button>
        <button
          type="button"
          className="account-control"
          aria-pressed={mode === "recover"}
          disabled={busy}
          style={tabBtn(mode === "recover", busy)}
          onClick={() => { setMode("recover"); setMsg(""); setPwSuccess(""); }}
        >
          Recover
        </button>
      </div>

      <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.4 }}>
        {mode === "signin" && "Email is an unverified login identifier. Forgotten passwords can be reset using your saved recovery key."}
        {mode === "register" && "Enter the ledger passphrase to forge a new account. A unique recovery key will be generated."}
        {mode === "recover" && "Reset your password using your saved recovery key. A replacement key will be issued upon recovery."}
      </div>

      {mode === "signin" && (
        <form onSubmit={handleSignIn} aria-busy={busy} style={{ display: "grid", gap: 8 }}>
          <input
            type="email"
            required
            aria-label="Email"
            disabled={busy}
            className="account-control"
            autoComplete="email"
            maxLength={254}
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); registrationIdRef.current = null; }}
            style={field}
          />
          <input
            type="password"
            required
            aria-label="Password"
            disabled={busy}
            className="account-control"
            autoComplete="current-password"
            minLength={8}
            maxLength={256}
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); registrationIdRef.current = null; }}
            style={field}
          />
          <button type="submit" disabled={busy} className="account-control" style={actBtn(true, busy)}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {mode === "register" && (
        <form onSubmit={handleRegister} aria-busy={busy} style={{ display: "grid", gap: 8 }}>
          <input
            type="email"
            required
            aria-label="Email"
            disabled={busy}
            className="account-control"
            autoComplete="email"
            maxLength={254}
            placeholder="Email (unverified identifier)"
            value={email}
            onChange={(e) => { setEmail(e.target.value); registrationIdRef.current = null; }}
            style={field}
          />
          <input
            type="password"
            required
            aria-label="Password"
            disabled={busy}
            className="account-control"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            placeholder="Password (8–256 characters)"
            value={password}
            onChange={(e) => { setPassword(e.target.value); registrationIdRef.current = null; }}
            style={field}
          />
          <input
            type="password"
            required
            aria-label="Confirm password"
            disabled={busy}
            className="account-control"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); registrationIdRef.current = null; }}
            style={field}
          />
          <input
            type="password"
            required
            aria-label="Ledger passphrase"
            disabled={busy}
            className="account-control"
            autoComplete="off"
            maxLength={256}
            placeholder="Ledger passphrase"
            value={passphrase}
            onChange={(e) => { setPassphrase(e.target.value); registrationIdRef.current = null; }}
            style={field}
          />
          <button type="submit" disabled={busy} className="account-control" style={actBtn(true, busy)}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}

      {mode === "recover" && (
        <form onSubmit={handleRecover} aria-busy={busy} style={{ display: "grid", gap: 8 }}>
          <input
            type="email"
            required
            aria-label="Email"
            disabled={busy}
            className="account-control"
            autoComplete="email"
            maxLength={254}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={field}
          />
          <input
            type="text"
            required
            aria-label="Recovery key"
            disabled={busy}
            className="account-control"
            autoComplete="off"
            maxLength={100}
            placeholder="ledger-recovery-..."
            value={recoveryKeyInput}
            onChange={(e) => setRecoveryKeyInput(e.target.value)}
            style={{
              ...field,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
            }}
          />
          <input
            type="password"
            required
            aria-label="New password"
            disabled={busy}
            className="account-control"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            placeholder="New password (8–256 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={field}
          />
          <input
            type="password"
            required
            aria-label="Confirm new password"
            disabled={busy}
            className="account-control"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            placeholder="Confirm new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            style={field}
          />
          <button type="submit" disabled={busy} className="account-control" style={actBtn(true, busy)}>
            {busy ? "Resetting password…" : "Reset password & sign in"}
          </button>
        </form>
      )}

      {msg && <div role="alert" style={{ color: T.error, fontSize: 12.5 }}>{msg}</div>}
    </div>
  );
}

export default AccountPanel;
