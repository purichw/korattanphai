# Supabase Email + Password

## Scope And Status

Data follow-up: `VITE_DATA_BACKEND=supabase` enables the migration provider
and owner-only saved workspaces described in `SUPABASE_DATA_MIGRATION.md`.
Remote schema and verified archive publication are complete; see HANDOFF for
production promotion. The
historical auth release below did not migrate data. New database-mode builds
omit raw archive assets, but older public deployment URLs are not revoked.

The frontend now uses `@supabase/supabase-js` for email/password login, initial
session restoration, refresh, auth-change events and local-scope logout. This
has passed local mock verification and real-account candidate/production smoke
on 2026-09-05. Runtime commit `15275fd` is deployed; exact evidence and recovery
deployment are recorded separately from local checks in `docs/HANDOFF.md`.

The user reports that project `dihchjflzhcekywarhxd` has six `ktp_` tables, RLS,
area seeds, an Auto Confirm first user, and Production/Preview Vercel variables.
Release inspection with `vercel env ls` on 2026-09-05 found the two frontend
Supabase variables in Production only; Preview variables were not present.
The Production URL was corrected from a dashboard link to the API origin;
the key was unchanged. A real account passed login/logout on desktop/mobile.
The user disabled self-signup; a read-only settings check confirmed it and the
enabled email provider. Tables, RLS and area seeds have since been audited by
the migration task; its evidence and scope are in `SUPABASE_DATA_MIGRATION.md`.
The frontend has no signup control, but hiding it alone does not disable the API.

The original auth-only release did not change SQL or forecasts. The later
database provider reads the verified published archive through RLS and stores
personal records per Auth UUID. The first account does not automatically become
an administrator; personas still do not grant privileges.

## Configuration

- `VITE_SUPABASE_URL`: `https://dihchjflzhcekywarhxd.supabase.co` for this project.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's `sb_publishable_...` browser key.
- `.env.example` contains placeholders only. Local `.env.*` files are ignored.
- Never use `service_role`, a privileged JWT, `sb_secret`, or a database password.
- Vite embeds these public variables at build time. Changing Vercel variables
  requires a new build; existing deployments are unchanged.
- Missing values deny entry. Invalid/privileged keys fail the build before
  they can be embedded. No demo fallback exists.
- `vercel.json` allows only the exact HTTPS project origin in `connect-src`,
  alongside `'self'`. Other CSP directives remain unchanged. No WebSocket or
  wildcard origin is added. No additional application CSP was found.

## Ownership And Security

- `src/authConfig.ts` validates the browser configuration.
- `src/supabase.ts` shares one lazy client promise; `src/supabaseClient.ts`
  initializes the SDK with persisted sessions and automatic token refresh.
- `src/useAuth.ts` owns checking, signed-out, signed-in and unavailable states.
  Newer auth events invalidate pending restoration. Logout invalidates older
  async results and late session events; a deliberate new login reopens it.
  Subscriptions are cleaned up on unmount/retry, including React StrictMode.
- `src/App.tsx` owns the login form and internal-only `next` return paths,
  preserving query/hash through the login-page reload and subsequent navigation.
- `src/auth.ts` maps safe errors and display names, and removes only the retired
  `korat-tan-phai-login-user` key. No other local preferences are cleared.
- The SDK owns auth token storage. Application code does not serialize tokens,
  log passwords, or install a production test-account bypass.
- `AccountControl` displays the Supabase name/email. `user_metadata` is used
  only for display. The persona menu is a display context, not authorization.
- On SDK logout failure, the UI distinguishes an intact session from one the
  SDK has already removed locally. It never claims the server confirmed logout
  when it did not. Access tokens already issued can remain valid until expiry.
- Auth guards protect the UI journey, not downloadable static JSON/GeoJSON or
  the public read-only risk-fusion API. Future privileged data/actions still
  require server-side authorization and independently verified RLS.
