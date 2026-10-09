'use client';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';

/**
 * The shared shell behind `NewProjectDialog` and every later create/edit
 * dialog (templates, customers, prompt versions): title, an error slot,
 * form content, cancel/submit actions with a loading submit button. Existing
 * dialogs built before this step keep their own markup; this is for new ones.
 */
export function FormDialog({
  open,
  onClose,
  title,
  error,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onSubmit,
  submitDisabled = false,
  busy = false,
  maxWidth = 'sm',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  error?: string | null;
  children: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  busy?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: (e: React.FormEvent) => {
            e.preventDefault();
            onSubmit();
          },
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* type="button" matters here: the dialog's Paper IS the form (see
            slotProps.paper above), and a <button> with no type attribute
            defaults to "submit" inside a form -- Cancel would otherwise also
            fire onSubmit. */}
        <Button type="button" onClick={onClose} disabled={busy} color="inherit">
          {cancelLabel}
        </Button>
        <Button type="submit" variant="contained" disabled={submitDisabled || busy} loading={busy}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
