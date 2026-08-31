// Public runtime config; empty SYNC_URL keeps app local-only.
export const SYNC_URL = (import.meta.env?.VITE_SYNC_URL || "").trim().replace(/\/+$/, "");
