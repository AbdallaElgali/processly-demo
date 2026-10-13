# Step 1: design tokens, both colour modes, Tailwind removed

## Goal
plan-A §9 step 1: design tokens for light and dark on MUI v7 `colorSchemes`, one `ThemeProvider`, Inter actually loaded and applied, Tailwind removed (D2), `theme/colors.ts` reduced to a deprecated shim, contrast verified by script, quick theme toggle with backend persistence.

## Changes
**New**
- `theme/tokens.json` — single source of truth for colour: `light`, `dark`, and a mode-invariant `document` group. Shared with the contrast script so the theme and its verification cannot drift.
- `theme/tokens.ts` — typed view over the JSON, plus `radius`, `motion` (120/160/200 ms, 200 being §8.4's ceiling) and `shadow` (light uses shadows, dark uses raised surfaces + borders).
- `theme/layout.ts` — header/rail/split-pane constants that were duplicated as magic numbers in `app/bda/page.tsx`, `app/review/page.tsx` and `hooks/Resizer.tsx`.
- `theme/ThemeRegistry.tsx` — the app's single `ThemeProvider` + `CssBaseline`.
- `scripts/contrast-check.mjs` — 83 assertions over the tokens; `npm run check:contrast`.
- `hooks/useThemePreference.ts` — wraps `useColorScheme()`; mirrors the choice to `user_settings.theme` via `PUT /auth/update-user-settings` when a user is known, local-only otherwise.
- `components/shell/ThemeToggle.tsx` — header quick toggle, cycles light → dark → system.
- `app/dev/theme/page.tsx` — dev-only token preview (`notFound()` in production). **Not in the plan**; added because the step's own check is "both modes visible" and the pre-redesign screens cannot show that (they are on the shim). Step 5 grows it into the planned gallery instead of building a second one.

**Changed**
- `theme/theme.ts` — rewritten: `cssVariables.colorSchemeSelector: 'data-mui-color-scheme'`, both schemes, palette augmentation for `accent`/`surface`/`border`/`status`/`document` and `text.muted`/`text.inverse`, Inter via `--font-inter`, MUI transition durations capped at 200 ms, global focus ring, `prefers-reduced-motion` reset, `MuiButtonBase` focus override, `MuiOutlinedInput` using `border.interactive`. The `MuiPaper` rule that pinned every Paper to the dark surface is gone — that single line made a light mode impossible.
- `app/layout.tsx` — `InitColorSchemeScript` (pre-paint, `defaultMode="system"`), `AppRouterCacheProvider`, `ThemeRegistry`, Inter with `latin-ext` for the German umlauts in the datasheets. Dropped the inline `100vw/100vh` on `<body>` (`100vw` ignores the scrollbar).
- `app/globals.css` — reduced to `color-scheme: light dark`. Removed the Tailwind directives and the forced `overflow: hidden` / `display: flex` on html/body.
- `theme/colors.ts` — deprecated shim over the **dark** token values, so untouched screens render as before.
- `app/bda/page.tsx`, `app/review/page.tsx`, `app/admin/page.tsx`, `app/login/page.tsx`, `components/NoProjectsScreen.tsx` — removed all **9** `ThemeProvider` + `CssBaseline` mounts and the now-unused imports.
- `eslint.config.mjs` — `no-restricted-imports` **warns** on `@/theme/colors` with a message pointing at the token replacement. Becomes an error in the final step.
- `package.json` — removed `tailwindcss` and `@tailwindcss/postcss`; deleted `postcss.config.mjs`; added `@mui/material-nextjs` (see Decisions) and the `check:contrast` script.
- `claude-notes/context/FE_RFC.md` → `fe_rfc.md`, as asked. The old name still appears inside earlier history/plan notes; those are append-only records (§1), so they were left alone.
- `CLAUDE.md` — §3 gained `check:contrast`; §5 "App entry" and "Styling" rewritten; §6's "Dark mode only" row updated to say what actually remains. The stale §5 claim that `app/page.tsx` re-exports the BDA page and that login is unwired is also corrected.

## Decisions
- **Added a dependency, `@mui/material-nextjs`.** Not in the plan. Browser verification found a hard hydration error: the server emitted CssBaseline's `css-global` `<style>` where the client rendered the first element. This is MUI's documented App Router requirement and the package was never installed. The app has always lacked it; the fault only became visible once `CssBaseline` moved from each page up to the root, so step 1 surfaced a latent bug rather than creating one. `v16-appRouter` matches Next 16.
- **Light-mode accent is a darker cyan than the plan's hex.** plan-A §1.2 set `accent.fill = #00AAB9` with white text and predicted it would fail AA. The script measured **2.82:1** — a real AA failure on every primary button. Light mode now uses `fill #007A85` / `fillHover #00646D` (white on it: **5.09:1**), and the untouched brand `#00AAB9` is kept as `accent.brand` for decoration and the logo only, where WCAG exempts it. D1 is honoured: same hue, and this *is* the "darker cyan so it passes AA on white" D1 asked for.
- **Added `border.interactive`.** `border.subtle`/`border.strong` are decorative (dividers, card outlines) and WCAG 1.4.11 does not apply to them, but input outlines do need 3:1 and MUI's default `rgba(0,0,0,0.23)` does not reach it. One extra token, used by `MuiOutlinedInput` now.
- **Two contrast thresholds I deliberately set below 4.5**, both documented in the script: decorative borders are held to "perceptibly distinct" (1.25), and `accent.brand` likewise since it must never be the sole carrier of meaning. Anything a user must perceive uses `accent.fill`, which is checked at 3:1/4.5:1.
- **The shim is plain hex, not CSS variables.** A `var()`-based shim would have made the old screens follow the colour scheme for free, but `alpha()` throws on a CSS variable (verified) and several call sites also concatenate an alpha suffix (`${colors.border}40`). Confirmed the plan's choice was right.
- **Fragments where a provider wrapped several children** (`bda`, `NoProjectsScreen`) rather than restructuring those pages; they are rewritten in step 3 and 8.

## Gaps found
- **The focus ring silently did not work at first.** `:focus-visible` matched but the computed outline was `0px none`: `MuiButtonBase` sets `outline: 0` at the same CSS specificity as the global `*:focus-visible` rule and is injected after it, so every Button, IconButton, Chip, Tab, MenuItem and ListItemButton fell back to MUI's much fainter focus tint. Fixed with a `MuiButtonBase` override. **Worth remembering: a global `*:focus-visible` rule is not sufficient with MUI.** This was only caught by measuring the computed style in a browser — build, lint and the CSS dump all looked fine.
- `prefers-reduced-motion` is verified only as "the rule is emitted and correct". Actually exercising it needs an OS-level setting change, so it is untested behaviourally.
- The pastel stat cards in `app/admin/components/GlobalOverview.tsx` (`#e3f2fd`, `#e8f5e9`, `#fff3e0`) and the hardcoded Recharts fills are still light-on-dark. Confirmed visually against live data. Scheduled for step 14, unchanged.
- `mui@0.0.1` sits in `dependencies` and nothing imports it — a typo-install. Left alone; worth removing in a cleanup step.
- Lint warnings rose from 26 to 50. The 24 new ones are all the new deprecation rule firing on files that still import the shim, which is the intended signal of remaining work. 0 errors.
- **R9 is closed:** `static/battery-template.ts`, `scripts/`, `_bundled_frontend_types.md` and `frontend_codebase_tree.txt` were committed by the owner in `d68d644`. AM7's discharge-sign check in step 8 still applies and is untouched by this step.
- Audited the owner's `git add .` commit as asked: **nothing that must not be in git.** No `.env`, key, cert or `DATABASE_URL` in any commit ever; no `node_modules/`, `.next/`, `out/`, `build/`, `storage/` or `.tsbuildinfo` tracked; `.env.local` present but correctly ignored; 121 tracked files. The only secret-shaped match in tracked content is CLAUDE.md §0.6's own rule text.

## Verification
`npm run check:contrast` → **exit 0, 83/83 pairs pass.** `npm run lint` → **exit 0**, 0 errors / 50 warnings. `npm run build` → **exit 0**, 7 routes.

Checked in Chrome against the running app (dark OS preference), at 1440×900 and 1280×800:

**§8.3 — both modes visible.** `/dev/theme` renders every token group, the control row and the document surface in both schemes. Both `[data-mui-color-scheme="light"]` and `[...="dark"]` blocks are emitted, each carrying the custom tokens with the right per-mode values (`--mui-palette-accent-fill` is `#007A85` light / `#00AAB9` dark).

**§8.3 — OS default.** With `mui-mode` and `mui-color-scheme` cleared to simulate a first visit, stored mode resolved to `system` and the applied scheme to `dark`, matching `prefers-color-scheme: dark`; `body` background `rgb(11,16,23)` = the dark canvas.

**§8.3 — persistence.** Clicking the toggle moved light → dark, wrote `mui-mode=dark`, flipped `data-mui-color-scheme` and repainted; the value survived a reload. The backend half (`PUT /auth/update-user-settings`) is wired but **not exercised**: it only fires for a logged-in user and I did not log in.

**§8.3 — documents stay light.** In dark mode the document panel keeps the white page, light grid and dark text; `--mui-palette-document-page` and `--mui-palette-document-highlightStroke` resolve identically (`#FFFFFF`, `#00707A`) under both schemes.

**§8.3 — status colours.** All eleven status tokens plus their chip backgrounds render distinctly in both modes; every one is paired with a label in the preview, never colour alone.

**§8.4 — focus ring.** Real keyboard focus (click, then Tab) on the Outlined button: `:focus-visible` true, computed outline `2px solid rgb(95,211,222)` = `accent.focus` for dark, with a 2px offset. In light mode the same variable resolves to `#00707A`. This is the check that caught the ButtonBase bug above.

**§8.4 — motion.** MUI's durations are capped at 200 ms in the theme, and the emitted CSS contains the `prefers-reduced-motion: reduce` block zeroing animation, transition and scroll behaviour. Verified as emitted CSS, not as observed behaviour.

**Old screens still render.** `/login` and `/admin` both render at 1280×800 with no console errors and no dev-overlay issues; `/`, `/bda`, `/review`, `/admin`, `/login`, `/dev/theme` all return 200. Incidentally confirmed step 0's `AdminSidebar` fix against live backend data — the project rows now show real usernames instead of the literal `"undefined | <date>"`.

## Next
**Step 2a-i** per AM4: `lib/jobs/*` (store, runners, sse, config), `lib/project-data/*`, the `api/types/*` they need, the H1 lost-human-flag fix, the H2 `CanonicalParameter.category` type, the upload `errors` type, `AbortController` on both streams, and Vitest plus the 2a tests from AM3 (job reducer, SSE→phase mapping, correction priority and per-project ordering, and the D11 regression that results for project A never touch project B). No UI rewiring — that is 2a-ii. CLAUDE.md §3 will need `npm test` added once Vitest lands.
