'use client';

import { ReactNode, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { jobRuntime } from '@/lib/jobs/runtime';
import { jobStore } from '@/lib/jobs/store';
import { fetchProjects } from './actions';
import { projectsIndex } from './projects-index';
import { projectDataStore } from './store';
import { documentFiles } from '@/lib/documents/fileStore';
import { clearWorkbookCache } from '@/lib/excel/cache';

/**
 * Replaces ProjectProvider.
 *
 * It provides no context value: both stores are module singletons that
 * components read through useSyncExternalStore. This component only owns the
 * lifecycle that used to live in ProjectContext's effects -- load the user's
 * projects, and drop every cached project when the user changes, so one
 * engineer never sees another's data.
 */
export function ProjectDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Adopts the queue left by the previous session, takes this tab's lock and
  // joins the cross-tab channel. Idempotent.
  useEffect(() => {
    void jobRuntime.start();
  }, []);

  useEffect(() => {
    jobRuntime.setUserId(userId);

    if (!userId) {
      // Sign-out: stop everything in flight and clear the caches.
      jobStore.abortAll();
      projectDataStore.reset();
      documentFiles.reset();
      clearWorkbookCache();
      projectsIndex.reset();
      return;
    }

    void fetchProjects(userId);
  }, [userId]);

  // Lets the runtime decide whether a finished job's results are already
  // visible, without the runtime importing selection state.
  useEffect(() => {
    jobRuntime.isProjectOnScreen = (projectId) =>
      projectsIndex.getSnapshot().activeProjectId === projectId;
  }, []);

  return <>{children}</>;
}

/** The user's projects, plus which one is selected. */
export function useProjectsIndex() {
  return useSyncExternalStore(
    projectsIndex.subscribe,
    projectsIndex.getSnapshot,
    projectsIndex.getServerSnapshot,
  );
}
