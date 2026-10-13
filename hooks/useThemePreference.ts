'use client';

import { useCallback } from 'react';
import { useColorScheme } from '@mui/material/styles';
import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from './useHasMounted';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODES: ThemeMode[] = ['light', 'dark', 'system'];

const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && (MODES as string[]).includes(value);

/**
 * The app's theme preference (CLAUDE.md 8.3).
 *
 * MUI owns the local half: it persists `mode` to localStorage and applies it to
 * <html> before paint. This hook adds the backend half, writing the choice to
 * `user_settings.theme` via PUT /auth/update-user-settings whenever a user is
 * known. When nobody is logged in the choice stays local, which is the
 * documented fallback.
 *
 * `mode` is undefined until after hydration (the server cannot know the OS
 * preference), so `ready` tells callers to render a stable placeholder rather
 * than guess and cause a hydration mismatch.
 */
export function useThemePreference() {
  const { mode, setMode } = useColorScheme();
  const { user, updateUserSettings } = useAuth();
  const hasMounted = useHasMounted();

  const setThemeMode = useCallback(
    (next: ThemeMode) => {
      setMode(next);

      // Fire-and-forget: the UI has already changed, and a failed sync must not
      // block or revert it. The local value remains correct either way.
      if (user) {
        updateUserSettings({ theme: next }).catch((error: unknown) => {
          console.error('Failed to persist theme preference', error);
        });
      }
    },
    [setMode, user, updateUserSettings],
  );

  const current: ThemeMode = isThemeMode(mode) ? mode : 'system';

  return {
    /** Current preference. Treat as meaningless until `ready`. */
    mode: current,
    /** False during SSR and the first client render. */
    ready: hasMounted,
    setThemeMode,
    /** Advance light -> dark -> system, for the header quick toggle. */
    cycleThemeMode: useCallback(() => {
      setThemeMode(MODES[(MODES.indexOf(current) + 1) % MODES.length]);
    }, [current, setThemeMode]),
  };
}
