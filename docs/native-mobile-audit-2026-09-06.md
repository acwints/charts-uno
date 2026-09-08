# Chartsuno native mobile audit — September 6, 2026

Chartsuno's current TestFlight build is a remote website in a Capacitor shell.
The reported login escape is real at the code level: login navigated the
WKWebView to Google's website without a native authentication session or a
return-to-app cookie handoff. Installing the Browser plugin did not connect it
to the sign-in button.

**Status:** API and web fixes are deployed. Chartsuno `1.0 (2026.9.7)` is
`VALID` and `IN_BETA_TESTING`, assigned to Internal Testers. Build `2026.9.6`
does not have the new native bridges and should be updated. An independent
source review found five issues across the patch and its follow-up fixes; all
were addressed and re-reviewed. Native guest launch and corrected light-mode
status-bar contrast were visually confirmed. CUA simulator pointer actions fail
with `noWindowsAvailable`, so real Google completion, relaunch persistence, and
share destinations still need an actual device walkthrough. Those limitations
are included in What to Test notes; this is an internal candidate, not a public
App Store approval or complete native-experience sign-off.

## Implemented changes

### Authentication and account state

| Before | After |
| --- | --- |
| `AuthContext.tsx` navigated away for Google login. | Native login invokes `NativeAuthPlugin.swift` with Apple's `ASWebAuthenticationSession`; the existing app view stays mounted. Web login retains its existing flow. |
| No native callback receiver or plugin registration existed. | `SceneDelegate.swift` loads `ChartsunoViewController`; it registers the auth/export bridges. `Info.plist` registers `com.chartsuno.app`. Xcode includes both new Swift sources. |
| No handoff from the browser cookie jar to the WKWebView existed. | API native state is signed, expires in 10 minutes, and binds a random app nonce and S256 PKCE challenge. A hashed, two-minute, single-use database code is exchanged for a first-party HttpOnly cookie. The session token is never placed in the native callback URL. |
| Concurrent or repeated sign-in taps could start separate redirects. | A synchronous sign-in guard and disabled busy button prevent duplicate attempts. Native session cancellation returns quietly to the app. |
| Provider failures could leave an error page in the authentication sheet. | Provider HTTP/network failures return an error callback to the app; the sign-in modal shows a retryable error. Invalid/expired signed state is rejected before provider access. |
| OAuth target checking accepted URL prefixes, including lookalike hosts. | `_safe_frontend_target` checks exact scheme and host and rejects embedded credentials. Google user-info requests use a Bearer header; provider failures log status instead of raw bodies. |
| Every account-check failure cleared the user; native resume/reconnect did not recheck. | `ApiError` retains HTTP status. Only an explicit 401 clears the account during a check; transient failures preserve existing state. Native foreground/reconnect rechecks the session. |
| Failed sign-out silently navigated home. | Sign-out failure propagates to a visible toast and leaves the current page in place. |
| Sign-in errors were invisible and dialog focus was unmanaged. | Auth modal shows errors, busy state, keyboard focus containment/restoration, and privacy/terms links. Copy explains the native return behavior without promising it for the web flow. |
| Older shells would try unsupported native methods after a web update. | Feature detection gives an explicit TestFlight update message for missing auth/export bridges. This does not repair build `2026.9.6`; update to build `2026.9.7`. |

### Native navigation and layout

| Before | After |
| --- | --- |
| Native launch depended on web auth/marketing routing. | The native home route opens Feed. |
| Create showed a marketing hero, features, and sales CTA. | Native Create shows a compact task heading and inputs; promotional sections stay on the website. |
| Desktop sidebar/hamburger/header links and footer competed with mobile navigation. | Native shell uses bottom tabs, an Account tab, and a smaller header. Website navigation remains available outside the native app. |
| Detail pages depended on browser navigation. | Native Back has a Feed fallback; WKWebView back/forward gestures are enabled. Legal, invite, team, and dashboard details also expose Back. |
| Header did not reserve the notch; viewport/tab sizing was primarily responsive-web styling. | Native viewport is constrained, header respects safe insets, tabs reserve the home indicator, and the auth sheet has safe-area/max-height rules. |
| Small inputs could trigger iOS focus zoom; several primary controls were under 44px. | Native inputs use at least 16px text. Export/share, account, onboarding skip, close, and Back controls have 44px minimum targets. |
| Web route transitions ran inside the app. | Native route transitions are disabled. Tab taps and double-tap likes invoke native haptics. |
| No keyboard-specific tab behavior existed. | Visual viewport/focus listeners hide the tab bar when a keyboard is detected. This heuristic still needs device verification. |

