# Chartsuno audit remediation — 20 October 2026

Scope: Chartsuno only, including web, API, bundled iOS app, bot, marketing, shared renderers, dependencies and CI. This record describes the implementation and pre-release verification. Check the commit and hosting-provider deployments for production rollout status. App Store upload is a separate release.

## Findings and disposition

| Audit finding | Implemented correction |
| --- | --- |
| 1. Dashboard chart disclosure | Current read authorization at insertion and every serialization; revocation and anonymous reads covered. |
| 2. Cross-team SQL credentials | Connection-team membership required when linked and rechecked before refresh. |
| 3. Saved/liked visibility | Collections apply current chart visibility. |
| 4. Active generated SVG | Server primitive allowlist plus independent DOMPurify client sanitization; malicious SVG regression and actual Chromium execution check. |
| 5. Web OAuth state/URL tokens | Signed expiring state, tab-owned PKCE/nonce, one-use code exchange and httpOnly cookie. No JWT in callback URL. |
| 6. Chart identity and async saves | Route/account/request generations, atomic document/baseline loading, guarded saves and clean imports. |
| 7. Marketing auth | Fail closed; explicit loopback-only development escape hatch, bounded validated bodies. |
| 8. Marketing state loss | Cross-process lock, durable replacement writes and concurrent-process regression. |
| 9. Bot missing data | Preserve null observations instead of inventing zero. |
| 10. Mention backlog loss | Drain pagination before checkpoint; reject partial/repeated-token results. |
| 11. Monthly quotas | UTC calendar rollover plus transactional conditional consumption and rollback. |
| 12. Stock refresh | Await async adapter; persist each valid chart safely. |
| 13. Migration startup | Repair legacy already-present columns; propagate migration failure; repeated/bootstrap startup tests. |
| 14. Publication outcomes | Durable per-platform operation ledger and remote IDs; pure dry runs; truthful accepted/scheduled/draft states. **Mitigated: ambiguous outcomes require manual reconciliation and TikTok status polling remains follow-up.** |
| 15. Stale X credentials | Read current credentials when obtaining a posting client. |
| 16. Public account metadata | Public author projection includes only id, name and picture. |
| 17. CI omissions | Pull-request checks, JS regressions, production web/bot build, isolated Python 3.11 API suite. |
| 18. Dependencies | Updated direct packages, constrained patched transitives, pinned tested Python dependencies. Scans currently report zero known production JS/Python advisories. |
| 19. Keyboard/touch/motion | Semantic desktop chart-opening button, 44px sampled phone/tablet actions and settings close, reduced-motion animation/scroll handling. |
| 20. Stale account/team resources | Account-keyed team state and generation-guarded usage/feed responses. |

Device testing additionally exposed a misleading Update/Publish action on other authors’ public charts. Those charts now offer Save a Copy, create a private chart owned by the current account, and hide owner-only publication controls. A regression verifies that subsequent saves update only the new copy.

The new C/chart logo is applied to browser icons, native app icons, launch assets, headers and chart attribution. Assets regenerate through `pnpm brand:generate`.

## Verification

- 62 JavaScript tests: shared 35, web 14, bot 3, marketing 10.
- 117 API tests on a clean Python 3.11 environment and isolated disposable SQLite. The runner strips inherited app credentials and creates a fresh database, including when an inherited fake production URL is present.
- Workspace lint, TypeScript checks, harness checks and web/bot/marketing builds pass.
- Actual Chromium SVG attack no longer executes. Actual chart PNG rendering and US map rendering succeed. Remotion compositions and a rendered chart frame succeed on Node 24 with `--bundle-cache=false` (local persistent bundle caching stalled).
- New lifecycle, shared-renderer and API access regressions were checked against pre-fix source in isolated experiments and fail there.
- Native testing uses an installed Capacitor `.app`, not browser viewport emulation. Local XCTest passed the core journey on iPhone 17e / iOS 26.4, including a cold-restart Keychain session, private save, native PNG share sheet and account navigation. Revyl completed 14/14 steps and 7/7 validations on an installed iPhone 16 / iOS 18.5 app.

## Remaining work and limits

- Bot chart-creation POST retries still need a durable server-backed idempotency contract. An uncertain response can create duplicate stored charts.
- Marketing state needs one shared persistent volume. Separate replicas/volumes require a database-backed ledger. Ambiguous provider outcomes, partial X threads and dead locks require verified reconciliation before retrying. TikTok acceptance is not proof of eventual publication.
- Real provider OAuth, paid AI/billing, production PostgreSQL migration and customer SQL databases were not exercised. Synthetic device tests use a disposable API with provider adapters stubbed and no paid credentials.
- SQL egress policy, anonymous generation budgets and billing webhook event ordering/deduplication remain additional hardening opportunities, not demonstrated fixed exploits in this change.
- Download retains the existing citation-free clean export policy. Async clipboard activation on real Safari remains unverified.
- A passing simulator test does not establish real-device OAuth, App Store signing, universal accessibility, or a security certification.

Deploy web and API authentication updates together. Installed iOS apps require a new bundled native release to receive these changes. Never archive the disposable-test-API build; restore `pnpm mobile:ios:sync` without `VITE_API_URL` first.

## Native evidence

- Revyl report: https://app.revyl.ai/tests/report?taskId=4eed0293-962a-4173-bae9-ee8445d5fb02
- Uploaded build: `0a892d58-6fe8-41db-90ee-0031b42c6661`, `audit-remediation-signed-20261020`. SHA-256: `46e871a30f3896036e27cd1c6a286b64a2126906a05a73f74e8314a62d51c928`.
- Initial unsigned run was cancelled during a validation after local Keychain testing established the build-signing problem; it is not counted as a passing run.
- Later local native builds additionally verify public-chart private-copy controls. Final layout QA adjusts web share/tablet targets and resets the native content scroll pane on forward navigation. The Revyl report identifies its exact earlier build; these subsequent corrections are checked locally.
- Test data and API are disposable. No customer data, real provider sign-in, paid generation or external publication was used. The test tunnel is closed after testing and normal production bundling is restored.

Final local simulator run: XCTest result `/tmp/chartsuno-native-audit-result10`, 1 end-to-end journey passed, 0 failures. Latest synthetic-API simulator archive SHA-256: `988423d3dd49195573565d8812b4b72763206e7c48ddf01cb80d5965b151fa3c`. Native settings screenshot verifies the header and top of Settings after the scroll-container correction. This test archive is not an App Store release.
