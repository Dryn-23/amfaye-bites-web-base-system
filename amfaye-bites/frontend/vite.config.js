import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          admin: [
            "lucide-react",
            "./src/pages/admin/PromotionsAdmin.jsx",
            "./src/pages/admin/ShiftReport.jsx",
            "./src/pages/admin/Analytics.jsx",
            "./src/pages/admin/Reports.jsx",
            "./src/pages/admin/Dashboard.jsx",
          ],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
    proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: true } },
  },
});
