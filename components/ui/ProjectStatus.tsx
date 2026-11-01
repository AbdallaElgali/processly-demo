'use client';

import { Chip, Stack, Tooltip } from '@mui/material';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import { StatusChip } from './StatusChip';
import { statusDisplay, type StatusInfo } from '@/lib/approvals/view';

/**
 * A project's status in plain words: the chip carries the whole line
 * ("Approved · v2 · mia · 30.10.2026", "In review · changed since approval
 * v2"), and a status that was set by hand gets a small "set manually" marker
 * with a tooltip. The status itself is only ever shown, never set from here.
 */
export function ProjectStatus({ project, size = 'small' }: { project: StatusInfo; size?: 'small' | 'medium' }) {
  const d = statusDisplay(project);
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap', minWidth: 0 }}>
      <StatusChip status={project.status} size={size} label={d.line} />
      {d.manual && (
        <Tooltip title={d.manualTooltip}>
          <Chip
            size="small"
            variant="outlined"
            icon={<EditNoteOutlinedIcon />}
            label="set manually"
            sx={{ color: 'text.secondary', borderColor: 'border.subtle' }}
          />
        </Tooltip>
      )}
    </Stack>
  );
}
