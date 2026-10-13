// Layout constants shared by the shell and the screens.
//
// These were scattered as magic numbers across app/bda/page.tsx,
// app/review/page.tsx and hooks/Resizer.tsx (SIDEBAR_WIDTH, TOOLBAR_WIDTH,
// MIN_VIEWER_WIDTH, MIN_MAIN_WIDTH, each redeclared per file). The shell built
// in step 3 reads them from here instead.

export const layout = {
  /** Shell header height. */
  headerHeight: 56,
  /** Project rail, expanded and collapsed-to-icons. */
  railWidth: 240,
  railWidthCollapsed: 64,
  /** Review split pane: default share for the parameter table, and the floor for either pane. */
  splitDefaultRatio: 0.55,
  splitMinPane: 360,
  /** Below this the rail becomes a drawer. Laptop widths are in scope, phones are not. */
  railDrawerBreakpoint: 1024,
} as const;
