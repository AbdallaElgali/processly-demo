'use client';

import { ReactNode, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useLocalStorageFlag } from '@/hooks/useLocalStorageFlag';
import { AppHeader } from '@/components/shell/AppHeader';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { ProjectRail } from '@/components/shell/ProjectRail';
import { useProjectData } from '@/lib/jobs/hooks';
import { loadProjectDetails } from '@/lib/project-data/actions';
import { projectsIndex } from '@/lib/project-data/projects-index';
import { useProjectsIndex } from '@/lib/project-data/provider';
import { ToastHost } from '@/components/ui/Toast';
import { UnsavedChangesGuard } from '@/components/workspace/UnsavedChangesGuard';

const RAIL_COLLAPSED_KEY = 'bda.rail.collapsed';

/**
 * The project shell (decision D4): header with breadcrumb, project rail, and
 * the active screen. One mount for every project tab, so switching tabs does
 * not rebuild the chrome.
 */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const hasMounted = useHasMounted();
  const { user, isLoading: authLoading } = useAuth();
  const { projects } = useProjectsIndex();
  const projectState = useProjectData(projectId);
  const details = projectState?.details ?? null;

  // Remembered across sessions and shared with other tabs.
  const [collapsed, setCollapsed] = useLocalStorageFlag(RAIL_COLLAPSED_KEY, false);
  const toggleCollapsed = () => setCollapsed(!collapsed);

  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [hasMounted, authLoading, user, router]);

  // The URL is the source of truth for which project is open (D4). The index
  // is told, so badges and the job tray agree with the address bar.
  useEffect(() => {
    if (!projectId) return;
    projectsIndex.setActive(projectId);
    if (!details) void loadProjectDetails(projectId);
  }, [projectId, details]);

  if (!hasMounted || !user) return null;

  // The payload carries the customer's alias since backend step 3.5. The list
  // entry covers the moment before the details have loaded. No customer: the
  // project is shown alone.
  const customerName =
    details?.customer ?? projects.find((p) => p.id === projectId)?.customer ?? null;

  const projectName =
    details?.alias_id ?? projects.find((p) => p.id === projectId)?.alias_id ?? null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', bgcolor: 'surface.canvas' }}>
      <AppHeader breadcrumb={<Breadcrumb customer={customerName} project={projectName} />} />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ProjectRail projectId={projectId} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
      {/* One toast queue for every project screen; job runners and screens both post to it. */}
      <ToastHost />
      <UnsavedChangesGuard projectId={projectId} />
    </Box>
  );
}
