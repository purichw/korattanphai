import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readAuthConfiguration } from "./src/authConfig.ts";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_SUPABASE_");
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const backend = loadEnv(mode, process.cwd(), "VITE_DATA_BACKEND").VITE_DATA_BACKEND;
  if (backend && !["static", "supabase"].includes(backend)) throw new Error("Unknown data backend");
  if (backend === "supabase" && (!url || !key)) throw new Error("Supabase data backend requires browser auth configuration");
  // Stop invalid or privileged keys before Vite can publish them in browser code.
  if (key && (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key.trim()) || (url && !readAuthConfiguration(url, key)))) {
    throw new Error("Invalid Supabase browser configuration. Use the project HTTPS URL and a publishable key only.");
  }
  return {
    plugins: [react(), ...(backend === "supabase" ? [{
      name: "forecast-database-build",
      generateBundle(this: { emitFile: (asset: { type: "asset"; fileName: string; source: string }) => void }) {
        this.emitFile({ type: "asset", fileName: "data-backend.json", source: '{"backend":"supabase"}' });
      },
    }] : [])],
    // Cover root and nested consumers; the database build must not ship the
    // static archive through a lazy analysis dialog either.
    resolve: { alias: backend === "supabase" ? [{
      find: /^(?:\.{1,2}\/)+data\/forecastArchive$/,
      replacement: fileURLToPath(new URL("./src/data/disabledStaticForecastArchive.ts", import.meta.url)),
    }] : [] },
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
