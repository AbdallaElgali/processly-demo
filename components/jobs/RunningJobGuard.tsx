'use client';

import { useEffect } from 'react';
import { jobStore } from '@/lib/jobs/store';
import { closeWarningHandler } from '@/lib/jobs/closeGuard';

/**
 * Makes the browser ask before the tab is closed or reloaded while an
 * extraction or correction runs (backend X3: closing the tab cancels the
 * analysis and nothing is saved). The handler reads the job store when the
 * event fires, so it is attached once and is silent when nothing runs.
 * Mounted once at the root; renders nothing.
 */
export function RunningJobGuard() {
  useEffect(() => {
    const handler = closeWarningHandler(() => jobStore.getSnapshot().jobs);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  return null;
}
