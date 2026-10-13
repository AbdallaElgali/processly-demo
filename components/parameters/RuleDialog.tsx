'use client';

import { useState } from 'react';
import { FormControlLabel, MenuItem, Switch, TextField, Typography } from '@mui/material';
import { FormDialog } from '@/components/ui/FormDialog';
import { resolveCategory } from '@/lib/categories';
import { errorMessage } from '@/lib/errors';
import {
  RULE_ALIAS_MAX, buildRuleUpsert, draftFromRule, parametersWithoutRule, validateRuleAlias, type RuleDraft,
} from '@/lib/templates/rules';
import type { CanonicalParameter, TemplateRule, TemplateRuleUpsert } from '@/api/templates';

const EMPTY: RuleDraft = { parameterId: '', alias: '', description: '', aiInstructions: '', expectedUnit: '', active: true };

/**
 * Add a rule to an open template, or edit one (`PUT /extraction-templates/{id}/rules`).
 * Mount with a `key` so the form starts from the rule being edited.
 */
export function RuleDialog({
  rule,
  rules,
  canonical,
  onSave,
  onClose,
}: {
  /** The rule being edited; absent when adding. */
  rule?: TemplateRule;
  /** All rules of the template, for the duplicate-alias check and the picker. */
  rules: TemplateRule[];
  canonical: CanonicalParameter[];
  onSave: (body: TemplateRuleUpsert) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!rule;
  const [draft, setDraft] = useState<RuleDraft>(rule ? draftFromRule(rule) : EMPTY);
  const [aliasTouched, setAliasTouched] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = canonical.find((p) => p.id === draft.parameterId);
  const free = editing ? canonical : parametersWithoutRule(canonical, rules);
  // Keep the chosen parameter in the list even after the save reloads the rules
  // (it then has a rule), or the select briefly holds a value with no option.
  const choices = selected && !free.includes(selected) ? [selected, ...free] : free;
  const aliasError = validateRuleAlias(draft.alias, rules, rule?.id);
  const canSubmit = !!draft.parameterId && !aliasError;

  const pickParameter = (id: string) => {
    const param = canonical.find((p) => p.id === id);
    // Pre-fill the alias with the canonical name until the person types their own.
    setDraft((d) => ({ ...d, parameterId: id, alias: aliasTouched ? d.alias : param?.name ?? '' }));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(buildRuleUpsert(draft));
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not save the rule.'));
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={editing ? `Edit rule: ${rule.canonical_name}` : 'Add rule'}
      error={error}
      submitLabel={editing ? 'Save rule' : 'Add rule'}
      submitDisabled={!canSubmit}
      busy={busy}
      onSubmit={submit}
      maxWidth="sm"
    >
      <TextField
        select
        label="Parameter"
        value={draft.parameterId}
        onChange={(e) => pickParameter(e.target.value)}
        disabled={editing}
        required
        fullWidth
        helperText={
          editing
            ? 'A rule belongs to one parameter; it cannot be moved to another.'
            : choices.length === 0
              ? 'This template already has a rule for every parameter.'
              : selected
                ? [selected.category ? resolveCategory(selected.category).label : null, selected.expected_unit ? `unit ${selected.expected_unit}` : null].filter(Boolean).join(' · ') || ' '
                : 'Pick the parameter this rule is for.'
        }
      >
        {choices.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Alias"
        value={draft.alias}
        onChange={(e) => {
          setAliasTouched(true);
          setDraft({ ...draft, alias: e.target.value });
        }}
        error={draft.alias.length > 0 && !!aliasError}
        helperText={aliasError ?? `${draft.alias.trim().length}/${RULE_ALIAS_MAX}. The name projects made from this template show.`}
        required
        fullWidth
      />
      <TextField
        label="Description"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        placeholder={selected?.default_description ?? undefined}
        helperText="Optional. Empty uses the dictionary description."
        multiline
        minRows={2}
        fullWidth
      />
      <TextField
        label="AI instructions"
        value={draft.aiInstructions}
        onChange={(e) => setDraft({ ...draft, aiInstructions: e.target.value })}
        helperText="Optional guidance for the model."
        multiline
        minRows={2}
        fullWidth
      />
      <TextField
        label="Expected unit override"
        value={draft.expectedUnit}
        onChange={(e) => setDraft({ ...draft, expectedUnit: e.target.value })}
        placeholder={selected?.expected_unit ?? undefined}
        helperText="Optional. Empty uses the dictionary unit."
        fullWidth
      />
      <FormControlLabel
        control={<Switch checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />}
        label={<Typography variant="body2">{draft.active ? 'Active: projects made from this template include it' : 'Inactive: left out of new projects'}</Typography>}
      />
    </FormDialog>
  );
}
