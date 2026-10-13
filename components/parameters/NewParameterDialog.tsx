'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { createCanonicalParameter, type CanonicalParameter } from '@/api/templates';
import { FormDialog } from '@/components/ui/FormDialog';
import { upsertCanonicalParameter, refreshCanonicalParameters } from '@/hooks/useCanonicalParameters';
import { errorMessage } from '@/lib/errors';
import {
  CATEGORY_CHOICES, NEW_PARAMETER_EXPORT_NOTE, PARAMETER_NAME_HINT, buildCreateParameterBody, validateParameterName,
} from '@/lib/parameters/dictionary';

/**
 * Define a new canonical parameter (`POST /extraction-templates/parameters`).
 * Opened from the Library, the rule dialog's picker and a project's "Not in
 * this project" section. On 201 the shared dictionary is refreshed and
 * `onCreated` hears about it; with `addToProject` the dialog then offers
 * "Add to this project now" before closing.
 */
export function NewParameterDialog({
  onClose,
  onCreated,
  addToProject,
}: {
  onClose: () => void;
  onCreated?: (parameter: CanonicalParameter) => void;
  /** Present when opened from a project: adds the new parameter to it. */
  addToProject?: (parameter: CanonicalParameter) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CanonicalParameter | null>(null);

  const nameError = validateParameterName(name);
  const canSubmit = !nameError && category !== '' && description.trim() !== '';

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createCanonicalParameter(buildCreateParameterBody({ name, category, unit, description }));
      upsertCanonicalParameter(made);
      void refreshCanonicalParameters().catch(() => undefined);
      onCreated?.(made);
      if (addToProject) setCreated(made);
      else onClose();
    } catch (e) {
      // 409 (name taken) and 422 carry the backend's own text.
      setError(errorMessage(e, 'Could not create the parameter.'));
    } finally {
      setBusy(false);
    }
  };

  if (created && addToProject) {
    const addNow = async () => {
      setBusy(true);
      setError(null);
      try {
        await addToProject(created);
        onClose();
      } catch (e) {
        setError(errorMessage(e, 'Could not add the parameter to this project.'));
        setBusy(false);
      }
    };
    return (
      <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle>{created.name} created</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography variant="body2">It is in the dictionary now. Add it to this project to extract it here.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy} color="inherit">Not now</Button>
          <Button variant="contained" disableElevation onClick={() => void addNow()} disabled={busy}>Add to this project now</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const showNameError = name !== '' && !!nameError;
  return (
    <FormDialog
      open
      onClose={onClose}
      title="New parameter"
      error={error}
      submitLabel="Create parameter"
      submitDisabled={!canSubmit}
      busy={busy}
      onSubmit={() => void submit()}
    >
      <TextField
        autoFocus
        required
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={showNameError}
        helperText={showNameError ? nameError : PARAMETER_NAME_HINT}
        slotProps={{ htmlInput: { style: { fontFamily: 'monospace' }, maxLength: 60 } }}
        fullWidth
      />
      <TextField select required label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
        {CATEGORY_CHOICES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
      </TextField>
      <TextField
        label="Unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        helperText="Optional. Leave empty for a unitless parameter."
        slotProps={{ htmlInput: { maxLength: 50 } }}
        fullWidth
      />
      <TextField
        required
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        helperText="What the model should look for. This is the text it reads."
        multiline
        minRows={2}
        fullWidth
      />
      <Typography variant="caption" role="note" sx={{ color: 'text.secondary' }}>{NEW_PARAMETER_EXPORT_NOTE}</Typography>
    </FormDialog>
  );
}
