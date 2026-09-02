# iOS App Store Submission Guide

`packages/mobile` is the Capacitor shell that wraps the production Chartsuno
web app for the App Store. This guide covers generating the native project,
the owner-side account steps, and the archive/upload flow. The pattern is the
same one SuppStack AI shipped with (remote-URL Capacitor shell + native
plugin bridge).

## How the app is built

- `capacitor.config.ts` points the native WKWebView at
  `https://chartsuno.com`. The SPA is served remotely, so shipping web
  updates does **not** require an App Store release.
- Vercel rewrites proxy `/api` and `/auth` to the Railway backend on the same
  origin, so the existing cookie-based auth works unchanged inside the
  webview.
- The mobile experience itself lives in `packages/web`: the Instagram-style
  posts feed (double-tap like, save/share), first-launch onboarding, and the
  bottom tab bar activate on phone-width viewports, with
  `env(safe-area-inset-*)` padding for the notch and home indicator.
- `shell/index.html` is only an offline fallback page.

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
3. **Google OAuth in the shell** — Google blocks OAuth inside webviews, so
   the in-webview redirect flow used on desktop will fail with
   `disallowed_useragent`. Before submission, bridge sign-in through the
   `@capacitor/browser` plugin (SFSafariViewController) and return via a
   `com.chartsuno.app://auth-callback` deep link registered in
   `ios/App/App/Info.plist`. Until that lands, TestFlight builds can be
   smoke-tested with an already-authenticated session or Sign in with Apple.
4. **Sign in with Apple** — because the app offers Google sign-in, App
   Review requires Sign in with Apple (guideline 4.8) as an equivalent
   option. Plan this on the API before submission.

## Archive and upload

Latest beta: Chartsuno 1.0 build `2026.9.1` was uploaded successfully to App
Store Connect for TestFlight processing on September 1, 2026.

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
| App Privacy (data collection) | Contact info (email, name via Google sign-in), user content (charts, datasets), linked to identity, not used for tracking or advertising |
| Age rating | Answer the questionnaire honestly (no objectionable content) — expect 4+ |
| Export compliance | Set `ITSAppUsesNonExemptEncryption=false` in Info.plist |
| Screenshots | 6.9" (iPhone 16 Pro Max) and 6.5" (iPhone 11 Pro Max); capture onboarding, the feed, chart view, and chart builder |

## Review risk: Guideline 4.2 (Minimum Functionality)

Apple rejects apps that are plain website wrappers. Mitigations in place or
planned:

- Native share sheet via the web Share API (bridged by WKWebView) and the
  `@capacitor/share` plugin.
- App-style navigation: bottom tab bar, safe-area-aware layout, first-launch
  onboarding, double-tap gestures — the mobile experience is designed as an
  app, not a shrunk website.
- Splash screen, dark status-bar integration, offline fallback page.
- Strong next additions if a reviewer still flags 4.2: push notifications
  for likes/follows on published charts, a home-screen widget showing a
  pinned chart, and haptics on like (plugin already included).

Other guidelines worth knowing:

- **5.1.1 Account deletion** — apps with account creation must offer
  in-app account deletion. Verify a self-service delete path exists in
  Settings before submitting.
- **2.5.2 Remote content** — loading your own web content in WKWebView is
  allowed; no hidden features or code injection.
- **4.8 Sign in with Apple** — required when third-party (Google) login is
  offered.

## Updating the app after release

Web changes deploy through Vercel as usual and appear in the installed app
immediately. A new App Store build is only needed when the native shell
changes: plugin additions, icon/splash updates, config changes, or OS
compatibility updates. Bump the Build number for every upload.
