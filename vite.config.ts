import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Base handling:
  // - Local dev: "/"
  // - Vercel standalone (VERCEL=1): "/" (standalone at root)
  // - dsakapp subpath deploy (local build for zaigla.com/linetapp): "/linetapp/"
  // Override explicitly: VITE_BASE=/ or VITE_BASE=/linetapp/ npm run build
  base: process.env.VITE_BASE ?? (process.env.VERCEL ? "/" : command === "build" ? "/linetapp/" : "/"),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
}));
