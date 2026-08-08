# Mobile Shell (Capacitor)

- This package is the iOS App Store wrapper only; all UI lives in
  `packages/web` (mobile feed, tab bar, safe-area handling).
- `capacitor.config.ts` loads the production site remotely. Do not point it
  at localhost in committed code.
- `shell/` is the offline fallback page, not the app.
- The `ios/` directory is generated on a Mac via `pnpm ios:add`; never
  hand-edit generated Capacitor files that `cap sync` overwrites.
- See `APP_STORE_SUBMISSION.md` for the submission flow and review-risk
  notes (OAuth-in-webview, guideline 4.2, Sign in with Apple).