### Sharing, import, and recovery

| Before | After |
| --- | --- |
| Feed relied on browser share/clipboard behavior. | Native feed links invoke Capacitor Share; cancellation keeps the feed in place and other failures show feedback. |
| Editor social sharing opened X/LinkedIn popups and told users to paste with desktop shortcuts. | Native editor has a Share image action backed by `UIActivityViewController`. Web social actions are preserved. |
| PNG/CSV export clicked browser download links. | Native exports create private temporary files and offer the iOS share sheet. Filename/type and size are bounded; files are removed after completion/cancellation. iPad popovers have an anchor. |
| Export UI said Download and exposed embed markup. | Native labels say Export / Save or share; embed code remains on the web. Export errors are visible. |
| Camera/photo-save purpose strings were missing. | `Info.plist` explains photo capture for import and photo-library addition for saving charts. Permission prompts, denial, and picker behavior remain unverified. |
| Like/save failures only logged to the console; a delayed tap could navigate after leaving a feed card. | Failures show toasts and unmount cancels delayed navigation. |
| Offline fallback Retry reloaded the fallback. | Retry returns to the production Feed URL; fallback gains safe-area padding and a 44px target. A connection banner describes online requirements inside the loaded app. |
| Account settings asserted data was never shared with third parties. | Copy points to the privacy policy and retains the existing private-by-default chart explanation; legal links remain reachable without the hidden footer. |
| Submission guide suggested unsupported login paths and mixed planned work with shipped behavior. | Guide distinguishes the older build, deployed `2026.9.7` candidate, missing account/review features, and required device verification. Capacitor configuration comments name the implemented authentication bridge. |

## Open issues, ordered by release impact

| Priority | Finding and evidence | Required outcome |
| --- | --- | --- |
| P0 — device acceptance | Real Google completion and native cookie persistence remain unverified. The new internal TestFlight binary includes the bridges. | Complete the device matrix on installed build `2026.9.7`; do not equate processing success with successful login. |
| P1 — public release | Only Google login exists (`AuthModal`, API routes). | Add Sign in with Apple or another equivalent meeting guideline 4.8, unless a documented exception applies. |
| P1 — public release | No account deletion UI or user deletion endpoint was found. Team-member removal is not account deletion. | Provide in-app deletion with confirmation, server-side data cleanup, subscription implications, and applicable retention handling. |
| P1 — public release | Public chart feed has no report/block controls or corresponding moderation endpoints. | Implement reporting, blocking, moderation workflow and published support contact for user-generated content. |
| P1 — product/review | `PlanSelector.tsx` redirects to Polar checkout; `BillingSettings.tsx` opens a web portal. No StoreKit/restore flow exists. | Choose a storefront-appropriate billing approach, implement the app return and entitlement refresh, and verify cancellation/restore behavior. Do not assume web checkout is valid in every storefront. |
| P1 — data loss | `chartStore.ts` is memory-only. Unsaved work has no termination recovery. | Add a recoverable draft with an explicit restore/discard flow and account-switch handling. Test force-quit and low-memory reload. |
| P1 — privacy | Privacy page names Stripe while checkout code uses Polar; AI/provider and retention claims need reconciliation. Import transmits user data to AI services. | Review the actual data flow, contextual consent/disclosures, published policy, and App Privacy answers together. |
| P2 — resilience | Remote loading is required. Offline banner/fallback do not cache charts or queue writes. | Define offline behavior and preserve drafts; add retry/empty/error states for each data operation. |
| P2 — navigation | No universal-link association was found. Shared HTTPS chart links open the website. Feed/tab scroll restoration is not explicit. | Add verified chart/invite universal links and restore tab position without carrying stale detail-page scroll. |
| P2 — performance | Production main JavaScript bundle is approximately 1.98MB / 598KB gzip. Editor/data libraries load with Feed. | Split major routes and heavy editing/export tools; measure cold startup and scrolling on an older supported phone. |
| P2 — accessibility | Auth focus and touch targets improved; VoiceOver, larger text, contrast, reduced motion, keyboard, rotation and iPad layout have not been exercised. | Complete accessibility/device checks before describing the experience as polished or native-complete. |
| P2 — web security follow-up | Existing desktop OAuth state/token-URL exchange remains; this patch confines the new stronger handoff to native login. | Separately migrate web login to a session-bound state and cookie/code handoff. |
| P2 — deployment maintenance | Existing Alembic revision `99235959d9ef` references missing parent `002_add_branding`. Startup currently falls back to `Base.metadata.create_all`. | Repair migration history separately. Verify `native_auth_codes` exists in production before enabling new native authentication; it is registered in the shared model metadata. |

