import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Default base path matches GitHub Pages (project served at /save-the-future/).
// Override with VITE_BASE="/" when deploying to the domain root (Vercel, Netlify, own hosting).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_BASE || "/save-the-future/",
  };
});
