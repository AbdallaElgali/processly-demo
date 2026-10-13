'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardActionArea, Skeleton, Stack, Typography } from '@mui/material';
import { JobBadge, activityBadge } from '@/components/jobs/JobBadge';
import { useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import { requestProjectCounts } from '@/lib/project-data/lazyDetails';
import { StatusChip } from './StatusChip';
import type { ProjectBase } from '@/api/types/projects';

/**
 * One project in the `/projects` grid. Separate from the page so each card
 * subscribes to only its own project's activity (CLAUDE.md 8.1) — a running
 * job on one project never re-renders the rest of the grid.
 *
 * Counts (documents, parameters with a value) come from `GET /projects/{id}`,
 * queued through `requestProjectCounts` -- a capped background fetch so a
 * long list never opens dozens of connections at once, and the grid itself
 * never waits on it (a skeleton line stands in until the project is cached).
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
  const data = useProjectData(project.id);

  useEffect(() => {
    requestProjectCounts(project.id);
  }, [project.id]);

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

        {data?.details ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            {data.details.documents.length} document{data.details.documents.length === 1 ? '' : 's'} ·{' '}
            {data.details.parameters.filter((p) => p.final_value !== null).length}/
            {data.details.parameters.length} parameters
          </Typography>
        ) : data?.error ? (
          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 1 }}>
            Counts unavailable
          </Typography>
        ) : (
          <Skeleton variant="text" width={140} sx={{ mt: 1 }} />
        )}
      </CardActionArea>
    </Card>
  );
}
