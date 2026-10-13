'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';

import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';
import { AppHeader } from '@/components/shell/AppHeader';
import { NewProjectDialog } from '@/components/projects/NewProjectDialog';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonCardGrid } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { GuidedTour } from '@/components/ui/GuidedTour';
import { PROJECT_STATUS_ORDER, projectStatusLabel } from '@/components/ui/StatusChip';
import { fetchProjects } from '@/lib/project-data/actions';
import { useProjectsIndex } from '@/lib/project-data/provider';
import type { ProjectStatus } from '@/api/types/projects';

const PROJECTS_TOUR_STEPS = [
  {
    target: '[data-tour="new-project-button"]',
    title: 'Start a project',
    body: 'Each project keeps its own documents, extraction runs and parameters. Upload datasheets here and the extraction runs in the background — you can switch away any time.',
  },
];

/** The projects list (RFC section 2's Home, decision D4). */
export default function ProjectsPage() {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const { user, isLoading: authLoading } = useAuth();
  const { projects, loading, error } = useProjectsIndex();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<ProjectStatus>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [hasMounted, authLoading, user, router]);

  const toggleStatus = (status: ProjectStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter.size > 0 && !statusFilter.has(p.status)) return false;
      if (!q) return true;
      return (
        p.alias_id?.toLowerCase().includes(q) ||
        (p.customer ?? '').toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q)
      );
    });
  }, [projects, query, statusFilter]);

  if (!hasMounted || !user) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: 'surface.canvas' }}>
      <AppHeader />

      <Box component="main" sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
        <Stack direction="row" alignItems="flex-start" sx={{ mb: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ color: 'text.primary' }}>Projects</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Each project has its own documents, parameters and extraction runs.
            </Typography>
          </Box>
          <Button
            data-tour="new-project-button"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New project
          </Button>
        </Stack>

        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name, customer or status"
          sx={{ mb: 2 }}
        />

        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            size="small"
            color={statusFilter.size === 0 ? 'primary' : 'default'}
            variant={statusFilter.size === 0 ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter(new Set())}
          />
          {PROJECT_STATUS_ORDER.map((status) => (
            <Chip
              key={status}
              label={projectStatusLabel(status)}
              size="small"
              color={statusFilter.has(status) ? 'primary' : 'default'}
              variant={statusFilter.has(status) ? 'filled' : 'outlined'}
              onClick={() => toggleStatus(status)}
            />
          ))}
        </Stack>

        {error && projects.length > 0 && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => void fetchProjects(user.id)}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {error && projects.length === 0 ? (
          <ErrorState
            title="Couldn't load your projects"
            description={error}
            onRetry={() => void fetchProjects(user.id)}
          />
        ) : loading && projects.length === 0 ? (
          <SkeletonCardGrid />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpenOutlinedIcon}
            title={projects.length === 0 ? 'No projects yet' : 'Nothing matches that filter'}
            description={
              projects.length === 0
                ? 'Create a project, upload its datasheets, and run an extraction.'
                : 'Try a different name, customer or status.'
            }
            action={
              projects.length === 0
                ? { label: 'New project', onClick: () => setDialogOpen(true) }
                : undefined
            }
            secondaryAction={
              projects.length > 0
                ? { label: 'Clear filters', onClick: () => { setQuery(''); setStatusFilter(new Set()); } }
                : undefined
            }
          />
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                customerName={p.customer ?? undefined}
              />
            ))}
          </Box>
        )}
      </Box>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(projectId) => {
          setDialogOpen(false);
          router.push(`/projects/${projectId}/workspace`);
        }}
      />

      <GuidedTour steps={PROJECTS_TOUR_STEPS} storageKey="projects.tour.dismissed" />
    </Box>
  );
}
