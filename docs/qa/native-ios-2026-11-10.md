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

## Reading flow follow-up

Native saved-chart routes now open a focused reader. Editing is an explicit Edit chart / Customize a copy action, and the reader owns its fetched data without replacing the editor's draft. Sources are shown when provided; an import method is not presented as a source citation. The full data table preserves zero versus missing values and initially renders 50 rows, with more on demand. Opening saved infographic records displays their underlying data rather than silently generating new artwork.

Feed line/area/bar previews have labeled axes and series legends. Line/area cards include exact first and last values. Dense pies and unsupported thumbnail chart types show labeled data previews rather than substituting a different chart type. Existing web editor behavior is preserved.

Regression tests cover draft isolation, route-response races, owner/copy action destinations, source URL schemes, large data pagination, and load retry. Device verification covers feed labels, reader entry, exact data disclosure, and explicit Edit navigation.


## Navigation continuity and draft protection

- Native Feed retains loaded pages, pagination offset, and scroll position during chart visits and tab switches. Refresh remains explicit.
- Create resumes the current document. Chart data, configuration, and Chart/Data view stay in the editor store; reopening the same saved document refreshes ownership without replacing local edits.
- New and opening a different editor require confirmation when data or configuration would be discarded. Cancel retains the document. New clears the previous input draft.
- Text/source inputs and staged uploads stay in memory across tab changes. Account transitions clear editor, input, feed, and scroll state; late input callbacks cannot repopulate a cleared session. Drafts are not persisted across process termination.
- Reader Back carries its Feed/library origin; Edit carries its reader origin.
- Native template query parameters no longer bypass the account gate.

Validation: harness, lint, TypeScript, signed simulator build, and 62 tests across 20 files. Regression coverage includes local editor resume, cancelling document replacement, config-only dirtiness, input remount/session clearing, delayed scroll restoration, pagination after feed remount, and the native template account gate.

On the existing signed-in iPhone 18 Pro Max: scrolled Feed to the second chart, opened it, and returned to the same position; pasted four rows, switched to Feed and back, and verified all rows remained; generated a draft, changed its title to “Navigation QA draft,” switched tabs, and verified the title/data returned; opened New and cancelled the native confirmation, preserving the draft. The QA draft was not saved or published. Final binary reinstalled after the account-gate correction.
