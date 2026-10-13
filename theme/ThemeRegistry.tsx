'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';

/**
 * The app's single ThemeProvider.
 *
 * Before the redesign every page mounted its own ThemeProvider + CssBaseline
 * (app/bda, app/review x3, app/admin, app/login, NoProjectsScreen), so a theme
 * change could not propagate and each early-return branch re-mounted the tree.
 * It is mounted once here, above the routes, in app/layout.tsx.
 */
export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
