'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';

import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useCustomers } from '@/hooks/Customers';
import { AppHeader } from '@/components/shell/AppHeader';
import { NewProjectDialog } from '@/components/projects/NewProjectDialog';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonCardGrid } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProjectsIndex } from '@/lib/project-data/provider';

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

        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name, customer or status"
          sx={{ mb: 3 }}
        />

        {error && (
          <Typography variant="body2" sx={{ color: 'status.danger', mb: 2 }}>{error}</Typography>
        )}

        {loading && projects.length === 0 ? (
          <SkeletonCardGrid />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpenOutlinedIcon}
            title={projects.length === 0 ? 'No projects yet' : 'Nothing matches that search'}
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
            secondaryAction={projects.length > 0 ? { label: 'Clear search', onClick: () => setQuery('') } : undefined}
          />
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
