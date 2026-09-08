# Mobile Shell (Capacitor)

- This package is the iOS App Store wrapper; all UI lives in `packages/web`
  (mobile feed, tab bar, safe-area handling, onboarding).
- The web app is **bundled** into the binary: `webDir` is `../web/dist`.
  `pnpm ios:sync` rebuilds shared + web, then runs `cap sync ios`. Web changes
  reach installed apps only through a new build (or an OTA service, not yet
  wired). Never point `webDir` at a stale build.
- API calls go to `https://chartsuno.com`; native sign-in returns a bearer
  token that `SecureStorePlugin.swift` keeps in the Keychain. Cookies are not
  used inside the app. Do not add a `server.url` to committed config; use
  `CAP_SERVER_URL` locally only.
- The splash is the launch storyboard (solid `LaunchBackground` + `LaunchMark`)
  and stays up until the web app calls `SplashScreen.hide()` after first paint.
- The `ios/` directory is generated on a Mac via `pnpm ios:add`; the custom
  Swift plugins (`NativeAuth`, `NativeExport`, `SecureStore`) are registered in
  `ChartsunoViewController` and referenced in `project.pbxproj`. Never
  hand-edit generated Capacitor files that `cap sync` overwrites.
- See `APP_STORE_SUBMISSION.md` for the submission flow and review-risk
  notes (Sign in with Apple, account deletion, UGC moderation, billing).
