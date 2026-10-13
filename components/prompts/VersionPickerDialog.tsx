'use client';

import { useCallback, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Skeleton } from '@mui/material';
import { apiListSlotVersions } from '@/api/prompts';
import { FormDialog } from '@/components/ui/FormDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { PromptText } from '@/components/prompts/SlotTable';
import { useResource } from '@/hooks/useResource';
import { slotLabel, versionChoices } from '@/lib/customers/settings';

/**
 * Choose one existing version of a category slot. Used for a customer's prompt
 * (Library) and for a project's own pin (Prompts page); the caller does the PUT
 * and returns its error text, which is shown here.
 */
export function VersionPickerDialog({
  slotKey,
  inUseId,
  title,
  onChoose,
  onClose,
}: {
  slotKey: string;
  inUseId: string | null;
  title: string;
  onChoose: (versionId: string) => Promise<void>;
  onClose: () => void;
}) {
  const load = useCallback((signal: AbortSignal) => apiListSlotVersions(slotKey, signal), [slotKey]);
  const { data, error: loadError, reload } = useResource(load, 'Could not load the versions.');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = data ? versionChoices(data, inUseId) : [];
  const value = picked ?? inUseId ?? choices[0]?.id ?? '';
  const chosen = data?.find((v) => v.id === value);

  const submit = async () => {
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await onChoose(value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the choice.');
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={`${title}: ${slotLabel(slotKey)}`}
      error={error}
      submitLabel="Use this version"
      submitDisabled={!value || value === inUseId}
      busy={busy}
      onSubmit={() => void submit()}
      maxWidth="md"
    >
      {loadError ? (
        <ErrorState description={loadError} onRetry={reload} />
      ) : !data ? (
        <Skeleton variant="rounded" height={56} aria-label="Loading versions" />
      ) : (
        <>
          <FormControl fullWidth>
            <InputLabel id="version-label">Version</InputLabel>
            <Select labelId="version-label" label="Version" value={value} onChange={(e) => setPicked(e.target.value)}>
              {choices.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.label}{c.id === inUseId ? ' · in use' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {chosen && <PromptText text={chosen.content} />}
        </>
      )}
    </FormDialog>
  );
}