Apple's requirements referenced here are in its [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 1.2 for user-generated content, 3.1 for purchases, 4.2 for app functionality, 4.8 for equivalent login, and 5.1.1 for privacy/account deletion. These findings identify implementation gaps; they do not guarantee any review outcome. See also [account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

## Verification evidence

- `pnpm check:harness`: passed (69 CSS files).
- `pnpm lint`: passed across the workspace.
- `pnpm --filter @chartsuno/web exec tsc --noEmit`: passed.
- `pnpm build:web`: passed; the large-bundle warning remains.
- `pnpm mobile:ios:sync`: passed; custom Swift files/registration survived sync.
- Xcode Debug simulator build: passed for the custom authentication/export bridges.
- Native API suite: 11 tests passed, covering callback-to-cookie authenticated requests, logout, replay, incorrect verifier without code consumption, code expiry, signed expiry returning safely to the app and signature tampering, provider cancellation/failure, missing PKCE, state/session-token separation, and exact-origin redirects. Google is mocked; the actual provider was not used.
- Existing feed endpoint regression suite: 8 tests passed.
- Latest API smoke startup answered `/health` and created `native_auth_codes`. It used an isolated SQLite database and did not exercise production PostgreSQL or real provider credentials.
- Evidence directory on the development Mac: `/Users/andrewwinter/Documents/builds/chartsuno/native-audit/`; Xcode log: `../native-audit-build.log`.

## Device acceptance matrix — partially exercised, completion pending

1. Fresh install: onboarding can be skipped; Feed is usable without login; notch/home indicator and light/dark status bar remain legible.
2. Sign in from Feed and from an unfinished chart: system sheet opens, Google completes, same app/view returns authenticated, draft remains. Cancel at each stage and retry; reject/expire the callback and verify useful recovery.
3. Relaunch and foreground: authenticated cookie persists; expired session and offline network failure behave differently. Sign out, relaunch, and confirm protected content cannot be fetched.
4. Create/edit: type with software keyboard, import CSV and a photo, deny camera permission, rotate the phone, background during an AI request, save, and reopen the chart.
5. Feed: scroll, open detail and return, switch tabs, like/save, double-tap, and retry failures under poor network. Check preserved positions and no delayed unwanted navigation.
6. Share: PNG and CSV to Files/Messages; image to Photos; cancel and repeat; verify chart text/labels are not clipped and iPad share sheet opens safely.
7. Accessibility: VoiceOver labels/order, larger text, reduced motion, focus dismissal, 44px targets, keyboard avoidance, compact phone and iPad.
8. Offline cold start and mid-session disconnect: recovery must return to the app; do not imply charts have been saved when a request failed.

## Release record

- API deployment: `314be84d-1c27-4fb2-ab54-9dde812c1f0a`, Railway `SUCCESS`.
  Prior deployment: `db3b39e0-bd60-448c-940a-a910886be94c`.
