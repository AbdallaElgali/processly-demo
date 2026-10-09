'use client';

import { Chip } from '@mui/material';
import type { ProjectStatus } from '@/api/types/projects';

/**
 * A project's lifecycle status (`NEW / PENDING_REVIEW / IN_REVIEW / APPROVED`).
 * Extracted from the projects list (step 3) so Overview and other screens can
 * show the same chip instead of redeclaring the colour map.
 */
const STATUS_STYLE: Record<ProjectStatus, { bg: string; fg: string; label: string }> = {
  NEW: { bg: 'status.neutralBg', fg: 'status.neutral', label: 'New' },
  PENDING_REVIEW: { bg: 'status.warningBg', fg: 'status.warning', label: 'Pending review' },
  IN_REVIEW: { bg: 'status.infoBg', fg: 'status.info', label: 'In review' },
  APPROVED: { bg: 'status.successBg', fg: 'status.success', label: 'Approved' },
};

export function StatusChip({ status, size = 'small' }: { status: ProjectStatus; size?: 'small' | 'medium' }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.NEW;
  return (
    <Chip
      size={size}
      label={style.label}
      sx={{ bgcolor: style.bg, color: style.fg, fontWeight: 600 }}
    />
  );
}
