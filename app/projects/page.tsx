'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box, Button, Card, CardActionArea, Chip, InputAdornment, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';

import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useCustomers } from '@/hooks/Customers';
import { AppHeader } from '@/components/shell/AppHeader';
import { NewProjectDialog } from '@/components/projects/NewProjectDialog';
import { JobBadge, activityBadge } from '@/components/jobs/JobBadge';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { useProjectsIndex } from '@/lib/project-data/provider';
import type { ProjectBase, ProjectStatus } from '@/api/types/projects';

const STATUS_STYLE: Record<ProjectStatus, { bg: string; fg: string }> = {
  NEW: { bg: 'status.neutralBg', fg: 'status.neutral' },
  PENDING_REVIEW: { bg: 'status.warningBg', fg: 'status.warning' },
  IN_REVIEW: { bg: 'status.infoBg', fg: 'status.info' },
  APPROVED: { bg: 'status.successBg', fg: 'status.success' },
};

/** One card. Separate so each subscribes to only its own project's activity. */
function ProjectCard({ project, customerName }: { project: ProjectBase; customerName?: string }) {
  const activity = useProjectActivity(project.id);
  const badge = activityBadge(activity);
  const style = STATUS_STYLE[project.status as ProjectStatus] ?? STATUS_STYLE.NEW;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'border.subtle',
        bgcolor: 'surface.panel',
        transition: (t) => t.transitions.create(['border-color', 'box-shadow']),
        '&:hover': { borderColor: 'accent.fill' },
      }}
    >
      <CardActionArea component={Link} href={`/projects/${project.id}/overview`} sx={{ p: 2, height: '100%' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Typography variant="h6" noWrap sx={{ color: 'text.primary', flex: 1 }} title={project.alias_id}>
            {project.alias_id}
          </Typography>
          {badge && <JobBadge kind={badge} />}
        </Stack>

        <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', minHeight: 18 }} noWrap>
          {customerName ?? '—'}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            label={project.status.replace(/_/g, ' ').toLowerCase()}
            sx={{ bgcolor: style.bg, color: style.fg, textTransform: 'capitalize' }}
          />
          <Typography variant="caption" sx={{ color: 'text.muted' }}>
            {project.created_at ? new Date(project.created_at).toLocaleDateString() : ''}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

/**
 * The projects list (RFC section 2's Home, decision D4).
 *
 * Counts per project are deliberately absent: they need GET /projects/{id} per
 * card, and the plan defers that lazy fetch to step 6. Showing a made-up
 * number would be worse than showing none.
 */
export default function ProjectsPage() {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const { user, isLoading: authLoading } = useAuth();
  const { projects, loading, error } = useProjectsIndex();
  const { customers, loadCustomers } = useCustomers();
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [hasMounted, authLoading, user, router]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c.alias_name])),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      p.alias_id?.toLowerCase().includes(q) ||
      (p.customer_id ? (customerById.get(p.customer_id) ?? '').toLowerCase().includes(q) : false) ||
      p.status?.toLowerCase().includes(q),
    );
  }, [projects, query, customerById]);

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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            New project
          </Button>
        </Stack>

        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, customer or status"
          size="small"
          sx={{ mb: 3, maxWidth: 420, width: '100%' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.muted' }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {error && (
          <Typography variant="body2" sx={{ color: 'status.danger', mb: 2 }}>{error}</Typography>
        )}

        {loading && projects.length === 0 ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={132} />
            ))}
          </Box>
        ) : filtered.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 8, textAlign: 'center' }}>
            <FolderOpenOutlinedIcon sx={{ fontSize: 40, color: 'text.muted' }} />
            <Typography variant="h6" sx={{ color: 'text.primary' }}>
              {projects.length === 0 ? 'No projects yet' : 'Nothing matches that search'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
              {projects.length === 0
                ? 'Create a project, upload its datasheets, and run an extraction.'
                : 'Try a different name, customer or status.'}
            </Typography>
            {projects.length === 0 ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                New project
              </Button>
            ) : (
              <Button onClick={() => setQuery('')}>Clear search</Button>
            )}
          </Stack>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                customerName={p.customer_id ? customerById.get(p.customer_id) : undefined}
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
          router.push(`/projects/${projectId}/extract`);
        }}
      />
    </Box>
  );
}
