'use client';

import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { apiGetPromptResolution, apiResetProjectPin, apiSetProjectPin } from '@/api/prompts';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { toast } from '@/components/ui/Toast';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/errors';
import { PINS_FROZEN_TEXT, pinsEditable, projectSlotRows, resolutionNote } from '@/lib/prompts/scoped';
import { VersionPickerDialog } from './VersionPickerDialog';

/**
 * The category prompts this project will use at its first extraction, where each
 * comes from, and (until a run has used them: `pins_frozen`) a way to change one
 * for this project only or go back. Agent prompts are global and not listed.
 */
export function ProjectPromptSettings({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => apiGetPromptResolution(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the project’s prompts.');
  const rows = useMemo(() => projectSlotRows(data), [data]);
  const editable = pinsEditable(data);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reset = async (slotKey: string, label: string) => {
    setBusyKey(slotKey);
    setActionError(null);
    try {
      await apiResetProjectPin(projectId, slotKey);
      toast.show(`${label}: back to the customer or global prompt`);
      reload();
    } catch (e) {
      setActionError(errorMessage(e, 'Could not reset the prompt.'));
      // A 409 means a run froze the pins since this page loaded: show the frozen state.
      reload();
    } finally {
      setBusyKey(null);
    }
  };

  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <div aria-busy="true"><SkeletonRows count={6} columns={4} /></div>;

  const choosingRow = rows.find((r) => r.slotKey === choosing);
  return (
    <Stack spacing={1.5}>
      <Alert severity={editable ? 'info' : 'warning'} variant="outlined" icon={editable ? undefined : <LockOutlinedIcon fontSize="small" />}>
        {!editable && <strong>{PINS_FROZEN_TEXT}. </strong>}
        {resolutionNote(data)} Agent prompts are global: they are the same for every project.
      </Alert>
      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Box component="ul" aria-label="Category prompts for this project" sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel', overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <Stack
            component="li" key={r.slotKey} direction="row" spacing={1.5} alignItems="center" useFlexGap
            sx={{ px: 2, py: 1, flexWrap: 'wrap', borderTop: i === 0 ? 0 : 1, borderColor: 'border.subtle' }}
          >
            <Box sx={{ minWidth: 0, flex: 1, flexBasis: 220 }}>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{r.label}</Typography>
              {r.description && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{r.description}</Typography>}
            </Box>
            <Typography variant="body2" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {r.version !== null ? `v${r.version}` : 'No version'}
            </Typography>
            <Chip size="small" variant="outlined" label={r.source} sx={{ height: 22 }} />
            {editable ? (
              <>
                <Button size="small" disabled={busyKey !== null} onClick={() => setChoosing(r.slotKey)}>Change for this project</Button>
                <Button size="small" color="inherit" disabled={busyKey !== null || !r.canReset} onClick={() => void reset(r.slotKey, r.label)}>Reset</Button>
              </>
            ) : (
              <Chip size="small" icon={<LockOutlinedIcon />} label={PINS_FROZEN_TEXT} sx={{ height: 22 }} />
            )}
          </Stack>
        ))}
      </Box>
      {choosingRow && (
        <VersionPickerDialog
          slotKey={choosingRow.slotKey}
          inUseId={choosingRow.versionId}
          title="Prompt for this project"
          onChoose={async (versionId) => {
            try {
              await apiSetProjectPin(projectId, choosingRow.slotKey, versionId);
            } catch (e) {
              reload();
              throw new Error(errorMessage(e, 'Could not change the prompt.'));
            }
            reload();
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </Stack>
  );
}
