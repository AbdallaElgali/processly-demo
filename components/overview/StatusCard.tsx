'use client';

import { useState } from 'react';
import { Alert, Button, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { ProjectStatus } from '@/components/ui/ProjectStatus';
import { toast } from '@/components/ui/Toast';
import { changeProjectStatus } from '@/lib/project-data/actions';
import { errorMessage } from '@/lib/errors';
import { OVERRIDE_STATUSES, statusLabel } from '@/lib/approvals/view';
import type { FullProjectDetails, ProjectStatus as Status } from '@/api/types/projects';
import { Card } from './Card';
import { useControl } from '@/components/shell/ProjectAccessProvider';

/**
 * The project's status. The backend moves it by itself (extraction, review,
 * Approve), so this card only shows it, with a small "Set status manually"
 * menu for the override (New, Pending review, In review; Approved comes only
 * from Approve). The project is re-read afterwards; nothing here sets the
 * status in the UI.
 */
export function StatusCard({ projectId, project, userId }: { projectId: string; project: FullProjectDetails; userId: string | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const statusCtl = useControl('setStatus');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (status: Status) => {
    setAnchor(null);
    if (busy || status === project.status) return;
    setBusy(true);
    setError(null);
    try {
      await changeProjectStatus(projectId, status, userId);
      toast.show(`Status set to ${statusLabel(status)}.`, { severity: 'success' });
    } catch (e) {
      setError(errorMessage(e, 'Could not change the status.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Project status" icon={FlagOutlinedIcon} id="project-status">
      <ProjectStatus project={project} size="medium" />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <div>
        <Tooltip title={statusCtl.reason ?? ''}>
        <span>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          endIcon={<ArrowDropDownIcon />}
          loading={busy}
          disabled={!statusCtl.enabled}
          aria-haspopup="menu"
          aria-expanded={anchor ? 'true' : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          Set status manually
        </Button>
        </span>
        </Tooltip>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          {OVERRIDE_STATUSES.map((s) => (
            <MenuItem key={s} selected={s === project.status} onClick={() => void choose(s)}>
              {statusLabel(s)}
            </MenuItem>
          ))}
        </Menu>
      </div>
      <Stack>
        <Typography id="status-note" variant="caption" sx={{ color: 'text.muted' }}>
          The status changes by itself as you extract, review and approve. Setting it by hand is an override; Approved is only
          set by Approve.
        </Typography>
      </Stack>
    </Card>
  );
}
