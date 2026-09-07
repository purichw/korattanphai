import { test as base, expect } from "@playwright/test";
import { mockSupabase } from "../tests/fixtures/supabase.mjs";
import { readFileSync } from 'node:fs';
import { forecastRevision } from '../tests/fixtures/forecast-slice.mjs';

export const test = base.extend<{ authMock: Awaited<ReturnType<typeof mockSupabase>> }>({
  authMock: [async ({ context, baseURL }, use) => {
    if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
      throw new Error("Mock auth tests only run against localhost; use the separate real-account smoke harness for Preview.");
    }
    const auth = await mockSupabase(context);
    const source = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    await context.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_latest_forecast_revision', route => route.fulfill({ json: forecastRevision(source) }));
    await use(auth);
  }, { auto: true }],
});
export { expect };
export type { Page, Locator } from "@playwright/test";
export { authTestEmail, authTestPassword, authTestUser, authStorageKey, fillAuthForm, seedAuthSession } from "../tests/fixtures/supabase.mjs";
