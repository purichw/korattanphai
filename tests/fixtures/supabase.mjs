// Test-only network fixture. Never import this module from src/.
import { validateTelemetry } from '../../server/operations/telemetry.mjs';
export const authTestUrl = "https://ktp-auth-test.supabase.co";
export const authTestKey = "sb_publishable_test_only";
export const authTestEmail = "operator@example.test";
export const authTestPassword = " Test password 123! ";
export const authTestUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: authTestEmail,
  aud: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "ผู้ทดสอบระบบ" },
  created_at: "2026-09-05T00:00:00Z",
};
export const authStorageKey = "sb-ktp-auth-test-auth-token";

export function authTestSession(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: authTestUser.id, aud: "authenticated", exp: expiresAt })}.test-signature`,
    refresh_token: "test-only-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: authTestUser,
  };
}

export async function seedAuthSession(pageOrContext, expiresAt) {
  await pageOrContext.addInitScript(({ key, session }) => {
    // Once per isolated browser context: reload must exercise SDK persistence.
    if (!sessionStorage.getItem("ktp-test-session-seeded")) {
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.setItem("ktp-test-session-seeded", "1");
    }
  }, { key: authStorageKey, session: authTestSession(expiresAt) });
}

export async function mockSupabase(pageOrContext) {
  const requests = [];
  const telemetry = [];
  const state = { passwordDelayMs: 0, passwordNetworkError: false, logoutError: false, requests, telemetry };
  await pageOrContext.route('**/api/telemetry', async route => {
    if (!['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)) return route.abort('blockedbyclient');
    telemetry.push(validateTelemetry(route.request().postDataJSON()));
    return route.fulfill({ status: 204 });
  });
  await pageOrContext.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== authTestUrl) return route.abort("blockedbyclient");
    requests.push({ path: url.pathname, grant: url.searchParams.get("grant_type"), method: request.method() });
    if (url.pathname.endsWith("/token")) {
      if (url.searchParams.get("grant_type") === "password") {
        if (state.passwordDelayMs) await new Promise((resolve) => setTimeout(resolve, state.passwordDelayMs));
        if (state.passwordNetworkError) return route.abort("internetdisconnected");
        const body = request.postDataJSON();
        if (body.email !== authTestEmail || body.password !== authTestPassword) {
          return route.fulfill({ status: 400, json: { code: "invalid_credentials", message: "Invalid login credentials" } });
        }
      } else if (url.searchParams.get("grant_type") !== "refresh_token") {
        return route.fulfill({ status: 400, json: { message: "Unsupported test grant" } });
      }
      return route.fulfill({ status: 200, json: authTestSession() });
    }
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: state.logoutError ? 500 : 200, json: {} });
    if (url.pathname.endsWith("/user")) return route.fulfill({ status: 200, json: authTestUser });
    return route.abort("blockedbyclient");
  });
  return state;
}

export async function fillAuthForm(page, password = authTestPassword) {
  await page.getByLabel("อีเมล", { exact: true }).fill(authTestEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
}
