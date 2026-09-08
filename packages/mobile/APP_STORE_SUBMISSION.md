# iOS App Store Submission Guide

`packages/mobile` is the Capacitor shell that wraps the production Chartsuno
web app for the App Store. This guide covers generating the native project,
the owner-side account steps, and the archive/upload flow. The pattern is the
same one SuppStack AI shipped with (remote-URL Capacitor shell + native
plugin bridge).

## How the app is built

- Since 2026-09-07 the web app is **bundled** into the binary
  (`webDir: ../web/dist`). The app opens from local files, so cold start no
  longer waits on the network and the splash hides only after the first paint.
  Shipping web changes to installed apps now requires a new build
  (`pnpm mobile:ios:sync` then archive) until an OTA update service is added.
- API calls go to `https://chartsuno.com` (Vercel proxies `/api` and `/auth`
  to Railway). The bundled origin is `capacitor://localhost`, which the API
  allows in CORS; the session is a bearer JWT returned by
  `POST /api/auth/native/exchange` with `deliver: "token"` and stored in the
  Keychain by `SecureStorePlugin.swift`. Google login uses the native
  authentication handoff below.
- The mobile experience itself lives in `packages/web`: the Instagram-style
  posts feed (double-tap like, save/share), first-launch onboarding, and the
  bottom tab bar activate on phone-width viewports, with
  `env(safe-area-inset-*)` padding for the notch and home indicator.
- There is no separate offline page any more; the bundled app renders and
  shows its own connection banner when requests fail.

## Generating the native project (on a Mac)

The `ios/` Xcode project is generated, not hand-written. On a machine with
Xcode installed:

```bash
pnpm install
cd packages/mobile
pnpm ios:add        # generates ios/ from the Capacitor template (one time)
pnpm ios:sync       # sync plugins + config into ios/
pnpm ios:open       # opens the generated iOS project in Xcode
```

For the app icon: export `assets/icon.svg` to a 1024x1024 `assets/icon.png`
(and optionally `assets/splash.png` at 2732x2732), then run
`pnpm ios:assets` to generate the iOS icon and splash sets.

## One-time setup (owner side)

1. **Apple Developer Program** — enroll at
   [developer.apple.com](https://developer.apple.com/programs/enroll/) ($99/yr).
2. **App Store Connect** — create the app record:
   - Bundle ID: `com.chartsuno.app` (register it under Certificates,
     Identifiers & Profiles first)
   - Name: Chartsuno (reserve early; names are unique per storefront)
   - Suggested category: Productivity. Secondary: Graphics & Design.
3. **Google OAuth in the shell** — build `2026.9.7` and the deployed native audit changes add a custom
   `NativeAuth` bridge using `ASWebAuthenticationSession`. The system sheet
   returns a short-lived PKCE-bound code via `com.chartsuno.app://auth-callback`;
   the existing WKWebView exchanges it for its own HttpOnly session cookie.
   This requires the updated API, web app, and a new iOS binary. Build
   `2026.9.6` does **not** include the fix. Real Google sign-in is still pending
   device verification; compilation and mocked-provider API tests are not a
   substitute for that check.
4. **Equivalent private login** — only Google login exists. Implement Sign in
   with Apple or another qualifying equivalent before public submission, unless
   an applicable exception in guideline 4.8 is established.
5. **Account and community controls** — self-service account deletion and
   public-feed report/block flows are missing. Billing still redirects to web
   checkout. See the [native audit](../../docs/native-mobile-audit-2026-09-06.md)
   for the release gates and device test matrix.

## Archive and upload

Always run `pnpm mobile:ios:sync` (from the repo root) before archiving. It
rebuilds `packages/web/dist` and copies it into `ios/App/App/public`, which is
gitignored, so a checkout without that step archives an empty web bundle.

Latest beta: Chartsuno 1.0 build `2026.9.7` is available to the **Internal
Testers** group in TestFlight as of September 6, 2026. Apple reports the build
as `VALID` and `IN_BETA_TESTING`; the account holder has been invited.

- App Store Connect app ID: `6807256509`
- Apple team: `VRTT45LLND`
- CLI profile on this Mac: `Personal` (existing App Manager team key in Keychain)
- Build ID: `6c5a214d-a36f-4c53-b244-be3fa55cac54`
- Internal group ID: `488b4d86-cdb9-4a18-a649-a5b3dcb5b213`

Use `asc --profile Personal` explicitly for this app. The profile also covers
SixAM and SuppStack AI. External/public TestFlight distribution has not been
submitted for beta review.

In Xcode:

1. Select the `App` target > Signing & Capabilities > choose your team.
   Automatic signing; bundle ID `com.chartsuno.app`.
2. Set Version (e.g. `1.0`) and a new, monotonically increasing Build number
   on the General tab. A date-based value such as `2026.9.1` avoids collisions.
3. Product > Archive, then Distribute App > App Store Connect > Upload.
4. In App Store Connect, attach the build to the 1.0 version, fill in the
   listing, and submit for review. Use TestFlight first to smoke-test on a
   real device (feed scroll, double-tap like, share sheet, sign-in flow).

## Listing checklist

| Item | Value |
| --- | --- |
| Privacy policy URL | `https://chartsuno.com/privacy` (page ships in this repo) |
| Support URL | `https://chartsuno.com` |
| App Privacy (data collection) | Verify against actual AI, analytics, billing, and hosting providers before submission; account info and user content are collected |
| Age rating | Complete the questionnaire based on the public feed and moderation controls; do not assume a rating |
| Export compliance | Set `ITSAppUsesNonExemptEncryption=false` in Info.plist |
| Screenshots | 6.9" (iPhone 16 Pro Max) and 6.5" (iPhone 11 Pro Max); capture onboarding, the feed, chart view, and chart builder |

## Native experience and review readiness

The app remains a Capacitor hybrid. The audit adds native authentication,
link/file share sheets, haptics, and app-specific navigation, and these changes
are deployed for internal TestFlight build `2026.9.7`. Live Google completion
and share destination checks remain pending. An app-like layout alone does
not demonstrate compliance with Apple's minimum-functionality requirement.

The [September 6 audit](../../docs/native-mobile-audit-2026-09-06.md) records the
implemented changes, unresolved release blockers, checks, and unverified device
flows. Complete that checklist before submitting a public release. Review
[Apple's current guidelines](https://developer.apple.com/app-store/review/guidelines/)
for login services, account deletion, community moderation, and the selected
billing model/storefronts.

## Updating the app after release

Web changes deploy through Vercel as usual and appear in the installed app
immediately. A new App Store build is only needed when the native shell
changes: plugin additions, icon/splash updates, config changes, or OS
compatibility updates. Bump the Build number for every upload.
