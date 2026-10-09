# Step 1b: dark scheme back to the original neutral greys

## Goal
The owner preferred the pre-redesign dark palette (the old `theme/colors.ts` greys) over step 1's navy dark tokens. They edited the `dark` block of `theme/tokens.json` themselves; this step verifies that edit against the contrast gate and fixes the one colour that failed. The light scheme is untouched.

## Changes
- `theme/tokens.json`, `dark.text.muted`: **`#737373` → `#898989`** (the only change I made). Everything else in the owner's edit passed as written.

The owner's dark scheme, for the record: canvas `#161616`, panel `#222222`, raised `#2D2D2D`, sunken `#0A0A0A`, hover `rgba(255,255,255,0.08)`; borders `#333333` / `#454545` / `#737373`; text `#F0F0F0` / `#A3A3A3` / muted / `#161616`; status unchanged except `neutral #A3A3A3` and `neutralBg #222222`; accent unchanged.

## Decisions
- **`text.muted` had to move.** `#737373` measures **3.36:1** on `surface.panel` and **3.82:1** on `surface.canvas`, below the 4.5:1 AA floor for normal text (WCAG 1.4.3). Searched the greys upward from `#737373` for the first that clears 4.5:1 against *both* surfaces: `#898989` (**4.55:1** panel, **5.17:1** canvas). That is the closest passing shade, as asked — 22 steps lighter, still clearly a muted grey against `text.secondary` `#A3A3A3` (6.31:1).
- **Kept `#737373` for `border.interactive`.** The same grey the owner chose is fine there: it is a non-text boundary held to 3:1 (WCAG 1.4.11), and it measures 3.36/3.82. So the preferred colour survives where it is legal and only the *text* use moved.
- **No other token touched.** In particular the status colours, which were tuned against the navy panel, all still pass on `#222222` — they were re-measured, not assumed.
- Recorded the reason in a `$comment` beside the token, so the next person does not "restore" `#737373` for text without re-reading the measurement.

## Gaps found
- Nothing new. Worth noting that the deprecated `theme/colors.ts` shim reads straight from these tokens, so the pre-redesign screens automatically moved back to the old look: `background #161616` (was `#121212`), `surface #222222` (was `#1E1E1E`), `surfaceHighlight #2D2D2D` and `border #333333` (both exactly as before), `textPrimary #F0F0F0` (was `#EAEAEA`), `textSecondary #A3A3A3` (was `#A1A1AA`), `primary #00AAB9` (unchanged). No component edits were needed for that.

## Verification
- `npm run check:contrast` → **exit 0, 83/83 pairs pass** (was 81/83 with the owner's edit as received).
- `npm run lint` → **exit 0**, 0 errors / 50 warnings — unchanged from step 1.
- `npm run build` → **exit 0**, 7 routes.
- Visual: `/dev/theme` in the browser, dark resolved from `system`. The scheme now reads as neutral grey rather than navy; accent, status and document groups render correctly against it, and the document surface is still light.

§8 checks for this step: only **§8.3** applies (status colours distinguishable in both modes, documents stay light). Both re-checked above. The step changes no components, so §8.4 is unaffected and was not re-tested beyond the build.

## Next
**Step 2a-i** per AM4, starting immediately at the owner's request: `lib/jobs/*` (store, runners, sse, config), `lib/project-data/*`, the `api/types/*` they need, the H1 lost-human-flag fix, the H2 `CanonicalParameter.category` type, the upload `errors` type, `AbortController` on both streams, plus Vitest and the AM3 tests (job reducer, SSE→phase mapping, correction priority and per-project ordering, and the D11 regression). No UI rewiring; that is 2a-ii. CLAUDE.md §3 gains `npm test`.
