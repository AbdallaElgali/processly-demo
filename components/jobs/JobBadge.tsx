'use client';

import { Box, Tooltip } from '@mui/material';
import type { ProjectActivity } from '@/lib/jobs/hooks';

export type BadgeKind = 'running' | 'queued' | 'unseen' | 'failed' | 'interrupted';

const STYLES: Record<BadgeKind, { color: string; label: string }> = {
  running: { color: 'status.info', label: 'Running' },
  queued: { color: 'status.neutral', label: 'Queued' },
  unseen: { color: 'status.success', label: 'New results' },
  failed: { color: 'status.danger', label: 'Failed' },
  interrupted: { color: 'status.warning', label: 'Interrupted' },
};

/** Highest-priority state first: a failure matters more than a pending result. */
export function activityBadge(activity: ProjectActivity): BadgeKind | null {
  if (activity.failed.length > 0) return 'failed';
  if (activity.interrupted.length > 0) return 'interrupted';
  if (activity.running) return 'running';
  if (activity.queued) return 'queued';
  if (activity.unseenCompleted.length > 0) return 'unseen';
  return null;
}

/**
 * A project's background-work state (CLAUDE.md 8.1: loading is shown where the
 * work is). Never colour alone — the tooltip and aria-label carry the meaning,
 * which is also what 8.3 requires for status colours.
 */
export function JobBadge({ kind, size = 8 }: { kind: BadgeKind; size?: number }) {
  const { color, label } = STYLES[kind];
  return (
    <Tooltip title={label}>
      <Box
        role="img"
        aria-label={label}
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
          // A running job pulses so it reads as live, but only when the viewer
          // has not asked for reduced motion (8.4).
          ...(kind === 'running' && {
            animation: 'bdaPulse 1.6s ease-in-out infinite',
            '@keyframes bdaPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.35 },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }),
        }}
      />
    </Tooltip>
  );
}
