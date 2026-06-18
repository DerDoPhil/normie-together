// Schema initialization is memoized inside the client (ensureSchema runs on
// first DB access). This module re-exports the helper for callers that want to
// trigger it explicitly (e.g. tests).
export { ensureDbInitialized } from "./client";
