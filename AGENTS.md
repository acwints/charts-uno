# AGENTS.md

## Commands

```bash
# Dev
pnpm dev                    # Start web dev server (Vite)
pnpm build:web              # Build shared + web

# Verify
pnpm lint                   # ESLint across all packages
npx tsc --noEmit            # Type check (run from packages/web)

# API
cd packages/api && python run.py  # Start FastAPI server
```

## Code Style

React + TypeScript + Vite SPA. Recharts for charts, Zustand for state, motion/react for animation.

```tsx
// Component pattern: config + onChange props, derive state inline
function MyControl({ config, onChange }: Props) {
  // GOOD: derive from props
  const theme = getTheme(config.colorScheme, config.themeMode);
  // BAD: useState for derived values
  // const [theme, setTheme] = useState(...)

  const update = (u: Partial<ChartConfig>) => onChange({ ...config, ...u });
}
```

```css
/* GOOD: specific transition properties */
.btn { transition: color 150ms, background-color 150ms, border-color 150ms; }

/* BAD: transition all */
.btn { transition: all 150ms; }

/* GOOD: focus-visible */
.input:focus-visible { border-color: var(--accent); }

/* BAD: bare focus */
.input:focus { border-color: var(--accent); }

/* REQUIRED: every file with transitions */
@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }
}
```

## CSS Conventions

- Plain CSS files matching component name (`ColorStudio.tsx` / `ColorStudio.css`)
- Prefix classes to avoid collisions: `cstudio-`, `data-`, `chart-`
- Use CSS variables from `index.css` (`--bg-secondary`, `--accent`, `--text-muted`)
- 1px gap with `var(--bg-tertiary)` for visual separators (not borders)
- `font-variant-numeric: tabular-nums` on numeric/hex displays
- `text-overflow: ellipsis` with `overflow: hidden` for truncation

## Accessibility Rules

- Icon-only buttons: always add `aria-label`
- Toggle buttons: add `aria-pressed`
- Form controls: wrap in `<label>` or add `aria-label`
- `spellCheck={false}` on code/hex inputs
- Semantic HTML before ARIA roles

## Design Quality

Follow these installed agent skills for UI quality:

- `frontend-design` (anthropics/skills) -- distinctive UI, no generic AI aesthetics
- `vercel-react-best-practices` (vercel-labs/agent-skills) -- React perf patterns
- `web-design-guidelines` (vercel-labs/agent-skills) -- 100+ web interface rules

Key: no Inter/Roboto defaults, no purple-on-white cliches, CSS variables for theming, dominant color with sharp accent.

## Don'ts

- `transition: all` -- list specific properties
- `:focus` -- use `:focus-visible`
- `useState` for values derivable from props
- Hiding primary controls behind accordions/toggles
- Committing `.env` or credential files
