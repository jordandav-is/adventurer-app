import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build path-agnostic: works at username.github.io/repo/ or any host
export default defineConfig({
  plugins: [react()],
  base: "./",
});
