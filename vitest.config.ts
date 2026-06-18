import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
    // better-sqlite3 is a native addon that can segfault under worker_threads
    // (vitest's default "threads" pool). Forks run tests in child processes,
    // which handle native bindings safely.
    pool: "forks",
  },
});
