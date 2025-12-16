'use client';
import { createTheme } from '@mui/material/styles';
import { colors } from './colors';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: colors.primary },
    background: { default: colors.background, paper: colors.surface },
    text: { primary: colors.textPrimary, secondary: colors.textSecondary },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%', margin: 0, padding: 0 },
        body: { height: '100%', margin: 0, padding: 0, backgroundColor: colors.background },
        '#__next': { height: '100%' }, // If using Next.js
        '#root': { height: '100%' },   // If using pure React
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: colors.surface },
      },
    },
  },
});