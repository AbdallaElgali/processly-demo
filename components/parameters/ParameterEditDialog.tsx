'use client';

import { useState } from 'react';
import { TextField, Typography } from '@mui/material';
import { FormDialog } from '@/components/ui/FormDialog';
import { ALIAS_MAX, buildParameterPatch, metaOf, validateAlias, type ParameterMeta } from '@/lib/parameters/meta';
import { errorMessage } from '@/lib/errors';
import type { updateProjectParameter } from '@/api/projects';
import type { InputField } from '@/types';

/**
 * Edit one project parameter's alias, description and AI instructions
 * (`PATCH /projects/project-parameter/{id}/`). Mount it with a `key` of the
 * parameter so the form starts from that parameter's current texts.
 */
export function ParameterEditDialog({
  field,
  defaultDescription,
  onSave,
  onClose,
}: {
  field: InputField;
  /** The dictionary's description, shown as the placeholder when there is no override. */
  defaultDescription: string | null;
  onSave: (patch: updateProjectParameter) => Promise<void>;
  onClose: () => void;
}) {
  const current = metaOf(field);
  const [draft, setDraft] = useState<ParameterMeta>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aliasError = validateAlias(draft.alias);
  const patch = buildParameterPatch(current, draft);

  const submit = async () => {
    if (aliasError || !patch) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(patch);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not save the parameter.'));
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={`Edit ${current.alias}`}
      error={error}
      submitLabel="Save changes"
      submitDisabled={!!aliasError || !patch}
      busy={busy}
      onSubmit={submit}
      maxWidth="sm"
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>{field.id}</Typography>
        {' '}· Changes apply to the next extraction of this project. Values already extracted are not touched.
      </Typography>
      <TextField
        label="Alias"
        value={draft.alias}
        onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
        error={draft.alias.length > 0 && !!aliasError}
        helperText={aliasError ?? `${draft.alias.trim().length}/${ALIAS_MAX}. The name shown in the Workspace.`}
        autoFocus
        required
        fullWidth
      />
      <TextField
        label="Description"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        placeholder={defaultDescription ?? 'What this parameter means'}
        helperText={defaultDescription ? `Leave empty to use the dictionary description: “${defaultDescription}”` : 'Optional.'}
        multiline
        minRows={3}
        fullWidth
      />
      <TextField
        label="AI instructions"
        value={draft.aiInstructions}
        onChange={(e) => setDraft({ ...draft, aiInstructions: e.target.value })}
        placeholder="e.g. Take the value from the table, not the headline. Ignore pulse values."
        helperText="Extra guidance for the model when it extracts this parameter. Optional."
        multiline
        minRows={3}
        fullWidth
      />
    </FormDialog>
  );
}
