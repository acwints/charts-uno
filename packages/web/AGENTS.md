# packages/web

Vite + React 18 + TypeScript SPA for chart creation and export.

## Commands

```bash
pnpm dev          # Dev server at localhost:5173
pnpm build        # tsc -b && vite build
pnpm lint         # ESLint
npx tsc --noEmit  # Type check only
```

## Stack

Recharts, Zustand (chartStore), motion/react, lucide-react, html2canvas, papaparse.

## Color System

Light and dark theme variants per color scheme. Key functions in `packages/shared`:

```ts
getTheme(scheme, mode)           // Returns ColorTheme for scheme + light/dark
applyCustomColors(theme, custom) // Merges user overrides
getEffectiveColors(scheme, custom) // Returns series palette
```

Users can override any color (background, text, grid, series) via CustomColors.

## Component Patterns

- `config: ChartConfig` + `onChange` prop pattern for all controls
- ColorStudio is always visible (never behind accordion/toggle)
- CSS class prefix per component to avoid collisions
- `<label>` wrapping color inputs for accessibility
