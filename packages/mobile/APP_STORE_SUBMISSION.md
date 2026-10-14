# iOS App Store Submission Guide

The archive, signing, listing, and privacy steps are in
[`docs/ios-release.md`](../../docs/ios-release.md). Use that document.

`packages/mobile` is the committed Capacitor shell. The web app is bundled
into the binary (`webDir: ../web/dist`). Do not run `cap add ios` again;
that would regenerate the Xcode project. Sync with `pnpm mobile:ios:sync`
from the repo root, then archive on a Mac.

Sign in with Apple, account deletion, feed report/block, the privacy
manifest, and the Keychain session are described in the release doc.
A website deploy does not update an installed app.

## Earlier TestFlight record

Chartsuno 1.0 build `2026.9.7` was in internal TestFlight as of
September 6, 2026. That build does not include Sign in with Apple or
account deletion. Upload a new build from the current project.

- App Store Connect app ID: `6807256509`
- Apple team: `VRTT45LLND`
- Bundle ID: `com.chartsuno.app`
- Build ID: `6c5a214d-a36f-4c53-b244-be3fa55cac54`
- Internal group ID: `488b4d86-cdb9-4a18-a649-a5b3dcb5b213`

The September 6 audit is `docs/native-mobile-audit-2026-09-06.md`. Its open
device checks still apply. Its "missing Sign in with Apple / account
deletion / report" findings are addressed in the current tree.
