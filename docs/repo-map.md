# Repo Map

This file is the fast orientation layer for humans and coding agents.

## Package Boundaries

- `packages/web`: Vite + React + TypeScript SPA (chart builder, dashboard, settings, feed UI).
- `packages/api`: FastAPI backend (auth, persistence, team management, AI/data services).
- `packages/shared`: Shared TypeScript types and color/theme logic consumed by web + bot.
- `packages/bot`: TypeScript bot pipeline for rendering, analysis, posting, and API integration.

## Source-of-Truth Files

- `AGENTS.md`: global engineering rules and UI standards.
- `packages/web/AGENTS.md`: web-specific implementation patterns.
- `packages/api/AGENTS.md`: API structure and runtime commands.
- `docs/ai-models-and-evals.md`: model override variables and chart-generation eval commands.
- `scripts/check-harness.mjs`: mechanical checks for key repository invariants.

## Verification Matrix

- Web UI/CSS changes: `pnpm check:harness`, `pnpm lint`, `cd packages/web && npx tsc --noEmit`
- Shared type/theme changes: `pnpm build:web`, `pnpm lint`
- API changes: `cd packages/api && python run.py` (smoke start) plus affected endpoint checks
- Bot changes: `pnpm --filter @chartsuno/bot build` and lint relevant files

## Harness Principles for This Repo

- Prefer enforceable checks over prose-only guidance.
- Keep constraints local to the package where they apply.
- Keep docs short and task-oriented; update this map when ownership changes.
