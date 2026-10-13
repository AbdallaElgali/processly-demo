'use client';

import { useState } from 'react';
import { TextField } from '@mui/material';
import { HttpError, updateCanonicalParameter, type CanonicalParameter } from '@/api/templates';
import { FormDialog } from '@/components/ui/FormDialog';
import { upsertCanonicalParameter } from '@/hooks/useCanonicalParameters';
import { errorMessage } from '@/lib/errors';
import { markBuiltin } from '@/lib/parameters/dictionary';

/**
 * Edit a dictionary parameter's description and unit (`PUT /extraction-templates/parameters/{id}`).
 * The 27 built-in parameters answer 409: the backend text is shown and Edit is
 * withdrawn for that parameter for the rest of the session.
 */
export function DictionaryEditDialog({ parameter, onClose }: { parameter: CanonicalParameter; onClose: () => void }) {
  const [description, setDescription] = useState(parameter.default_description ?? '');
  const [unit, setUnit] = useState(parameter.expected_unit ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateCanonicalParameter(parameter.id, {
        default_description: description.trim(),
        expected_unit: unit.trim() === '' ? null : unit.trim(),
      });
      upsertCanonicalParameter(updated);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not save the parameter.'));
      if (e instanceof HttpError && e.status === 409) {
        markBuiltin(parameter.id);
        setRefused(true);
      }
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={`Edit ${parameter.name}`}
      error={error}
      submitLabel="Save"
      cancelLabel={refused ? 'Close' : 'Cancel'}
      submitDisabled={refused || description.trim() === ''}
      busy={busy}
      onSubmit={() => void submit()}
    >
      <TextField
        autoFocus required label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
        multiline minRows={2} fullWidth helperText="The text the model reads for this parameter."
      />
      <TextField
        label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth
        helperText="Optional. Existing projects keep the unit they already have; new projects and runs use this one."
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />
    </FormDialog>
  );
}
