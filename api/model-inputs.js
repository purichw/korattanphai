import { createHandler, unavailableHandler } from '../server/model-inputs/handler.mjs';
import { createSupabaseStore } from '../server/model-inputs/storage.mjs';
import { clientsFromEnvironment } from '../server/operations/integration-auth.mjs';
import { createSupabaseRateLimiter, rateLimitOptionsFromEnvironment } from '../server/operations/rate-limit.mjs';

let configuredHandler;

// Vercel always uses durable server storage. Local files belong only to the local
// development server; a serverless /tmp directory must never acknowledge ingestion.
export default async function handler(request, response) {
  if (!configuredHandler) {
    try {
      configuredHandler = createHandler({
        token: process.env.MODEL_INPUT_API_TOKEN || undefined,
        readToken: process.env.MODEL_INPUT_READ_TOKEN || undefined,
        sourceId: process.env.MODEL_INPUT_SOURCE_ID,
        clients: clientsFromEnvironment(process.env.MODEL_INPUT_CLIENTS_JSON),
        rateLimiter: createSupabaseRateLimiter({
          url: process.env.MODEL_INPUT_SUPABASE_URL,
          key: process.env.MODEL_INPUT_SUPABASE_SECRET_KEY,
          ...rateLimitOptionsFromEnvironment(),
        }),
        store: createSupabaseStore({
          url: process.env.MODEL_INPUT_SUPABASE_URL,
          key: process.env.MODEL_INPUT_SUPABASE_SECRET_KEY,
        }),
      });
    } catch {
      return unavailableHandler(request, response);
    }
  }
  return configuredHandler(request, response);
}