- Web production: [Vercel deployment](https://chartsuno-oxz3gd32l-winter-advisory.vercel.app),
  aliased to `www.chartsuno.com`. The shell's `chartsuno.com` URL resolves there.
- TestFlight build: `6c5a214d-a36f-4c53-b244-be3fa55cac54`, `1.0 (2026.9.7)`,
  `VALID` / `IN_BETA_TESTING`.
- Internal Testers group: `488b4d86-cdb9-4a18-a649-a5b3dcb5b213`.
- Signed IPA: `/Users/andrewwinter/Documents/builds/chartsuno/native-audit/export-2026.9.7/App.ipa`.
  Archive/export passed. IPA metadata verified bundle ID/version, production
  HTTPS server, callback scheme, and absence of development ATS exceptions.
- Production API and canonical website proxy checks passed: health, signed
  native state, cancellation redirect back to the app, and invalid-grant 401
  after querying the grant table. These probes created no user account and did
  not complete Google authentication.
- No external beta review or public App Store submission was performed.

Keep public submission gated on the open P1 issues and complete the device
matrix on this actual TestFlight candidate.

## Kun reference applied — September 6 follow-up

The user supplied [Kun Chen's launch post](https://x.com/kunchenguid/status/2096723728814264427).
It points to the [`/kun` engineering skill](https://github.com/kunchenguid/kun),
not an iOS component library or an app-design specification. Its entry guidance
and opinion map informed the following additions. These are Chartsuno-specific
acceptance criteria derived from that guidance, not claims of Kun reviewing or
endorsing this implementation.

| Before | After |
| --- | --- |
| Compilation and API tests could be mistaken for evidence that the reported device bug was reproduced and fixed. | Reproduce the original installed-build login escape, then repeat the same action on the candidate build. Capture which app is foreground and whether the original chart remains. A mocked Google response does not pass this check. |
| Native quality was expressed partly as a list of components and plugins. | Judge the complete journey: open Chartsuno, create/import a chart, sign in, edit, save, share, background, and return. Each step must preserve the user's work and make success/failure visible. |
| The implementation author reviewed their own tests and changes. | Require a fresh reviewer to compare the original user intent with actual behavior and the diff. Review should actively look for missing return paths, cookie-jar assumptions, data loss, cancellation failures, and unnecessary complexity. A separate reviewer completed this review; findings and resolutions are recorded below. |
| A broad audit could grow into an unbounded rewrite. | Prioritize login/session continuity, safe navigation, data preservation, and native export. Record larger billing/account/moderation work as distinct release obligations. A complete UI-framework rewrite is not automatically justified by the reported bug. |

The decisive beta acceptance checks are:

- Sign in from an unfinished chart; finish or cancel Google authentication;
  return to the same Chartsuno view with the chart and inputs intact.
- Save a chart, terminate and reopen the app, and retrieve that saved chart.
  Separately test unsaved-draft recovery; the current implementation does not
  provide it, so it remains an open product gap.
- Export PNG/CSV to a selected destination through iOS, then cancel and retry.
  No browser download or desktop paste instruction should be required.
- Disconnect while saving and reconnect. The app must show failure honestly;
  it must not present an unsaved chart as saved or confuse a network failure
  with a successful sign-out.
- Repeat these checks on the actual distributed TestFlight binary against the
  deployed services, not just the simulator or isolated API test suite.

`/kun` was installed at `/Users/andrewwinter/.codex/skills/kun` for reuse on the
next turn. The four reference documents were cached under the local audit
evidence directory. Its optional [`no-mistakes`](https://github.com/kunchenguid/no-mistakes)
validation tool was offered; no new Git remote, review pipeline, push, or PR
was created. Reading this reference alone added no device verification evidence. Later
simulator screenshots and production probes are documented below.


## Independent review and live follow-up

| Before | After |
| --- | --- |
| Removing the desktop sidebar removed the native entry points to Dashboards, Published, and Team Spaces. | `NativeLibraryNav` provides a compact selector on library/team screens, reachable through My Charts. Liked is also available there and in Feed. |
| A delayed account response could restore signed-in UI after logout. | `AuthContext` invalidates old checks with a request generation counter at authentication transitions. |
| Cancelling login during the initial account check could leave loading set forever after invalidating that check. | Login's terminal cleanup clears loading on success, error, and cancellation. |
| Expired Google state produced an API error page inside the authentication sheet. | Signature and audience are verified before returning a nonce-bound expiry error. Tests ensure no grant/session is issued and forged expired state is rejected. |
| Light-mode status text was white; native picker dismissal could reset it again. | Status-bar style follows the app theme initially, on foreground, and after native `viewDidAppear`. The readable light-mode result was observed in a simulator screenshot. |
| Native Feed showed a redundant browser-style Back action. | Native Feed has no Back action; detail screens retain navigation. |

A separate reviewer verified the final fixes with no remaining findings in
those changes. Validation includes 19 passing API tests, final workspace lint,
TypeScript, harness checks, Vercel production build, and signed iOS archive /
export. Native Home interaction and screenshots work through CUA; simulator
pointer interaction remains a tool limitation, so touch/keyboard, actual Google
completion, and file destination checks are explicitly unfinished.
