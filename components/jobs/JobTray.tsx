'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge, Box, Button, Divider, IconButton, List, ListItem, ListItemButton, ListItemText, Popover, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import { useJobs, useJobTray } from '@/lib/jobs/hooks';
import { keepOpenText } from '@/lib/jobs/closeGuard';
import { failedJobText, jobKindLabel } from '@/lib/jobs/label';
import { jobRuntime } from '@/lib/jobs/runtime';
import { finishedJobIds, trayEntries } from '@/lib/jobs/tray';
import type { Job } from '@/lib/jobs/types';
import { JobBadge, type BadgeKind } from './JobBadge';
import { useProjectsIndex } from '@/lib/project-data/provider';

const STATUS_BADGE: Partial<Record<Job['status'], BadgeKind>> = {
  running: 'running',
  queued: 'queued',
  failed: 'failed',
  interrupted: 'interrupted',
  completed: 'unseen',
};

/** The current time, refreshed every second while `active` (a completed job is still inside its short window). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Catch up at once, then tick; stops when nothing is waiting to leave the list.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    if (!active) return () => window.clearTimeout(first);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active]);
  return now;
}

function statusText(job: Job): string {
  switch (job.status) {
    case 'running': return `${jobKindLabel(job.kind)} · running`;
    case 'queued': return `${jobKindLabel(job.kind)} · queued`;
    case 'completed': return (job.uploadWarnings?.length ?? 0) > 0
      ? `Upload done · ${job.uploadWarnings!.length} not accepted`
      : `${jobKindLabel(job.kind)} · done`;
    case 'interrupted': return `${jobKindLabel(job.kind)} · interrupted`;
    case 'failed': return failedJobText(job);
    default: return jobKindLabel(job.kind);
  }
}

/**
 * Browser-wide background work, from the shell header.
 *
 * The cap is shared by every tab (CLAUDE.md 8.1), so "two other projects are
 * extracting" is something the user needs to be able to see from anywhere —
 * otherwise a queued job looks like nothing happening.
 *
 * Running and queued work is always listed. A completed job leaves by itself
 * after a short time; a failed or interrupted one stays until it is dismissed.
 * The list is capped, with a "+N more" line.
 */
export function JobTray() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const counts = useJobTray();
  const jobs = useJobs();
  const { projects } = useProjectsIndex();

  const hasRecentCompletion = jobs.some((j) => j.status === 'completed');
  const now = useNow(hasRecentCompletion);
  const { entries, more } = useMemo(() => trayEntries(jobs, now), [jobs, now]);
  const finished = finishedJobIds(jobs).length;

  const keepOpen = keepOpenText(jobs);
  const total = counts.running + counts.queued + counts.failed;
  const nameOf = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.alias_id ?? 'Project';

  return (
    <>
      <Tooltip title={total > 0 ? `${counts.running} running, ${counts.queued} queued${counts.failed > 0 ? `, ${counts.failed} failed` : ''}` : 'No background work'}>
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={`Background work: ${counts.running} running, ${counts.queued} queued, ${counts.failed} failed`}
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
        slotProps={{ paper: { sx: { width: 360, bgcolor: 'surface.raised' } } }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.muted' }}>
            Background work
          </Typography>
          {finished > 0 && (
            <Button size="small" color="inherit" onClick={() => void jobRuntime.clearFinished()}>
              Clear all finished
            </Button>
          )}
        </Box>
        <Divider />
        {keepOpen && (
          <Typography variant="caption" role="note" sx={{ display: 'block', px: 2, py: 0.75, bgcolor: 'status.infoBg', color: 'status.info', fontWeight: 600 }}>
            {keepOpen}
          </Typography>
        )}
        {entries.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nothing running.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }} aria-label="Background work">
            {entries.map((job) => {
              const dismissible = job.status !== 'running' && job.status !== 'queued';
              return (
                <ListItem
                  key={job.id}
                  disablePadding
                  secondaryAction={
                    dismissible ? (
                      <Tooltip title="Dismiss">
                        <IconButton edge="end" size="small" aria-label={`Dismiss: ${nameOf(job.projectId)}, ${statusText(job)}`} onClick={() => void jobRuntime.dismiss(job.id)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : undefined
                  }
                >
                  <ListItemButton component={Link} href={`/projects/${job.projectId}/workspace`} onClick={() => setAnchor(null)} sx={{ pr: dismissible ? 6 : 2 }}>
                    <Box sx={{ mr: 1.5 }}>
                      <JobBadge kind={STATUS_BADGE[job.status] ?? 'queued'} />
                    </Box>
                    <ListItemText
                      primary={nameOf(job.projectId)}
                      secondary={statusText(job)}
                      slotProps={{
                        primary: { variant: 'body2', noWrap: true },
                        secondary: { variant: 'caption', sx: { overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }, title: statusText(job) },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
        {more > 0 && (
          <Typography variant="caption" sx={{ display: 'block', px: 2, py: 1, color: 'text.secondary', borderTop: 1, borderColor: 'border.subtle' }}>
            +{more} more
          </Typography>
        )}
      </Popover>
    </>
  );
}
