'use client';

import { createTheme } from '@mui/material/styles';
import { tokens, radius, motion, shadow } from './tokens';

// Opting in to CSS theme variables makes `theme.vars.*` non-optional and emits
// one stylesheet per colour scheme, so switching modes is an attribute flip on
// <html> rather than a React re-render of the tree.
declare module '@mui/material/styles' {
  interface CssThemeVariables {
    enabled: true;
  }
}

// Semantic tokens live on the palette so components can say
// `sx={{ bgcolor: 'surface.panel' }}` and never name a raw colour
// (CLAUDE.md 8.3). Both schemes define every key, so there is no mode in which
// a token is missing.
declare module '@mui/material/styles' {
  interface Palette {
    accent: typeof tokens.light.accent;
    surface: typeof tokens.light.surface;
    border: typeof tokens.light.border;
    status: typeof tokens.light.status;
    /** Mode-invariant: the document stays light in both schemes. */
    document: typeof tokens.document;
  }
  interface PaletteOptions {
    accent?: typeof tokens.light.accent;
    surface?: typeof tokens.light.surface;
    border?: typeof tokens.light.border;
    status?: typeof tokens.light.status;
    document?: typeof tokens.document;
  }
  interface TypeText {
    muted: string;
    inverse: string;
  }
}

const paletteFor = (mode: 'light' | 'dark') => {
  const t = tokens[mode];
  return {
    mode,
    // `primary.main` is the filled-control colour; `primary.dark` is the
    // readable-on-surface shade, so MUI's own `color="primary"` text and links
    // pick a shade that passes AA instead of the fill.
    primary: {
      main: t.accent.fill,
      dark: t.accent.text,
      light: t.accent.fillHover,
      contrastText: t.accent.onFill,
    },
    success: { main: t.status.success },
    warning: { main: t.status.warning },
    error: { main: t.status.danger },
    info: { main: t.status.info },
    background: { default: t.surface.canvas, paper: t.surface.panel },
    text: {
      primary: t.text.primary,
      secondary: t.text.secondary,
      muted: t.text.muted,
      inverse: t.text.inverse,
      disabled: t.text.muted,
    },
    divider: t.border.subtle,
    action: { hover: t.surface.hover },
    accent: t.accent,
    surface: t.surface,
    border: t.border,
    status: t.status,
    document: tokens.document,
  };
};

export const theme = createTheme({
  cssVariables: {
    // Expands to [data-mui-color-scheme="light" | "dark"], which is exactly the
    // attribute InitColorSchemeScript sets before first paint.
    colorSchemeSelector: 'data-mui-color-scheme',
  },
  colorSchemes: {
    light: { palette: paletteFor('light') },
    dark: { palette: paletteFor('dark') },
  },
  shape: { borderRadius: radius.md },
  typography: {
    // Loaded by next/font in app/layout.tsx. Previously the theme asked for
    // Inter while the app loaded Geist, so neither was applied.
    fontFamily: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", sans-serif',
    h4: { fontSize: '1.5rem', lineHeight: 1.33, fontWeight: 600 },
    h5: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 600 },
    h6: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 600 },
    subtitle2: {
      fontSize: '0.8125rem',
      lineHeight: 1.54,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    },
    body1: { fontSize: '0.9375rem', lineHeight: 1.47 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.54 },
    caption: { fontSize: '0.75rem', lineHeight: 1.33 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  // MUI's defaults run up to 375ms; CLAUDE.md 8.4 caps motion at 200ms.
  transitions: {
    duration: {
      shortest: motion.fast,
      shorter: motion.fast,
      short: motion.base,
      standard: motion.base,
      complex: motion.slow,
      enteringScreen: motion.base,
      leavingScreen: motion.fast,
    },
    easing: { easeInOut: motion.easing, easeOut: motion.easing, easeIn: motion.easing },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (themeParam) => ({
        'html, body': { height: '100%', margin: 0, padding: 0 },
        body: { backgroundColor: themeParam.vars.palette.background.default },
        '#__next, #root': { height: '100%' },
        // One visible focus ring for everything, keyboard-only. MUI components
        // that draw their own focus styles still get this as a backstop.
        '*:focus-visible': {
          outline: `2px solid ${themeParam.vars.palette.accent.focus}`,
          outlineOffset: '2px',
        },
        // CLAUDE.md 8.4: motion is disabled, not merely shortened, for users
        // who ask for that. Covers CSS transitions, animations and smooth
        // scrolling, including those MUI applies inline.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      }),
    },
    MuiPaper: {
      styleOverrides: {
        // The old theme pinned every Paper to the dark surface colour, which
        // made a light mode impossible. Papers now follow background.paper.
        root: { backgroundImage: 'none' },
      },
    },
    // ButtonBase sets `outline: 0` in its own root styles, which has the same
    // specificity as the global `*:focus-visible` rule above and is injected
    // after it, so the global ring never reached a Button, IconButton, Chip,
    // Tab, MenuItem or ListItemButton -- they fell back to MUI's much fainter
    // focus-visible background tint. Re-applying it here, on the same class,
    // wins on both specificity and order.
    MuiButtonBase: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          '&:focus-visible': {
            outline: `2px solid ${t.vars.palette.accent.focus}`,
            outlineOffset: '2px',
          },
        }),
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: radius.md } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // border.interactive clears 3:1 (WCAG 1.4.11); MUI's default
        // rgba(0,0,0,0.23) outline does not.
        notchedOutline: ({ theme: t }) => ({ borderColor: t.vars.palette.border.interactive }),
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});

/** Elevation helper: shadows in light mode, bordered raised surfaces in dark. */
export const elevation = shadow;
