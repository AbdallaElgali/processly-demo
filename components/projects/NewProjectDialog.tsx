'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, FormControl, FormHelperText, InputLabel, Link as MuiLink, MenuItem, Select, TextField, Typography,
} from '@mui/material';
import NextLink from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/Customers';
import { getUserTemplates, type ExtractionTemplateBase } from '@/api/templates';
import { apiGetCustomerSettings, type CustomerSettings } from '@/api/customerSettings';
import { customerPromptSummary } from '@/lib/customers/settings';
import { useTemplateRuleCounts } from '@/hooks/useTemplateRuleCounts';
import { projectTemplateOptions } from '@/lib/templates/library';
import { createProject } from '@/lib/project-data/actions';
import { buildCreateInput, canCreateProject } from '@/lib/projects/create';
import { errorMessage } from '@/lib/errors';
import { FormDialog } from '@/components/ui/FormDialog';

/**
 * Creating a project. Replaces the two near-identical dialogs that lived in
 * BDASideBar and NoProjectsScreen, and (step 6) is built on the shared
 * `FormDialog` shell rather than its own `Dialog` markup.
 *
 * Only fields ProjectCreateInput declares are sent. The old form also
 * collected a customer "full name", which CustomerCreate has no field for, so
 * it was silently discarded — that input is gone rather than lying.
 */
export function NewProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { user } = useAuth();
  const { customers, loadCustomers, createNewCustomer } = useCustomers();

  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  // Only the person's own pick; until then the template follows the customer, else the user's default.
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);
  const [customerSettings, setCustomerSettings] = useState<{ customerId: string; settings: CustomerSettings | null } | null>(null);
  const [templates, setTemplates] = useState<ExtractionTemplateBase[]>([]);
  const [newCustomer, setNewCustomer] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const ruleCounts = useTemplateRuleCounts(open ? templates : null);
  // Settings of the chosen customer; ignored while they belong to a previously chosen one.
  const settings = customerSettings?.customerId === customerId ? customerSettings.settings : null;
  const settingsPending = customerId !== '' && customerSettings?.customerId !== customerId;
  const { options: templateOptions, selectedId: defaultTemplateId } = projectTemplateOptions(
    templates, ruleCounts, user?.template_id, settings?.default_template?.id,
  );
  const templateId = pickedTemplateId ?? defaultTemplateId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadCustomers();
    if (user?.id) {
      getUserTemplates(user.id)
        .then((list) => {
          setTemplates(list);
        })
        .catch(() => setTemplates([]));
    }
  }, [open, user?.id, loadCustomers]);

  // The chosen customer's default template and prompt choices (backend S3).
  useEffect(() => {
    if (!open || !customerId) return;
    const controller = new AbortController();
    apiGetCustomerSettings(customerId, controller.signal)
      .then((settings) => setCustomerSettings({ customerId, settings }))
      .catch(() => {
        if (!controller.signal.aborted) setCustomerSettings({ customerId, settings: null });
      });
    return () => controller.abort();
  }, [open, customerId]);

  const reset = () => {
    setAlias(''); setDescription(''); setCustomerId(''); setPickedTemplateId(null); setCustomerSettings(null);
    setNewCustomer(''); setAddingCustomer(false); setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createNewCustomer(newCustomer.trim());
      if (created) setCustomerId(created.id);
      setNewCustomer('');
      setAddingCustomer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the customer.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!canCreateProject({ alias, customerId, userId: user?.id })) return;
    setBusy(true);
    setError(null);
    try {
      const project = await createProject(
        buildCreateInput({ alias, customerId, userId: user?.id, templateId, description }),
      );
      if (!project) throw new Error('The project was not created.');
      reset();
      onCreated(project.id);
    } catch (e) {
      // A stale customer id comes back as a 422 whose `detail` says so.
      setError(errorMessage(e, 'Could not create the project.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title="New project"
      error={error}
      onSubmit={() => void handleCreate()}
      submitLabel="Create project"
      submitDisabled={!canCreateProject({ alias, customerId, userId: user?.id })}
      busy={busy}
    >
      <TextField
        autoFocus required label="Project name" value={alias} fullWidth
        onChange={(e) => setAlias(e.target.value)}
        helperText="Shown in the sidebar and the breadcrumb."
      />

      {addingCustomer ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            autoFocus label="New customer" value={newCustomer} fullWidth size="small"
            onChange={(e) => setNewCustomer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddCustomer(); } }}
          />
          <Button type="button" onClick={() => void handleAddCustomer()} disabled={!newCustomer.trim() || busy}>Add</Button>
          <Button type="button" onClick={() => setAddingCustomer(false)} color="inherit">Cancel</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl fullWidth required>
            <InputLabel id="customer-label">Customer</InputLabel>
            <Select
              labelId="customer-label" label="Customer" value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setPickedTemplateId(null); }}
            >
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.alias_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button type="button" startIcon={<AddIcon />} onClick={() => setAddingCustomer(true)} sx={{ flexShrink: 0 }}>
            New
          </Button>
        </Box>
      )}

      <FormControl fullWidth>
        <InputLabel id="template-label">Template</InputLabel>
        <Select
          labelId="template-label" label="Template" value={templateId}
          onChange={(e) => setPickedTemplateId(e.target.value)}
        >
          {templateOptions.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}{t.rules ? ` · ${t.rules}` : ''}{t.isCustomerDefault ? ' · Customer default' : t.isDefault ? ' · my default' : ''}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          The project starts with this template&apos;s parameters.{' '}
          <MuiLink component={NextLink} href="/library" onClick={handleClose}>Manage templates</MuiLink>
        </FormHelperText>
      </FormControl>

      {customerId && (
        <Box sx={{ mt: -1 }} aria-live="polite">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {settingsPending
              ? 'Loading the customer’s settings…'
              : settings
                ? customerPromptSummary(settings)
                : 'The customer’s settings could not be loaded; the project will use the global prompts unless the customer has its own.'}
            {' '}
            <MuiLink component={NextLink} href={`/library?tab=customers&customer=${encodeURIComponent(customerId)}`} onClick={handleClose}>
              Open the customer in the Library
            </MuiLink>
          </Typography>
        </Box>
      )}

      <TextField
        label="Description" value={description} fullWidth multiline rows={2}
        onChange={(e) => setDescription(e.target.value)}
      />
    </FormDialog>
  );
}