- If browser storage is blocked, the SDK can use an in-memory session. Refresh
  may require login again. Display/workflow preferences have their existing
  separate document-lifetime fallback.

## Local Verification

`tests/fixtures/supabase.mjs` is test-only. Playwright intercepts the fake host
and blocks all other Supabase hosts. The fixture is never imported by `src/`
or included in the app as a fallback. E2E rejects non-localhost target URLs.
The fake key below is not a real Supabase credential.

```bash
npm test
VITE_SUPABASE_URL=https://ktp-auth-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only BUILD_OUT_DIR=tmp-snapshots/supabase-auth-build npm run build:protected
BUILD_OUT_DIR=tmp-snapshots/supabase-auth-build npm run test:e2e:built -- --output=tmp-snapshots/supabase-auth-e2e
```

The quality CI job uses those same fake build values and network interception.
That build is test evidence only and must not be deployed. A Vercel Preview
must use its actual configured project values. `measure:load` also uses a
mocked SDK session on localhost; it does not measure real Supabase latency.

The protected-build exposure check remains enabled. The named lazy SDK chunk
has a 105,000-byte gzip cap; application gzip retains its 370,000-byte cap,
initial static imports retain 125,000 bytes, and total JS retains 3.5 MB raw.
The SDK is loaded during session checking, so initial-static-import size alone
does not represent total login-ready network cost.

## Preview Manual Checklist

Local verification on 2026-09-05: 94 unit tests passed; protected mock build
passed exposure and bundle checks; built desktop/mobile E2E passed 66 tests
with 6 pre-existing skips. Login, wrong password, network failure, SDK refresh,
deep-link restoration, logout failure and legacy-key rejection were exercised
with network mocks. The negative build-config check rejected a secret-style key.
After the final return-URL fix, the 18 auth/reliability E2E tests passed again
against `tmp-snapshots/supabase-auth-final`. The complete suite was not repeated
for concurrent chart changes outside this auth task.
The missing-env protected build also passed and denied entry without loading
the dashboard or making an auth request. These results do not constitute a
real-account or hosted CSP smoke test.

After a separately authorized Preview deployment, use an incognito window and
the admin-provisioned account. Do not send passwords through chat or commit them.

1. Open `/dan-khun-thot/t-300806?target=2025-12&horizon=4#forecast` while signed out.
   Expect `/login?next=...`, no protected content, and email/password fields.
2. Log in with the real account. Expect the requested subdistrict, target,
   horizon and hash, plus the correct account name/email in the account menu.
3. Refresh the subdistrict page. Expect session and route to remain intact.
   Also navigate to `/`, `/drought` and `/dan-khun-thot` and back.
4. Sign out. Expect `/login`, no previous account/workspace content and no
   automatic login on refresh or Back. Other saved UI preferences may remain.
5. Try a wrong password. Expect `อีเมลหรือรหัสผ่านไม่ถูกต้อง`, no account
   enumeration details and no protected content. A network failure should
   instead report a connection problem; double submit must be prevented.
6. Verify the exact Supabase auth origin is not blocked by CSP, without
   recording password/request payloads, token responses or reusable sessions.
7. Have the project administrator independently verify Email provider settings,
   signup disabled, the confirmed account, required Vercel variables, and RLS
   before treating future database access as secured.

`npm run smoke` now requires securely supplied `SMOKE_AUTH_EMAIL` and
`SMOKE_AUTH_PASSWORD`. The matching GitHub secrets are not provisioned here;
without them deployment smoke fails closed. Do not use the fake E2E account
against Preview/Production. See [Production Smoke](PRODUCTION_SMOKE.md).

## Not Implemented

There is no Google login, signup, forgot-password UI or password-recovery flow.
Custom SMTP is still reported unconfigured. Configure a verified mail sender
and recovery redirect policy, then implement and test recovery separately
before promising email-based account recovery. Email/password login for a
confirmed account does not itself require a password-recovery email.

SDK references: [password login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
and [logout scope](https://supabase.com/docs/reference/javascript/auth-signout).
