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
- The `ios/` project is committed. Custom Swift plugins (`NativeAuth`,
  `NativeExport`, `SecureStore`) are registered in `ChartsunoViewController`
  and referenced in `project.pbxproj`. `cap sync` may rewrite
  `Package.swift` and `capacitor.config.json`; re-check that
  `PrivacyInfo.xcprivacy`, `App.entitlements`, and the plugin file
  references are still in the Xcode project afterward.
- Release steps live in `docs/ios-release.md`. Bundle id placeholder:
  `com.chartsuno.app`.
