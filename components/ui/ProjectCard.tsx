'use client';

import Link from 'next/link';
import { Card, CardActionArea, Stack, Typography } from '@mui/material';
import { JobBadge, activityBadge } from '@/components/jobs/JobBadge';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { StatusChip } from './StatusChip';
import type { ProjectBase } from '@/api/types/projects';

/**
 * One project in the `/projects` grid. Separate from the page so each card
 * subscribes to only its own project's activity (CLAUDE.md 8.1) — a running
 * job on one project never re-renders the rest of the grid.
 *
 * Counts (documents, parameters) are deliberately absent: they need
 * `GET /projects/{id}` per card, which step 6 adds as a lazy, capped fetch so
 * the list never waits on it.
 */
export function ProjectCard({
  project,
  customerName,
}: {
  project: ProjectBase;
  customerName?: string;
}) {
  const activity = useProjectActivity(project.id);
  const badge = activityBadge(activity);

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
          <StatusChip status={project.status} />
          <Typography variant="caption" sx={{ color: 'text.muted' }}>
            {project.created_at ? new Date(project.created_at).toLocaleDateString() : ''}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
