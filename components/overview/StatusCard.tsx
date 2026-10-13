'use client';

import { useState } from 'react';
import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import { StatusChip, projectStatusLabel } from '@/components/ui/StatusChip';
import { toast } from '@/components/ui/Toast';
import { changeProjectStatus } from '@/lib/project-data/actions';
import { errorMessage } from '@/lib/errors';
import { PROJECT_STATUSES, STATUS_CHANGE_AVAILABLE, STATUS_CHANGE_UNAVAILABLE, isProjectStatus } from '@/lib/overview/status';
import type { ProjectStatus } from '@/api/types/projects';
import { Card } from './Card';

/**
 * The project's status and the form-encoded status change. The status is a
 * label people set; it is not derived from review progress, and Approve does
 * not move it (B10), which the card says so nobody expects it to.
 */
export function StatusCard({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  // The choice is kept as an override of the saved status, so after a save or
  // a refresh the field follows the backend without an effect.
  const [picked, setPicked] = useState<ProjectStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = picked ?? status;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value === status || busy) return;
    setBusy(true);
    setError(null);
    try {
      await changeProjectStatus(projectId, value);
      toast.show(`Status set to ${projectStatusLabel(value)}.`, { severity: 'success' });
      setPicked(null);
    } catch (e) {
      setError(errorMessage(e, 'Could not change the status.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Project status" icon={FlagOutlinedIcon} id="project-status">
      <Stack direction="row" alignItems="center" spacing={1}>
        <StatusChip status={status} size="medium" />
      </Stack>
      {!STATUS_CHANGE_AVAILABLE && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {STATUS_CHANGE_UNAVAILABLE}
        </Typography>
      )}
      {STATUS_CHANGE_AVAILABLE && (
      <Stack component="form" onSubmit={submit} spacing={1.5} noValidate>
        <TextField
          select
          size="small"
          label="Change status"
          value={value}
          onChange={(e) => isProjectStatus(e.target.value) && setPicked(e.target.value)}
          disabled={busy}
          error={!!error}
          helperText={error ?? undefined}
          slotProps={{ htmlInput: { 'aria-describedby': 'status-note' } }}
        >
          {PROJECT_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>{projectStatusLabel(s)}</MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" size="small" disabled={value === status} loading={busy}>
            Update status
          </Button>
          <Button type="button" size="small" color="inherit" disabled={busy || picked === null} onClick={() => { setPicked(null); setError(null); }}>
            Reset
          </Button>
        </Stack>
      </Stack>
      )}
      <Typography id="status-note" variant="caption" sx={{ color: 'text.muted' }}>
        The status is set by hand. Approving parameters does not change it, and changing it does not approve anything.
      </Typography>
    </Card>
  );
}
