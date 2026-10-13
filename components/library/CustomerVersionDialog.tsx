'use client';

import { useCallback, useState } from 'react';
import { Skeleton, TextField } from '@mui/material';
import { apiListSlotVersions } from '@/api/prompts';
import { FormDialog } from '@/components/ui/FormDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { useResource } from '@/hooks/useResource';
import { slotLabel, validateNewVersion } from '@/lib/customers/settings';

/**
 * Write a prompt version for one customer and one category slot. The editor
 * starts from the text of the version currently in use. The backend checks the
 * required placeholders; its 422 text (which lists the missing ones) is shown.
 */
export function CustomerVersionDialog({
  slotKey,
  basedOnVersionId,
  onSave,
  onClose,
}: {
  slotKey: string;
  /** The version in use (the customer's own, else the global one). */
  basedOnVersionId: string | null;
  onSave: (content: string, changeNote: string) => Promise<void>;
  onClose: () => void;
}) {
  const load = useCallback((signal: AbortSignal) => apiListSlotVersions(slotKey, signal), [slotKey]);
  const { data, error: loadError, reload } = useResource(load, 'Could not load the current prompt.');
  const [content, setContent] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = data?.find((v) => v.id === basedOnVersionId) ?? [...(data ?? [])].sort((a, b) => b.version_number - a.version_number)[0];
  const text = content ?? base?.content ?? '';
  const invalid = validateNewVersion({ content: text, changeNote });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(text, changeNote.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the version.');
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={`Write a version for this customer: ${slotLabel(slotKey)}`}
      error={error}
      submitLabel="Save and use for this customer"
      submitDisabled={!data || invalid !== null}
      busy={busy}
      onSubmit={() => void submit()}
      maxWidth="md"
    >
      {loadError ? (
        <ErrorState description={loadError} onRetry={reload} />
      ) : !data ? (
        <Skeleton variant="rounded" height={240} aria-label="Loading the current prompt" />
      ) : (
        <>
          <TextField
            label="Prompt text" value={text} onChange={(e) => setContent(e.target.value)}
            multiline minRows={10} maxRows={20} fullWidth autoFocus
            helperText={base ? `Starts from v${base.version_number}. Keep the placeholders the prompt needs.` : undefined}
            slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
          />
          <TextField
            label="Change note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} fullWidth required
            helperText="Shown next to the version, e.g. what is different for this customer."
          />
        </>
      )}
    </FormDialog>
  );
}
