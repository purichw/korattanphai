import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readAuthConfiguration } from "./src/authConfig.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_SUPABASE_");
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // Stop invalid or privileged keys before Vite can publish them in browser code.
  if (key && (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key.trim()) || (url && !readAuthConfiguration(url, key)))) {
    throw new Error("Invalid Supabase browser configuration. Use the project HTTPS URL and a publishable key only.");
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
    build: {
      outDir: process.env.BUILD_OUT_DIR ?? "dist",
      sourcemap: false,
      minify: "oxc",
      cssMinify: true,
      reportCompressedSize: true,
    },
  };
});
