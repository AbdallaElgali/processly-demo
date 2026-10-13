'use client';

import { useCallback, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert, Box, Button, FormControl, InputLabel, Link as MuiLink, MenuItem, Select, Skeleton, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  apiClearCustomerDefaultTemplate, apiClearCustomerPrompt, apiCreateCustomerPromptVersion, apiGetCustomerSettings,
  apiSetCustomerDefaultTemplate, apiSetCustomerPrompt, type CustomerPromptSlotSetting, type CustomerSettings,
} from '@/api/customerSettings';
import { getUserTemplates, type ExtractionTemplateBase } from '@/api/templates';
import { ErrorState } from '@/components/ui/ErrorState';
import { toast } from '@/components/ui/Toast';
import { VersionPickerDialog } from '@/components/prompts/VersionPickerDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/errors';
import {
  AGENT_PROMPTS_NOTE, customerDefaultTemplateOptions, promptSourceLabel, slotLabel,
} from '@/lib/customers/settings';
import { CustomerVersionDialog } from './CustomerVersionDialog';

const NONE = '';

type Dialog = { kind: 'choose' | 'write'; slot: CustomerPromptSlotSetting } | null;

/** One customer: its default template and, per category slot, global or its own prompt version. */
export function CustomerDetail({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => apiGetCustomerSettings(customerId, signal), [customerId]);
  const { data, error, reload } = useResource(load, 'Could not load the customer.');
  const [updated, setUpdated] = useState<CustomerSettings | null>(null);
  const settings = updated?.customer_id === customerId ? updated : data;

  const userId = user?.id;
  const loadTemplates = useCallback(
    () => (userId ? getUserTemplates(userId) : Promise.resolve<ExtractionTemplateBase[]>([])),
    [userId],
  );
  const { data: templates } = useResource(loadTemplates, 'Could not load the templates.');

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const templateOptions = useMemo(
    () => customerDefaultTemplateOptions(templates ?? [], settings?.default_template ?? null),
    [templates, settings?.default_template],
  );

  const run = async (action: () => Promise<CustomerSettings>, done?: string) => {
    setBusy(true);
    setActionError(null);
    try {
      setUpdated(await action());
      if (done) toast.show(done);
    } catch (e) {
      setActionError(errorMessage(e, 'Could not save the change.'));
    } finally {
      setBusy(false);
    }
  };

  // The dialogs report their own errors, so they call the API directly and let the section pick up the result.
  const apply = async (action: () => Promise<CustomerSettings>) => {
    try {
      setUpdated(await action());
    } catch (e) {
      throw new Error(errorMessage(e, 'Could not save the change.'));
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} color="inherit" onClick={onBack} sx={{ mb: 1 }}>All customers</Button>
      {error ? (
        <ErrorState title="Could not load the customer" description={error} onRetry={reload} />
      ) : !settings ? (
        <Stack spacing={1} aria-busy="true" aria-label="Loading customer">
          <Skeleton variant="text" width={240} height={40} />
          <Skeleton variant="rounded" height={56} />
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={44} />)}
        </Stack>
      ) : (
        <Stack spacing={3} sx={{ maxWidth: 900 }}>
          <Box>
            <Typography variant="h5" component="h2" sx={{ color: 'text.primary' }}>{settings.alias_name}</Typography>
            {settings.name && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{settings.name}</Typography>}
          </Box>
          {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

          <Box component="section" aria-labelledby="cust-template">
            <Typography id="cust-template" variant="subtitle1" component="h3" sx={{ color: 'text.primary', mb: 0.5 }}>Default template</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              A new project for this customer starts with this template&apos;s parameters. The person creating the project can still pick another.
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 280 }} size="small" disabled={busy || !templates}>
                <InputLabel id="cust-template-label" shrink>Template</InputLabel>
                <Select
                  labelId="cust-template-label" label="Template" notched value={settings.default_template?.id ?? NONE} displayEmpty
                  onChange={(e) => {
                    const id = e.target.value;
                    void run(() => (id === NONE ? apiClearCustomerDefaultTemplate(customerId) : apiSetCustomerDefaultTemplate(customerId, id)));
                  }}
                  renderValue={(v) => (v === NONE ? 'None' : templateOptions.find((t) => t.id === v)?.name ?? 'Template')}
                >
                  <MenuItem value={NONE}>None (use my default)</MenuItem>
                  {templateOptions.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                </Select>
              </FormControl>
              <MuiLink component={NextLink} href="/library?tab=templates">Open the Templates section</MuiLink>
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="cust-prompts">
            <Typography id="cust-prompts" variant="subtitle1" component="h3" sx={{ color: 'text.primary', mb: 0.5 }}>Prompts</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {AGENT_PROMPTS_NOTE} Below, the category prompts: each project created for this customer starts with these versions.
              Changing them does not affect projects that already exist.
            </Typography>
            <Box sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel', overflow: 'hidden' }}>
              {settings.prompt_slots.map((s, i) => (
                <Stack
                  key={s.slot_key} direction="row" spacing={1.5} alignItems="center" useFlexGap
                  sx={{ px: 2, py: 1, flexWrap: 'wrap', borderTop: i === 0 ? 0 : 1, borderColor: 'border.subtle' }}
                >
                  <Box sx={{ minWidth: 0, flex: 1, flexBasis: 220 }}>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{slotLabel(s.slot_key)}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{promptSourceLabel(s)}</Typography>
                  </Box>
                  <Button size="small" disabled={busy} onClick={() => setDialog({ kind: 'choose', slot: s })}>Choose version</Button>
                  <Button size="small" disabled={busy} onClick={() => setDialog({ kind: 'write', slot: s })}>Write a version for this customer</Button>
                  <Button
                    size="small" color="inherit" disabled={busy || !s.prompt_version_id}
                    onClick={() => void run(() => apiClearCustomerPrompt(customerId, s.slot_key), `${slotLabel(s.slot_key)}: using the global prompt`)}
                  >
                    Use global
                  </Button>
                </Stack>
              ))}
            </Box>
          </Box>
        </Stack>
      )}

      {dialog?.kind === 'choose' && (
        <VersionPickerDialog
          slotKey={dialog.slot.slot_key}
          inUseId={dialog.slot.prompt_version_id ?? dialog.slot.global_version_id}
          title="Prompt for this customer"
          onChoose={(versionId) => apply(() => apiSetCustomerPrompt(customerId, dialog.slot.slot_key, versionId))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'write' && (
        <CustomerVersionDialog
          slotKey={dialog.slot.slot_key}
          basedOnVersionId={dialog.slot.prompt_version_id ?? dialog.slot.global_version_id}
          onSave={async (content, note) => {
            try {
              await apiCreateCustomerPromptVersion(customerId, dialog.slot.slot_key, content, note);
            } catch (e) {
              throw new Error(errorMessage(e, 'Could not save the version.'));
            }
            // The new version is already this customer's choice (one transaction): read it back.
            setUpdated(await apiGetCustomerSettings(customerId));
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </Box>
  );
}
