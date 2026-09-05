import { test as base, expect } from "@playwright/test";
import { mockSupabase } from "../tests/fixtures/supabase.mjs";

export const test = base.extend<{ authMock: Awaited<ReturnType<typeof mockSupabase>> }>({
  authMock: [async ({ context, baseURL }, use) => {
    if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
      throw new Error("Mock auth tests only run against localhost; use the separate real-account smoke harness for Preview.");
    }
    await use(await mockSupabase(context));
  }, { auto: true }],
});
export { expect };
export type { Page, Locator } from "@playwright/test";
export { authTestEmail, authTestPassword, authTestUser, authStorageKey, fillAuthForm, seedAuthSession } from "../tests/fixtures/supabase.mjs";
