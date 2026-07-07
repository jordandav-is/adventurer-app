/* window.storage shim — mirrors the claude.ai artifact storage API on top of
   IndexedDB (roomy: compendium imports with items and rules text run several
   megabytes, past localStorage's quota). Values already in localStorage are
   read as a fallback and migrated forward on the next write. Small values are
   mirrored back to localStorage for compatibility. If the real window.storage
   exists (running inside claude.ai), this does nothing. */
if (!window.storage) {
  const DB = "ledger-storage";
  const STORE = "kv";
  let dbPromise = null;
  const openDb = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  };
  const idb = (mode, fn) =>
    openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );

  window.storage = {
    async get(key) {
      let v = null;
      try { v = await idb("readonly", (s) => s.get(key)); } catch { /* idb unavailable */ }
      if (v === undefined || v === null) v = localStorage.getItem(key); // migration fallback
      if (v === null || v === undefined) throw new Error("key not found");
      return { key, value: v, shared: false };
    },
    async set(key, value) {
      try { await idb("readwrite", (s) => s.put(value, key)); } catch { /* fall through */ }
      // mirror small values so external tools (and old versions) still see them
      try {
        if (value.length < 200000) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      } catch { /* quota — idb has it, carry on */ }
      return { key, value, shared: false };
    },
    async delete(key) {
      try { await idb("readwrite", (s) => s.delete(key)); } catch { /* noop */ }
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      let keys = [];
      try { keys = (await idb("readonly", (s) => s.getAllKeys())) || []; } catch { /* noop */ }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !keys.includes(k)) keys.push(k);
      }
      return { keys: keys.filter((k) => String(k).startsWith(prefix)), prefix, shared: false };
    },
  };
}
