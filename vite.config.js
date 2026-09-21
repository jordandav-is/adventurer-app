import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "three", test: /[\\/]node_modules[\\/]three[\\/]/ },
            { name: "pdf", test: /[\\/]node_modules[\\/](pdf-lib|@pdf-lib|pako|tslib)[\\/]/ },
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
            },
          ],
        },
      },
    },
  },
});
