'use client';

import { useState } from 'react';
import { TextField, Typography } from '@mui/material';
import { FormDialog } from '@/components/ui/FormDialog';
import { errorMessage } from '@/lib/errors';

/** A one-field dialog: name a new template, or name the template a project is saved as. */
export function NameDialog({
  title,
  description,
  label = 'Template name',
  placeholder,
  initialName = '',
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not create the template.'));
      setBusy(false);
    }
  };

  return (
    <FormDialog open onClose={onClose} title={title} error={error} submitLabel={submitLabel} submitDisabled={!name.trim()} busy={busy} onSubmit={submit} maxWidth="xs">
      {description && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{description}</Typography>}
      <TextField label={label} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} autoFocus required fullWidth />
    </FormDialog>
  );
}
