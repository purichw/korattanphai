import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockSupabase } from "../tests/fixtures/supabase.mjs";
import { readFileSync } from 'node:fs';
import { forecastRevision } from '../tests/fixtures/forecast-slice.mjs';
import { BUSINESS_TIMEZONE, OPERATIONAL_POLICY_VERSION, businessMonth, nextBusinessMonth, operationalFamily, sourceAvailability } from '../src/data/operationalPolicy.mjs';

export const test = base.extend<{ authMock: Awaited<ReturnType<typeof mockSupabase>> }>({
  authMock: [async ({ context, baseURL }, use) => {
    if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
      throw new Error("Mock auth tests only run against localhost; use the separate real-account smoke harness for Preview.");
    }
    const auth = await mockSupabase(context);
    // Built previews have no serverless runtime; keep primary navigation explicit
    // while providing the same read-only clock/catalog contract as the API.
    await context.route('**/api/operational-context**', route => {
      const now = '2026-09-20T05:00:00Z';
      const validPeriod = new URL(route.request().url()).searchParams.get('period') ?? businessMonth(now);
      return route.fulfill({ json: { policyVersion: OPERATIONAL_POLICY_VERSION, timezone: BUSINESS_TIMEZONE,
        serverNow: now, currentPeriod: businessMonth(now), validPeriod, nextBoundary: nextBusinessMonth(now),
        family: operationalFamily(validPeriod, now), sourceAvailability,
        actualPeriods: [], forecastPeriods: [], latestActualPeriod: null } });
    });
    const source = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    await context.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_latest_forecast_revision', route => route.fulfill({ json: forecastRevision(source) }));
    await use(auth);
  }, { auto: true }],
});
export { expect };
export async function openAccountMenu(page: Page) {
  await expect(page.locator('.sidebar-account .account-trigger')).toHaveCount(1);
  // The shell mounts before blocking page reads release its visibility/inert gate.
  await expect(page.locator('.sidebar')).toBeVisible();
  const navigationToggle = page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true });
  if (await navigationToggle.isVisible()) await navigationToggle.click();
  await page.getByRole('button', { name: /บัญชีผู้ใช้/ }).click();
  return page.getByRole('menu', { name: 'บัญชีผู้ใช้', exact: true });
}
export type { Page, Locator } from "@playwright/test";
export { authTestEmail, authTestPassword, authTestUser, authStorageKey, adminAuthStorageKey, fillAuthForm, seedAuthSession, seedAdminSession } from "../tests/fixtures/supabase.mjs";
