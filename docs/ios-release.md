# Ship Chartsuno to the iOS App Store

This is the path from this repo to an App Store build. The native project is
already in the repo. You archive and upload it from a Mac with Xcode. This
environment cannot sign or upload the binary.

The iOS app is the existing React app bundled into a Capacitor shell
(`packages/mobile`). It is not a second UI. API calls go to
`https://www.chartsuno.com`, the canonical host (`chartsuno.com` redirects
there). That host is the same Vercel proxy the website uses.
The website, Vercel, and Railway deploys stay as they are.

## Bundle id

The committed bundle id is **`com.chartsuno.app`**. That is the id already
used by the TestFlight app (App Store Connect app `6807256509`, team
`VRTT45LLND`). Treat it as the id to ship unless you intentionally want a
new App Store record.

To use a different id, change every one of these before archiving:

- `packages/mobile/capacitor.config.ts` (`appId`)
- `PRODUCT_BUNDLE_IDENTIFIER` in `packages/mobile/ios/App/App.xcodeproj/project.pbxproj` (Debug and Release)
- The URL scheme in `packages/mobile/ios/App/App/Info.plist` (`com.chartsuno.app`)
- The callback scheme in `packages/mobile/ios/App/App/NativeAuthPlugin.swift`
- The callback check in `packages/web/src/services/native.ts` (`com.chartsuno.app:`)
- `APPLE_BUNDLE_ID` on the Railway API, if you set it. The default is `com.chartsuno.app`.

Then run `pnpm mobile:ios:sync` again. Register the new id under
Certificates, Identifiers & Profiles, and create a new app in App Store
Connect. Sign in with Apple must be enabled on that App ID.

`DEVELOPMENT_TEAM` in the Xcode project is `VRTT45LLND`. Confirm that is
still the team on the Apple ID you will sign with. Automatic signing fills
in a different team if you pick one in Xcode.

## What the binary already includes

- Bundled web app (`webDir` is `packages/web/dist`). Cold start does not
  wait on the network. A web deploy does **not** update installed apps.
  Ship UI changes with a new build.
- Phone layout: bottom tabs, safe areas, 44px targets, no marketing footer.
- Google sign-in in an `ASWebAuthenticationSession` sheet. The webview stays
  on the chart. The session is a bearer token in the iOS Keychain, because
  `capacitor://localhost` cannot use the website's cookie.
- Sign in with Apple (`AuthenticationServices`), verified by
  `POST /api/auth/apple`. No Apple private key is required for this native
  flow. The token audience is the bundle id.
- Account deletion in Settings → Account. It removes the profile, charts,
  and personal team. A shared team you own is transferred to another member.
- Report and Block on public feed charts. Reported charts disappear for the
  reporter immediately.
- Offline banner with Try again. Source links open in the in-app browser
  sheet instead of sending the webview to Safari.
- App icon and launch screen generated with `pnpm brand:generate` from
  `packages/web/public/brand-mark.svg`: a chart-shaped C, blue ground on the
  standard icon and dark ground on dark/tinted icons. Launch storyboard uses `LaunchBackground` (white in
  light mode, `#101014` in dark) and `LaunchMark`.
- `PrivacyInfo.xcprivacy`, camera / photo-library usage strings, and
  `ITSAppUsesNonExemptEncryption = false`.
- No purchase buttons. Billing stays on the website. See the decision below.

## Before you archive

On a Mac, from the repo root:

```bash
pnpm install
pnpm mobile:ios:sync
```

`pnpm mobile:ios:sync` rebuilds `@chartsuno/shared` and `@chartsuno/web`,
then runs `cap sync ios`. That copies `packages/web/dist` into
`packages/mobile/ios/App/App/public`. That folder is gitignored. An archive
made without this step ships an empty web bundle.

Open the project:

```bash
pnpm mobile:ios:open
```

Or open `packages/mobile/ios/App/App.xcodeproj` in Xcode. This project uses
Swift Package Manager, not CocoaPods.

## Xcode: sign, version, archive, upload

1. Select the **App** target → **Signing & Capabilities**.
2. Check **Automatically manage signing**. Choose your team. Bundle id
   `com.chartsuno.app`.
3. Confirm the **Sign in with Apple** capability is listed. The entitlement
   file is `App/App.entitlements`. If Xcode offers to register the
   capability on the App ID, accept. The Apple Developer account that owns
   the App ID has to allow it. No Services ID, key, or callback URL is
   required for this native flow.
4. **General** tab:
   - Version (`MARKETING_VERSION`): `1.0` until you ship a user-visible
     version bump.
   - Build (`CURRENT_PROJECT_VERSION`): must increase on every upload.
     The project is set to `2026.10.21`. Apple rejects a reused build
     number. `2026.10.20` was already uploaded.
5. Select a generic **Any iOS Device (arm64)** destination. Not a simulator.
6. **Product → Archive**. Wait for the Organizer window.
7. **Distribute App → App Store Connect → Upload**.
8. Leave bitcode off (Xcode no longer offers it). Symbol upload can stay on.
9. When the build finishes processing in App Store Connect, attach it to
   the version and submit. Use TestFlight on a phone before public review.

