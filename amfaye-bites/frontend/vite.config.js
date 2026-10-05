import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep React out of the app chunk so it can be cached across deploys.
        manualChunks: { vendor: ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
    proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: true } },
  },
});
