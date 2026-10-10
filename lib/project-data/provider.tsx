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
import { matchNav } from '@/lib/excel/matchNav';
import { toast } from '@/components/ui/Toast';

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
      matchNav.reset();
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
    // A re-extraction is the one job a reviewer waits on for a single row, so
    // its end gets a short notice. Other jobs already show in the tray and
    // the rail badges.
    jobRuntime.onJobSettled = (job, outcome) => {
      if (job.payload.kind !== 'correction') return;
      const key = job.payload.parameterKey;
      const onScreen = projectsIndex.getSnapshot().activeProjectId === job.projectId;
      const alias = projectsIndex.getSnapshot().projects.find((p) => p.id === job.projectId)?.alias_id;
      const where = onScreen || !alias ? key : `${alias} · ${key}`;
      if (outcome.ok) {
        toast.show(`${where} re-extracted. Its flag stays open until you accept a value or remove the flag.`, { severity: 'success' });
      } else if (outcome.error !== 'Cancelled.') {
        toast.show(`Re-extracting ${where} failed: ${outcome.error ?? 'unknown error'}. Nothing was saved.`, { severity: 'error' });
      }
    };
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