Export compliance is already answered in Info.plist
(`ITSAppUsesNonExemptEncryption = false`): the app only uses HTTPS.

## App Store listing checklist

| Item | What to enter |
| --- | --- |
| Name | Chartsuno |
| Subtitle | Suggested: Charts from your data |
| Primary category | Productivity. Secondary: Graphics & Design |
| Bundle ID | `com.chartsuno.app` |
| SKU | Any unique string, for example `chartsuno-ios` |
| Privacy policy URL | `https://chartsuno.com/privacy` |
| Support URL | `https://chartsuno.com` |
| Marketing URL | `https://chartsuno.com` (optional) |
| Support email | `support@chartsuno.com` |
| Copyright | WA LLC, or the legal name on the Apple account |
| Age rating | Complete the questionnaire. The public feed has user-generated charts and report/block controls. Do not guess a rating. |
| Price | Free. There is no in-app purchase in this binary. |
| Encryption | Exempt. Already set in Info.plist. |
| Sign-in information | See review notes. Set `REVIEW_LOGIN_EMAIL` and `REVIEW_LOGIN_PASSWORD` on Railway, then paste those values into the notes. Unset both after approval. |

### Screenshots

Capture on a simulator or device **after** `pnpm mobile:ios:sync`, so the
shots show this build. Suggested frames: onboarding (or the first feed),
the feed, a chart, and the chart builder. No browser chrome.

The app supports iPhone and iPad, so both are required. Confirm the pixel
sizes against [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)
the day you upload. As of this writing, upload at least:

| Device | Accepted portrait sizes |
| --- | --- |
| iPhone 6.9" (required) | 1320 × 2868, 1290 × 2796, or 1260 × 2736 |
| iPhone 6.5" | 1284 × 2778 or 1242 × 2688 |
| iPad 13" | 2064 × 2752 |
| iPad 12.9" | 2048 × 2732 |

Provide 3 or more screenshots per required size. Landscape is optional.

### App Privacy (nutrition labels)

Answer these in App Store Connect → App Privacy. They match
`PrivacyInfo.xcprivacy` and the code. The app does **not** track users
across other companies' apps, and it has no analytics SDK.

| Data type | Linked to the user | Used for tracking | Purpose |
| --- | --- | --- | --- |
| Email address | Yes | No | App functionality |
| Name | Yes | No | App functionality |
| User ID | Yes | No | App functionality |
| Photos or videos | Yes | No | App functionality. Only when the user picks or takes a photo to import. The image is sent to the AI provider to extract chart data. |
| Other user content | Yes | No | App functionality. Charts, prompts, and imported table data. AI features send that content to the model provider. |
| Other diagnostic data | No | No | App functionality. Railway and Vercel keep standard request logs (IP address, time) to operate the API. If you do not want to declare host logs, omit this row and say so in the review notes. |

Do not declare purchases, precise location, contacts, browsing history, or
crash data. None of those are collected by the app.

### Review notes

Paste this into App Review Information and edit the contact line:

```text
Chartsuno is a chart builder. The iOS app bundles the same product as
https://www.chartsuno.com and adds native sign-in, share sheet export, and
Keychain session storage.

A demo account is enabled for this review. On the sign-in sheet, tap
Reviewer sign-in and enter:

Email: PASTE REVIEW_LOGIN_EMAIL
Password: PASTE REVIEW_LOGIN_PASSWORD

That account can create and save charts. Settings → Account → Delete
account works for it, and also for an Apple or Google account. Sign in
with Apple and Continue with Google are on the same sheet. Google opens
Apple's authentication sheet and returns to the same screen.

The feed, including Report and Block, works without an account. Saving
a chart requires sign-in.

There are no in-app purchases. Plans are managed on the website and this
build does not link to checkout. A plan already bought on the website is
recognized when the same account signs in.

Public charts can be reported from the ••• menu on a feed card. Reports
are hidden for that user immediately. We review the moderation inbox
within 24 hours (see the operator note in the repo's docs/ios-release.md).

A screen recording from a physical iPhone is attached, showing Reviewer
sign-in, creating and saving a chart, and Settings → Account → Delete
account.

Contact: support@chartsuno.com
```

Do not commit the password. Paste the Railway values over the `PASTE`
lines in App Store Connect only. The Reviewer sign-in control is absent
unless both `REVIEW_LOGIN_EMAIL` and `REVIEW_LOGIN_PASSWORD` are set on
the Railway API. Unset them after approval and the control disappears
the next time the sign-in sheet opens. No new binary is required to turn
it off.

Use an email that is not already a Chartsuno account. The first successful
sign-in creates one demo user and a free personal team (10 charts a
month), so the reviewer can save charts. Deleting that user is allowed.
The next successful sign-in, while the variables are still set, creates
the user and team again.

Guideline 2.1 asked for a recording from a physical device because this
app has a limited review history. Record it on an iPhone, not the
simulator, and attach it in the Resolution Center reply. This repo cannot
record it. Sign in with Apple and a real Google account still need a
pass on that phone before you submit.

