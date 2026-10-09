import { tokens } from './tokens';

/**
 * @deprecated Compatibility shim. Do not import in new code.
 *
 * Screens written before the redesign import these as raw colour literals
 * (`sx={{ bgcolor: colors.surface }}`), which is exactly what CLAUDE.md 8.3
 * forbids: a literal cannot follow the colour scheme, so those screens stay
 * dark-styled in light mode until their own step rewrites them onto palette
 * tokens (`sx={{ bgcolor: 'surface.panel' }}` / `theme.vars.palette.*`).
 *
 * The values below are the DARK token values, so the pre-redesign screens keep
 * rendering exactly as they did. They are deliberately plain hex, not
 * `var(--mui-palette-*)`: several call sites pass them through MUI's `alpha()`
 * or concatenate an alpha suffix (`${colors.border}40`), and both throw or
 * silently break on a CSS variable.
 *
 * Deleted in the final step of Task A, once no component imports it. An ESLint
 * rule warns on new imports today and becomes an error then.
 */
export const colors = {
  primary: tokens.dark.accent.fill,
  primaryHover: tokens.dark.accent.fillHover,
  darkTeal: '#00444a',
  /** Was a purple secondary. D1 removed the second accent; mapped onto the accent. */
  secondary: tokens.dark.accent.text,

  background: tokens.dark.surface.canvas,
  surface: tokens.dark.surface.panel,
  surfaceHighlight: tokens.dark.surface.raised,

  textPrimary: tokens.dark.text.primary,
  textSecondary: tokens.dark.text.secondary,

  border: tokens.dark.border.subtle,

  success: tokens.dark.status.success,
  error: tokens.dark.status.danger,
  warning: tokens.dark.status.warning,
};
