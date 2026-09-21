# Korat Tan Phai iOS Development

## Scope

An isolated Expo / React Native / TypeScript development app for Nakhon
Ratchasima. The app uses native forecast, analysis and saved-workspace screens,
not a WebView or a compressed desktop layout. Shared web domain modules remain
the authority for forecasting, scope, aggregation, comparison and Excel output.

The web product remains forecast-only. Actual Archive is not part of this
mobile setup. No web routes, database migrations or production deployments
are changed by this app. Local device builds use an owner-authorized Apple
Development signing team; TestFlight/App Store distribution is not configured.

## Toolchain

Run app commands from `apps/mobile` with Node **24.21.0** (see `.nvmrc`).
The package has an engine guard; the machine's default Node may differ.
Activate Node 24 with your existing version manager before running npm.
Do not change global Node or shell configuration just for this app.

- npm with the app's `package-lock.json`; use `npm ci` for a fresh checkout.
- Expo SDK 57.0.24, React Native 0.86.3, React 19.2.3.
- `expo-dev-client` 57.0.19 and safe-area context 5.7.0.
- `expo-build-properties` 57.0.21 with scene lifecycle enabled.
- Local setup checked on Apple Silicon, macOS 26.6.2, Xcode 27.0 (27A266a),
  CocoaPods 1.16.2, and an iPhone 17 simulator running iOS 27.0.
- Development identity: `th.korattanphai.development`.
- Development URL scheme: `korattanphai-dev`.
- iPhone portrait only at this stage; iPad and Android are not verified.

