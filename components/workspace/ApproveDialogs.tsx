'use client';

import type { ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemText, TextField, Typography } from '@mui/material';
import type { OpenFlagsError } from '@/api/approvals';
import { flagWhen, openFlagWhy, openFlagWho } from '@/lib/approvals/view';

/** Approve / Re-approve: what it does, plus an optional short note stored with the version. */
export function ApproveDialog({
  open,
  title,
  confirmLabel,
  summary,
  note,
  onNoteChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  summary: ReactNode;
  note: string;
  onNoteChange: (note: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {summary}
        <TextField
          label="Note (optional)"
          size="small"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          multiline
          maxRows={3}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          helperText="Saved with this approval version."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={onConfirm} variant="contained">{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** The backend answered 409: list the open flags and offer to approve and resolve them. */
export function OpenFlagsDialog({
  error,
  busy,
  onResolve,
  onClose,
}: {
  error: OpenFlagsError | null;
  busy: boolean;
  onResolve: () => void;
  onClose: () => void;
}) {
  const n = error?.count ?? 0;
  return (
    <Dialog open={error !== null} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{n === 1 ? 'This project has 1 open flag' : `This project has ${n} open flags`}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Approving can resolve them, which marks each flag as answered. Nothing has been approved yet.
        </Typography>
        <List dense aria-label="Open flags">
          {error?.flags.map((f) => (
            <ListItem key={f.flag_id} disableGutters>
              <ListItemText
                primary={f.parameter_alias}
                secondary={`${openFlagWho(f)} · ${openFlagWhy(f)} · ${flagWhen(f)}`}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">Cancel</Button>
        <Button onClick={onResolve} variant="contained" loading={busy}>
          {n === 1 ? 'Approve and resolve 1 flag' : `Approve and resolve ${n} flags`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
