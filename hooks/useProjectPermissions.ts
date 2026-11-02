import { useCallback, useEffect, useState } from 'react';
import { fetchMyAccess } from '@/api/roles';
import { LOADING_ACCESS, type ProjectAccess } from '@/lib/permissions/access';

/**
 * The signed-in person's role and permissions in one project
 * (`GET /projects/{id}/me`). `loading` until the answer arrives, so editing
 * controls start disabled. The result is kept per project: switching project
 * shows `loading` again instead of the previous project's answer.
 */
export function useProjectPermissions(projectId: string | undefined, userId: string | undefined): { access: ProjectAccess; reload: () => Promise<void> } {
  const key = `${userId ?? ''}:${projectId ?? ''}`;
  const [state, setState] = useState<{ key: string; access: ProjectAccess }>({ key, access: LOADING_ACCESS });

  useEffect(() => {
    if (!projectId || !userId) return;
    const controller = new AbortController();
    fetchMyAccess(projectId, controller.signal)
      .then((access) => setState({ key, access }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, access: { status: 'denied', reason: 'Your permissions could not be loaded.' } });
      });
    return () => controller.abort();
  }, [projectId, userId, key]);

  /** Asks again without going back to `loading`, so controls do not flash disabled (a member change may have changed the caller's role). */
  const reload = useCallback(async () => {
    if (!projectId || !userId) return;
    try {
      setState({ key, access: await fetchMyAccess(projectId) });
    } catch {
      setState({ key, access: { status: 'denied', reason: 'Your permissions could not be loaded.' } });
    }
  }, [projectId, userId, key]);

  return { access: state.key === key ? state.access : LOADING_ACCESS, reload };
}
