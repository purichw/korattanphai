import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readAuthConfiguration } from "./src/authConfig.ts";
import { fileURLToPath } from "node:url";
import { createOperationalContextHandler } from "./server/operations/operational-context.mjs";
import { configuredCmsHandler } from "./server/admin-data/supabase.mjs";
import { cmsReferencePlugin } from './scripts/cms-reference-plugin.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_SUPABASE_");
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const backend = loadEnv(mode, process.cwd(), "VITE_DATA_BACKEND").VITE_DATA_BACKEND;
  const references = loadEnv(mode, process.cwd(), 'VITE_REFERENCE_BACKEND').VITE_REFERENCE_BACKEND;
  if (references && !['static', 'cms'].includes(references)) throw new Error('Unknown reference backend');
  if (references === 'cms' && backend !== 'supabase') throw new Error('CMS references require the database forecast backend');
  if (backend && !["static", "supabase"].includes(backend)) throw new Error("Unknown data backend");
  if (backend === "supabase" && (!url || !key)) throw new Error("Supabase data backend requires browser auth configuration");
  // Stop invalid or privileged keys before Vite can publish them in browser code.
  if (key && (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key.trim()) || (url && !readAuthConfiguration(url, key)))) {
    throw new Error("Invalid Supabase browser configuration. Use the project HTTPS URL and a publishable key only.");
  }
  return {
    plugins: [react(), ...(references === 'cms' ? [cmsReferencePlugin(process.cwd())] : []), {
      name: "operational-context-local",
      configureServer(server) {
        const handler = createOperationalContextHandler();
        let cms: ReturnType<typeof configuredCmsHandler> | undefined;
        server.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] === '/api/operational-context') handler(request, response);
          else if (request.url?.split('?')[0] === '/api/admin-data') {
            try { cms ??= configuredCmsHandler(); }
            catch {
              response.statusCode = 503;
              response.setHeader('Content-Type', 'application/json');
              response.setHeader('Cache-Control', 'private, no-store');
              response.end(JSON.stringify({ error: { code: 'cms_not_configured' } }));
              return;
            }
            void cms(request, response);
          }
          else next();
        });
      },
    }, ...(backend === "supabase" ? [{
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
      copyPublicDir: references !== 'cms',
      outDir: process.env.BUILD_OUT_DIR ?? "dist",
      sourcemap: false,
      minify: "oxc",
      cssMinify: true,
      reportCompressedSize: true,
    },
  };
});
