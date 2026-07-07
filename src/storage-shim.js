/* window.storage shim — mirrors the claude.ai artifact storage API on top of
   localStorage, so App.jsx runs unmodified in both realms. If the real
   window.storage exists (running inside claude.ai), this does nothing. */
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      if (v === null) throw new Error("key not found");
      return { key, value: v, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix, shared: false };
    },
  };
}
