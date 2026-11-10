# Chartsuno iOS interaction QA — November 10, 2026

## Changes

- Dedicated iOS navigation chrome with centered titles, back navigation, Account sign-out, and app information links.
- System typography, compact feed presentation, immediate chart opening, and less entrance animation in the native shell.
- Removed the oversized first-chart banner from native screens.
- My Charts exposes Published, Saved, Liked, Dashboards, and team destinations. Saved no longer assumes its protected route inherits MainLayout outlet context.
- All six creation sources are visible in a labeled grid; selection state is accessible.
- Shorter sign-in copy; native editor omits redundant New Chart, simplifies status badges, and collapses useful AI summaries. Placeholder summaries are omitted.
- Newly created charts never display a negative age. Native library cards no longer install desktop hover handlers/animations.

## Verification

On the existing iPhone 18 Pro Max, iOS 27.2, using the T3 Device panel (no Simlock):

- User completed Google sign-in; authenticated feed loaded.
- Authenticated session survived app relaunch and an app update.
- Created a CSV dataset with Q1–Q4 values 20, 35, 28, 49; generated and privately saved it.
- Reopened that saved chart from My Charts and confirmed data persisted.
- Share image opened the native iOS PNG share sheet; dismissed without sending.
- Account opened, tab navigation remained reachable, and system light/dark changes updated the app and status bar.
- Saved initially crashed during exploration. Fixed the missing outlet-context assumption, added regression coverage, rebuilt, and verified its empty state and Back navigation on device.
- Newly saved chart showed Today after the age fix.

Revyl baseline session: https://app.revyl.ai/sessions/0c18e872-e470-4f1c-9b7e-66d4be34268d
Baseline account gate and reviewer sign-in were exercised there. At the user's request, subsequent candidate verification moved to the existing local Pro Max. This is not a claim that the whole candidate regression suite ran in Revyl.

Automated checks: harness, workspace lint, web TypeScript, 48 passing web tests. Tests use NODE_OPTIONS=--no-experimental-webstorage to avoid the host Node global localStorage mismatch. Signed simulator build succeeded.

## Limits

No purchases, publishing, destructive account actions, photo permissions, or real-device VoiceOver/Dynamic Type certification were performed. The private four-row Untitled Chart test artifact remains in My Charts. The architecture is still Capacitor with a bundled React UI and native auth/share integration, not a SwiftUI rewrite. Main/web production deployment does not update existing App Store/TestFlight binaries; they require a new native release.