Xcode 27 displays simulators through **Device Hub**, not `Simulator.app`.
Use Xcode > Open Developer Tool > Device Hub, or the app bundled at
`/Applications/Xcode.app/Contents/Applications/DeviceHub.app` for this install.
See [Apple's Device Hub documentation](https://developer.apple.com/documentation/xcode/device-hub).

## Source Ownership

`App.tsx`, `app.json`, assets, package dependencies and future config plugins
are the maintained inputs. `ios/` is generated Expo CNG output, ignored in Git.
Do not make durable changes directly in its Xcode project or Podfile.
Build outputs, screenshots, logs and Metro state are also ignored.

`expo-build-properties` enables `ios.enableSceneSupport` in `app.json`.
This is required for the SDK 57 app to launch on iOS 27 when built with Xcode
27. Without it the native build succeeds but UIKit terminates the app at
launch. Keep this maintained config input; do not patch the generated
AppDelegate as a workaround. See [Expo's scene lifecycle guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md).

The mobile lockfile is separate from the web lockfile. Do not install mobile
packages into the repository root. Supabase uses the existing project's public
URL and publishable key, with owner-scoped authenticated reads. Auth sessions
are chunked into SecureStore/Keychain; forecast caches are memory-only.

Configure `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in ignored `.env.local`.
`node scripts/configure-public-env.mjs` can initialize this file from the root's
local production environment. It copies only these two public values and will
not overwrite an existing file. Never bundle service-role keys or test passwords.
Restart Metro after changing environment/configuration.

See [native parity and verification](NATIVE_PARITY.md) for current functionality
and remaining work. This app does not expose Actual / Archive navigation.

When implementing forecasts, reuse verified domain logic and data contracts
where they are platform-independent. Web DOM components cannot be imported
directly into native views. Keep the existing brand and equivalent interactions,
and share native components when actual repeated consumers exist.

## Corporate Identity

The native app follows the same CI as the web product. See
[`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md). The source of truth is
the current Korat web UI, not the legacy Kaset artwork.

- `src/theme.ts` owns native semantic colors and font roles, matching
  `src/styles.css` and `index.html`. Do not hardcode a separate native palette.
- `assets/korat-tan-phai-emblem.png` is byte-identical to the web emblem.
- Use [Google Sans](https://fonts.google.com/specimen/Google+Sans) for Thai and
  English. `@expo-google-fonts/google-sans` 0.4.2 supplies static 400/600/700
  faces; only those used by the shell are bundled. Font licenses remain in
  that package (`LICENSE_FONT` and `LICENSE`). Preserve them in distribution.
- `expo-font` loads these local assets before showing the shell. In a
  packaged app this does not require reaching Google; development assets are
  served by Metro. On font-load failure, the shell remains readable using
  system fonts and emits a diagnostic warning rather than staying blank.
- Keep iOS text scaling enabled, with scrollable content and safe-area insets.
  Same CI does not mean identical desktop dimensions or DOM components.

`npm run test:brand` verifies the web/native token roles, font family and
weights, and the logo hash. Run it with Node 24 and the **repository root
dependencies installed**, because it reuses the web's PostCSS parser.
This is a source contract check, not proof of all future native/web behavior.

## Daily Development

```sh
node --version
npm ci
npm run typecheck
npm run check:dependencies
npm start
```

On this Mac, if the default Node is still 26, a command-scoped alternative
was verified without changing the global runtime:

```sh
npx --yes --package=node@24.21.0 --call 'npm run typecheck'
npx --yes --package=node@24.21.0 --call 'npm start'
```

`npm start` serves the development client on localhost, port 8081, with two
Metro workers. This is for the Simulator on this Mac, not a physical phone.
`REACT_NATIVE_PACKAGER_HOSTNAME=localhost` keeps manifest, assets and bundle
URLs consistent with Metro's loopback listener (which can be IPv6 on macOS).
This local transport setting is not a backend credential.
It does not install an app. With a native build installed, open it from
Device Hub or press `i` in the Expo terminal. The CLI prints the current
development-client URL. Preserve other services; select another port if 8081
is already in use.

JS/TS edits use Fast Refresh. Restart Metro after bundler/environment changes.
Native packages, config plugins, app icon, permissions and native settings
require rebuilding and installing the native client.

## First Native Build

Inspect `npx expo prebuild --help` after SDK upgrades. The installed SDK 57
CLI supports `--no-clean`, which preserves and layers native output.
Do not use clean regeneration on existing native folders without approval.

```sh
npm run prebuild:ios
npm run ios -- --device
```

Select the intended Simulator in the CLI. The run command handles Pods,
build, installation and bundler startup. If a matching Metro is already
running, use `--no-bundler` to avoid starting another instance.

For a resource-constrained Mac, the verified explicit path uses **one build
at a time** and two compiler jobs. First run `pod install` in `ios/` with
Node 24 on PATH, then return to the app root. No `pod update` is required.

```sh
xcrun simctl list devices available
xcodebuild -list -workspace ios/KoratTanPhaiDev.xcworkspace
```

Set `IOS_SIMULATOR_ID` in the current terminal to the selected simulator's
current ID from that list. Do not reuse another machine's identifier.

```sh
mkdir -p artifacts
xcodebuild -workspace ios/KoratTanPhaiDev.xcworkspace \
  -scheme KoratTanPhaiDev -configuration Debug \
  -destination "platform=iOS Simulator,id=$IOS_SIMULATOR_ID" \
  -derivedDataPath build -jobs 2 build \
  > artifacts/ios-debug-build.log 2>&1
```

Check the build's exit code before installing. Boot the selected simulator in
Device Hub, then:

```sh
xcrun simctl install "$IOS_SIMULATOR_ID" \
  build/Build/Products/Debug-iphonesimulator/KoratTanPhaiDev.app
xcrun simctl launch "$IOS_SIMULATOR_ID" th.korattanphai.development
```

Start Metro and use its printed URL if the dev launcher opens instead of the
app. Node's path is captured in generated `ios/.xcode.env.local` during Pods
installation; if that local executable disappears, reactivate Node 24 and run
Pods installation again. Do not commit machine-specific Node paths.

## Checks And Evidence

```sh
npm run typecheck
npm run test:domain
npm run test:brand
npm run check:dependencies
npm run export:ios
npm audit
```

Typecheck and export do not prove native installation or data parity.
Native build logs belong in `artifacts/ios-debug-build.log`; generated JS
exports are in `dist/`. Simulator screenshots belong in `artifacts/`.

### Initial Setup Checkpoint: 2026-09-21

This historical shell-only checkpoint is superseded by the feature verification
in [NATIVE_PARITY.md](NATIVE_PARITY.md). The current app connects to Supabase
and implements the native forecast workflow. A local physical-device build
was subsequently installed; see the separate device checkpoint there.

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Web/native CI source parity | Passed: colors/radius, font family/weights, emblem hash |
| Expo dependency compatibility | Passed |
| iOS production JS export | Passed; this is not an App Store binary |
| Metro development manifest and bundle | Passed on localhost:8081 |
| iOS Debug native build | Passed after enabling scene support |
| Simulator installation | Passed |
| Native dev launcher | Launched without the earlier scene-lifecycle crash |
| Branded React Native screen | Rendered with Google Sans, Korat emblem, Thai copy and safe areas on iPhone 17 / iOS 27 |
| Resume from Simulator Home | Passed; returned to the branded screen |
| Cold process launch | Passed; shell rendered after closing the dev-client onboarding overlay |
| Physical iPhone, backend, TestFlight | Not tested / not connected |

The final scene-enabled build log is `artifacts/ios-scene-build.log`.
`artifacts/ios-brand-google-sans.png` records the actual React Native shell,
not the Expo launcher. Forecast, authentication and navigation were not yet
implemented at that checkpoint, so it is not evidence of feature parity.
The existing native binary already contains ExpoFont 57.0.4; the font update
uses runtime-loaded local assets and does not require another native build.

Dependency audit on 2026-09-20 reports 10 moderate findings propagated from
the `uuid` dependency of Expo's `xcode` build tooling (GHSA-w5hq-g745-h8pq).
There are no high/critical findings in that audit. The suggested forced fix
downgrades Expo to SDK 46 and is not compatible with this app. Do not run
`npm audit fix --force`. Reassess upstream resolution before distribution;
this is not a claim that the app is security-certified.

## Pending Distribution Work

- Complete the remaining verification and feature gaps in `NATIVE_PARITY.md`.
- Local Apple Development signing, installation and launch passed on an
  iPhone 13 / iOS 26.6.2 on 2026-09-21. The installed icon and native login
  screen were verified from the device. Interactive physical-device feature
  QA remains pending; Simulator results do not substitute for it.
- TestFlight/App Store distribution is a separate, not-yet-authorized workflow.

## Local Physical iPhone Build

For direct installation on an authorized connected iPhone, use a Release
configuration with **Apple Development** signing. This embeds JavaScript and
assets and does not require Metro on the phone's network. It is a local test
installation, not an App Store submission. Supabase reads still require internet.

Discover the current device with `xcrun devicectl list devices`. Confirm the
Apple account/team with the owner; do not assume a certificate's parenthesized
identifier is its team ID. Keep device/team IDs in terminal variables, not this
repository. The generated Xcode project remains disposable CNG output.

With Node 24 on PATH, set `IOS_DEVICE_ID` and `IOS_TEAM_ID` in the current shell:

```sh
EXTRA_PACKAGER_ARGS='--max-workers 2' xcodebuild \
  -workspace ios/KoratTanPhaiDev.xcworkspace -scheme KoratTanPhaiDev \
  -configuration Release -destination "platform=iOS,id=$IOS_DEVICE_ID" \
  -derivedDataPath build -jobs 2 \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$IOS_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY='Apple Development' build \
  > artifacts/ios-device-release-build.log 2>&1
```

Do not proceed unless the build exits successfully. Inspect the embedded
profile's expiry; the signing certificate expiry is not the app's install
lifetime. After unlocking the iPhone and completing any owner-only OS trust
prompts, install without uninstalling or erasing existing app data:

```sh
xcrun devicectl device install app --device "$IOS_DEVICE_ID" \
  build/Build/Products/Release-iphoneos/KoratTanPhaiDev.app
xcrun devicectl device process launch --device "$IOS_DEVICE_ID" \
  th.korattanphai.development
```

Verify the installed Korat icon, native sign-in, safe areas and live scoped
forecast data on the physical device. Simulator screenshots do not satisfy
physical-device evidence. Keep logs and screenshots in ignored `artifacts/`.
