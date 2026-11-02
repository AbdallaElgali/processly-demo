'use client';

import { createContext, ReactNode, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { canUnflag, controlState, LOADING_ACCESS, type Control, type ControlState, type ProjectAccess, type Role } from '@/lib/permissions/access';

const AccessContext = createContext<ProjectAccess>(LOADING_ACCESS);

/** One permissions request per open project, shared by every screen in it. */
export function ProjectAccessProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { user } = useAuth();
  const access = useProjectPermissions(projectId, user?.id);
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export const useProjectAccess = (): ProjectAccess => useContext(AccessContext);

/** Enabled/disabled and the tooltip for one control. */
export const useControl = (control: Control): ControlState => controlState(useProjectAccess(), control);

export function useMyRole(): Role | null {
  const access = useProjectAccess();
  return access.status === 'ready' ? access.role : null;
}

/** Whether the signed-in person may remove a flag raised by `flaggerId`. */
export function useCanUnflag(flaggerId: string | null): boolean {
  const access = useProjectAccess();
  const { user } = useAuth();
  return canUnflag(access, flaggerId, user?.id ?? null);
}
