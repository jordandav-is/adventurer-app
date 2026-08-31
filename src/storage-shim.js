// IndexedDB window.storage shim with localStorage fallback and migration.
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
      try { v = await idb("readonly", (s) => s.get(key)); } catch {}
      if (v === undefined || v === null) v = localStorage.getItem(key);
      if (v === null || v === undefined) throw new Error("key not found");
      return { key, value: v, shared: false };
    },
    async set(key, value) {
      try { await idb("readwrite", (s) => s.put(value, key)); } catch {}
      try {
        if (value.length < 200000) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      } catch {}
      return { key, value, shared: false };
    },
    async delete(key) {
      try { await idb("readwrite", (s) => s.delete(key)); } catch {}
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      let keys = [];
      try { keys = (await idb("readonly", (s) => s.getAllKeys())) || []; } catch {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !keys.includes(k)) keys.push(k);
      }
      return { keys: keys.filter((k) => String(k).startsWith(prefix)), prefix, shared: false };
    },
  };
}
