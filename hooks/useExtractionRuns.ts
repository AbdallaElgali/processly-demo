'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGetExtractionRuns } from '@/api/projects';
import type { ExtractionRun } from '@/api/types/projects';
import { errorMessage } from '@/lib/errors';

/**
 * `GET /projects/{id}/extraction-runs`, newest first (the backend orders it).
 * `refreshKey` re-fetches when it changes, e.g. when a job of the project
 * settles, so the Overview shows the run that just finished. State is only
 * set inside the promise callbacks (react-hooks/set-state-in-effect), and a
 * re-fetch keeps showing the previous runs rather than flashing a skeleton.
 */
export function useExtractionRuns(projectId: string, refreshKey: string | number = 0) {
  const [state, setState] = useState<{ projectId: string; runs: ExtractionRun[] | null; error: string | null }>({
    projectId,
    runs: null,
    error: null,
  });

  const load = useCallback(() => {
    let live = true;
    apiGetExtractionRuns(projectId)
      .then((runs) => live && setState({ projectId, runs, error: null }))
      .catch((e) => live && setState((s) => ({ projectId, runs: s.projectId === projectId ? s.runs : null, error: errorMessage(e, 'Failed to load extraction runs.') })));
    return () => {
      live = false;
    };
  }, [projectId]);

  useEffect(() => load(), [load, refreshKey]);

  const current = state.projectId === projectId ? state : { runs: null, error: null };
  return { runs: current.runs, error: current.error, loading: current.runs === null && current.error === null, reload: load };
}
