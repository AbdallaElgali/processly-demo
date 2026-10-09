// Typed view over theme/tokens.json, plus the non-colour tokens.
//
// tokens.json is the single source of truth for colour and is shared with
// scripts/contrast-check.mjs, which asserts the WCAG ratios in CLAUDE.md 8.3.
// Change a colour there, then re-run `npm run check:contrast`.

import raw from './tokens.json';

export interface AccentTokens {
  /** Filled controls (buttons, progress). Light mode uses a darker cyan so its label passes AA. */
  fill: string;
  fillHover: string;
  /** Untouched brand cyan. Decoration and the logo only -- it is 2.8:1 on white. */
  brand: string;
  /** Links, accent text and icons on a surface. */
  text: string;
  /** Focus ring. */
  focus: string;
  /** Selected rows, active nav backgrounds. */
  tint: string;
  /** Text/icon colour on top of `fill`. */
  onFill: string;
}

export interface SurfaceTokens {
  canvas: string;
  panel: string;
  raised: string;
  sunken: string;
  hover: string;
}

export interface BorderTokens {
  subtle: string;
  strong: string;
  /** Boundaries that identify a control (input outlines). Meets 3:1. */
  interactive: string;
}

export interface StatusTokens {
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
  neutral: string;
  neutralBg: string;
  modified: string;
}

export interface DocumentTokens {
  canvas: string;
  page: string;
  gridLine: string;
  headerCell: string;
  text: string;
  highlightStroke: string;
  highlightFill: string;
  highlightDim: string;
  highlightPageOutline: string;
}

export interface ModeTokens {
  accent: AccentTokens;
  surface: SurfaceTokens;
  border: BorderTokens;
  text: { primary: string; secondary: string; muted: string; inverse: string };
  status: StatusTokens;
}

export const tokens: { light: ModeTokens; dark: ModeTokens; document: DocumentTokens } = raw;

/** Layout rhythm. MUI spacing(1) = 8px. */
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const;

/**
 * Motion. CLAUDE.md 8.4 caps transitions at 200ms; `slow` is that ceiling.
 * Every duration here is disabled under prefers-reduced-motion by the
 * CssBaseline override in theme.ts.
 */
export const motion = {
  fast: 120,
  base: 160,
  slow: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/**
 * Elevation. Light mode uses shadows; dark mode expresses depth with
 * `surface.raised` plus a border instead, because shadows are invisible on a
 * near-black canvas.
 */
export const shadow = {
  light: {
    sm: '0 1px 2px rgba(16, 24, 40, 0.06)',
    md: '0 4px 12px rgba(16, 24, 40, 0.08)',
    lg: '0 12px 32px rgba(16, 24, 40, 0.12)',
  },
  dark: { sm: 'none', md: 'none', lg: 'none' },
} as const;
