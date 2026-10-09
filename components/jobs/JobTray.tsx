'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Badge, Box, Divider, IconButton, List, ListItemButton, ListItemText, Popover, Tooltip, Typography,
} from '@mui/material';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import { useJobs, useJobTray } from '@/lib/jobs/hooks';
import { JobBadge, type BadgeKind } from './JobBadge';
import { useProjectsIndex } from '@/lib/project-data/provider';

const STATUS_BADGE: Record<string, BadgeKind> = {
  running: 'running',
  queued: 'queued',
  failed: 'failed',
  interrupted: 'interrupted',
};

/**
 * Browser-wide background work, from the shell header.
 *
 * The cap is shared by every tab (CLAUDE.md 8.1), so "two other projects are
 * extracting" is something the user needs to be able to see from anywhere —
 * otherwise a queued job looks like nothing happening.
 */
export function JobTray() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const counts = useJobTray();
  const jobs = useJobs();
  const { projects } = useProjectsIndex();

  const active = jobs.filter((j) => STATUS_BADGE[j.status]);
  const total = counts.running + counts.queued + counts.failed;
  const nameOf = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.alias_id ?? 'Project';

  return (
    <>
      <Tooltip title={total > 0 ? `${counts.running} running, ${counts.queued} queued` : 'No background work'}>
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={`Background work: ${counts.running} running, ${counts.queued} queued`}
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          sx={{ color: 'text.secondary' }}
        >
          <Badge
            badgeContent={total}
            invisible={total === 0}
            sx={{ '& .MuiBadge-badge': { bgcolor: 'accent.fill', color: 'accent.onFill' } }}
          >
            <WorkHistoryOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 320, bgcolor: 'surface.raised' } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.muted' }}>
            Background work
          </Typography>
        </Box>
        <Divider />
        {active.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nothing running.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }}>
            {active.map((job) => (
              <ListItemButton
                key={job.id}
                component={Link}
                href={`/projects/${job.projectId}/extract`}
                onClick={() => setAnchor(null)}
              >
                <Box sx={{ mr: 1.5 }}>
                  <JobBadge kind={STATUS_BADGE[job.status]} />
                </Box>
                <ListItemText
                  primary={nameOf(job.projectId)}
                  secondary={`${job.kind} · ${job.status}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
