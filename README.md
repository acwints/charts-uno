# Chartsuno

Chartsuno turns data, screenshots, and prompts into editable charts. The platform includes a React/Vite web app, FastAPI backend, a bundled Capacitor iOS app, and separate bot and marketing services.

See [the audit remediation and verification record](docs/audit-remediation-2026-10-20.md), [the repository map](docs/repo-map.md), [domain terms](CONTEXT.md), and [iOS release instructions](docs/ios-release.md).

## Local development

Use Node 22.12+ and pnpm 10. Install with `pnpm install --frozen-lockfile`, then run `pnpm dev` for the web app. The API uses Python 3.11; install `packages/api/requirements.txt` with `-c packages/api/requirements.lock`, configure its documented environment variables, then run `python run.py` from that directory.

## Verification

```sh
pnpm check:harness
pnpm lint
pnpm test
pnpm build:web
pnpm build:bot
pnpm --filter @chartsuno/marketing build
packages/api/.venv/bin/python packages/api/scripts/test_api.py
```

The API runner always creates a disposable test database and strips inherited application credentials. Do not run the raw API test discovery command with production environment variables: some tests recreate their database schema. CI runs these tests under Python 3.11 and checks JavaScript tests/builds on pull requests.

## Authentication and private data

Web sign-in uses signed, expiring state plus a tab-owned PKCE verifier and one-use exchange code. Session JWTs are established as httpOnly cookies and never put in callback URLs. Deploy the web and API updates together; older web bundles must reload to use the new exchange. Native Google/Apple sign-in and Keychain-backed bearer sessions retain their existing protocols.

A public dashboard does not publish its private charts. Dashboard, saved, and liked reads all recheck current chart visibility. SQL links are authorized when created and whenever their credentials are used for refresh.

## Native testing

`pnpm mobile:ios:sync` builds and bundles the web app into the iOS project. A production web deployment does not update installed apps. Native validation must install a newly built `.app` into an iOS Simulator or Revyl device; a resized browser is only a supplemental layout check.

Revyl project configuration and reusable test definitions live in `packages/mobile/.revyl/`. Test builds can point `VITE_API_URL` at a disposable test API; do not ship that build to the App Store. Re-run the normal sync command without that variable before archiving for release.

## Automation operations

Marketing requests fail closed without `MARKETING_API_KEY`, except explicit loopback-only development mode. Publication/storage operations use durable operation records and inter-process locks; replicas must share the same persistent volume. Ambiguous remote outcomes and partially posted threads require reconciliation before retrying. See [marketing operations](packages/marketing/README.md).

Bot chart-creation retries do not yet have server-backed idempotency keys. Treat an uncertain create response as a potential duplicate; a durable mention-operation contract remains follow-up work.

## Dependencies

Python deployment uses the tested Python 3.11 constraints in `packages/api/requirements.lock`. JavaScript versions and selected patched transitive dependencies are pinned by `pnpm-lock.yaml` and root overrides. Refresh constraints/overrides with the full verification suite, real rendering smoke checks, and a fresh native build.
