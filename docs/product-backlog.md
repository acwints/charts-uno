# Product Backlog

## Chartsuno Studio

**Status:** Parked after lightweight social sharing v1

**Product idea:** Turn a finished chart into a credible, on-brand social post and distribute it without leaving Chartsuno.

### Included in social sharing v1

- First-class **Share to X** and **Share to LinkedIn** actions in the Chart Workbench toolbar.
- Copy the rendered chart image before opening the platform composer so the user can paste it directly.
- Prefill the chart title in the X composer.
- Include the Chartsuno chart URL in an X post when the saved chart is already public.
- Keep private charts private; sharing an image never changes publish settings automatically.

### Backlog

- User-authorized X and LinkedIn OAuth connections.
- A dedicated Chartsuno Studio composer with platform-specific post previews.
- Grounded AI copy suggestions based only on chart data, annotations, and sources.
- Drafts, scheduled publishing, reusable queue slots, and a content calendar.
- Immutable social-media render snapshots and per-platform aspect ratios.
- LinkedIn company pages, X threads, and multi-image posts.
- Team review, approval, and publishing permissions.
- Delivery history, retries, reconnect states, and audit logs.
- Post analytics and recommendations informed by prior chart performance.
- Recurring posts generated from live or automatically refreshed charts.

### Revisit when

- A meaningful share rate develops from the v1 buttons.
- Users repeatedly ask for scheduling or platform connections.
- X API publishing costs and LinkedIn app-review requirements have been validated.

## iOS beta and App Store readiness

**Status:** Chartsuno 1.0 build `2026.9.1` uploaded to App Store Connect for
TestFlight processing on September 1, 2026.

### Included in the TestFlight beta

- Capacitor 8.5 shell for iPhone and iPad, targeting iOS 15 and later.
- Native share, browser, haptics, splash-screen, and status-bar bridges.
- Production-only remote URL with an offline fallback; localhost is never
  shipped in the native configuration.
- Automatic App Store signing, a unique monotonic build number, export
  compliance metadata, a complete App Store icon, and valid Capacitor privacy
  manifests.

### Required before public App Review

- Add Sign in with Apple as an equivalent option to Google sign-in.
- Move Google OAuth into `SFSafariViewController` and return through a verified
  app deep link; Google blocks OAuth inside embedded webviews.
- Add an easy-to-find, self-service account-deletion action in Settings.
- Complete and verify the App Store privacy questionnaire against the published
  privacy policy and the production service providers.
- Smoke-test first-time and returning authentication, chart creation, native
  sharing, offline recovery, and account deletion on a physical iPhone and iPad.
- Add a small amount of durable native value if App Review flags the remote-web
  shell under minimum-functionality guideline 4.2 (push notifications and a
  pinned-chart widget are the strongest candidates).