Deploy this API to Railway before reviewers open the build. The sheet
calls `GET /api/auth/review/status` and shows the form only when the
response is `{ "enabled": true }`.

## Operator notes you still have to do

These need your Apple account, Railway access, or a product decision.

1. **Sign in with Apple on the App ID.** Xcode will prompt. No `.p8` key
   is stored in the repo, and none is required for the native identity
   token. Web Sign in with Apple is not enabled. The website keeps Google
   sign-in only.
2. **Moderation inbox.** Reports are rows in `content_reports`. Nothing
   emails you. With the Railway `BOT_INTERNAL_API_TOKEN` value:

   ```bash
   curl -s -H "x-bot-token: $BOT_INTERNAL_API_TOKEN" \
     https://chartsuno.com/api/moderation/reports
   curl -s -X POST -H "x-bot-token: $BOT_INTERNAL_API_TOKEN" \
     https://chartsuno.com/api/moderation/reports/REPORT_ID/hide
   ```

   `hide` removes that chart from the public feed. Guideline 1.2 expects
   a report to be acted on within 24 hours. Check this inbox on that
   cadence, or wire it to something you already watch.
3. **Billing.** This build does not use StoreKit and does not link to
   Polar checkout. Free accounts work. Paid branding and seat limits still
   apply when someone signs in with an account that already paid on the
   website. If App Review rejects that under guideline 3.1, the follow-up
   is either StoreKit for the plans, or keeping the iOS app on the free
   tier only. That choice is yours. Do not add a "subscribe on the web"
   button to get around it.
4. **Deploy the API before the app.** Sign in with Apple, account
   deletion, report/block, and reviewer sign-in call Railway routes. The
   website deploy can ship on its own schedule. Existing Google sign-in and
   cookie sessions on chartsuno.com are unchanged. The native origin
   `capacitor://localhost` is already allowed by CORS, and the app sends
   `Authorization: Bearer` rather than a cookie.
5. **Startup schema change.** On boot the API adds `users.apple_id` and,
   on PostgreSQL, makes `users.google_id` nullable. Confirm the Railway
   logs show a healthy startup after that deploy. An old local SQLite file
   with `google_id NOT NULL` will not accept Apple-only accounts; delete
   that file or use Postgres.
6. **Device pass before public review.** Fresh install, Reviewer sign-in,
   Sign in with Apple, Google sign-in from a half-finished chart,
   force-quit and reopen while signed in, delete account, report a feed
   chart, export PNG, deny camera access, airplane mode. The September
   2026 audit's device matrix is in
   `docs/native-mobile-audit-2026-09-06.md`.
7. **Reviewer sign-in.** On Railway, set both `REVIEW_LOGIN_EMAIL` and
   `REVIEW_LOGIN_PASSWORD` before you resubmit, then unset both when the
   review is finished. The password is not stored. Login is rate-limited
   and the comparison does not return early on a wrong email. Pick a long
   random password and an email you do not use for Google or Apple
   sign-in. If that email already belongs to an account, sign-in is
   refused rather than entering that account.

## How the native app talks to Railway

| | Website | iOS app |
| --- | --- | --- |
| Origin | `https://chartsuno.com` | `capacitor://localhost` |
| API base | same origin (`/api`, `/auth` rewritten by Vercel) | `https://www.chartsuno.com` |
| Session | HttpOnly cookie | Bearer JWT in the Keychain |
| CORS | first-party, no preflight against itself | API allows `capacitor://localhost` and `ionic://localhost` with credentials and `Authorization` |

Vercel (`vercel.json`) proxies `/api` and `/auth` to
`https://api-production-af19.up.railway.app`. The iOS app uses that proxy
on purpose so cookies, redirects, and CORS stay on one public host. Do not
point the committed Capacitor config at a `server.url`. A local dev server
is `CAP_SERVER_URL` only, and only on your machine.

## After release

Web and API deploys do not change the installed app. For a native change
(plugin, icon, permission string, bundle id, or a web UI fix you want in
the App Store build):

```bash
pnpm mobile:ios:sync
```

Bump the build number, archive, and upload again.

## Device regression checks

Use a newly bundled build after web edits. The 20 October audit remediation adds
Revyl tests under `packages/mobile/.revyl/tests`; supply test credentials through
run variables and run only against a disposable API with synthetic data. The test
API must have no paid provider credentials or customer database connections.

Check first launch/onboarding and the logo, feed-to-chart navigation, test sign-in
and persisted Keychain session, paste/import, save/update/reset and new-document
behavior, keyboard-safe controls, settings navigation, and the native file share
sheet. Record the exact uploaded build ID and screenshots/report, not just a
successful upload. A simulator build does not validate real-device Google/Apple
OAuth, paid billing, or App Store signing.

For simulator builds, keep signing enabled (`CODE_SIGN_IDENTITY=-
CODE_SIGNING_ALLOWED=YES`). Xcode embeds simulated entitlements for Keychain.
An unsigned build can launch and render while secure session writes fail, so
launch-only evidence is insufficient. Keep the release entitlements intact.
