'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { jobStore } from './store';
import { projectDataStore } from '@/lib/project-data/store';
import { canStart, queuePosition } from './ordering';
import type { Job, JobKind } from './types';
import { isActive, isQueued } from './types';

const EMPTY: Job[] = [];

/** All jobs. Prefer a narrower selector below; this re-renders on any change. */
export function useJobs(): Job[] {
  return useSyncExternalStore(
    jobStore.subscribe,
    () => jobStore.getSnapshot().jobs,
    () => EMPTY,
  );
}

export interface ProjectActivity {
  running?: Job;
  queued?: { job: Job; position: number };
  unseenCompleted: Job[];
  failed: Job[];
  interrupted: Job[];
}

/**
 * Everything a project's badge needs (CLAUDE.md 8.1: loading is shown where
 * the work is, never as an app-wide state).
 */
export function useProjectActivity(projectId: string | null): ProjectActivity {
  const jobs = useJobs();

  if (!projectId) {
    return { unseenCompleted: [], failed: [], interrupted: [] };
  }

  const mine = jobs.filter((j) => j.projectId === projectId);
  const queuedJob = mine.find(isQueued);

  return {
    running: mine.find(isActive),
    queued: queuedJob
      ? { job: queuedJob, position: queuePosition(jobs, queuedJob.id) ?? 1 }
      : undefined,
    unseenCompleted: mine.filter((j) => j.status === 'completed' && !j.seen),
    failed: mine.filter((j) => j.status === 'failed'),
    interrupted: mine.filter((j) => j.status === 'interrupted'),
  };
}

/** Browser-wide counts for the header job tray. */
export function useJobTray() {
  const jobs = useJobs();
  return {
    running: jobs.filter(isActive).length,
    queued: jobs.filter(isQueued).length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };
}

/** Whether this project may start work of a given kind, and why not. */
export function useCanStart(projectId: string | null, kind: JobKind) {
  const jobs = useJobs();
  if (!projectId) return { allowed: false as const, reason: 'No project selected.' };
  return canStart(jobs, projectId, kind);
}

/** One project's data. Never shared between projects -- see the D11 fix. */
export function useProjectData(projectId: string | null) {
  const subscribe = projectDataStore.subscribe;
  const getSnapshot = useCallback(
    () => (projectId ? projectDataStore.get(projectId) : null),
    [projectId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
