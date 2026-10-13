'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, FormControl, InputLabel, MenuItem, Select, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/Customers';
import { getUserTemplates, type ExtractionTemplateBase } from '@/api/templates';
import { createProject } from '@/lib/project-data/actions';
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
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<ExtractionTemplateBase[]>([]);
  const [newCustomer, setNewCustomer] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadCustomers();
    if (user?.id) {
      getUserTemplates(user.id)
        .then((list) => {
          setTemplates(list);
          // Default to the user's own template, else the system default.
          const preferred = user.template_id ?? list.find((t) => t.is_system_default)?.id ?? '';
          setTemplateId(preferred);
        })
        .catch(() => setTemplates([]));
    }
  }, [open, user?.id, user?.template_id, loadCustomers]);

  const reset = () => {
    setAlias(''); setDescription(''); setCustomerId(''); setTemplateId('');
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
    if (!alias.trim() || !user?.id) return;
    setBusy(true);
    setError(null);
    try {
      const project = await createProject({
        alias_id: alias.trim(),
        description: description.trim(),
        customer_id: customerId || null,
        user_id: user.id,
        template_id: templateId || null,
      });
      if (!project) throw new Error('The project was not created.');
      reset();
      onCreated(project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project.');
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
      submitDisabled={!alias.trim()}
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
          <FormControl fullWidth>
            <InputLabel id="customer-label">Customer</InputLabel>
            <Select
              labelId="customer-label" label="Customer" value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
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
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}{t.is_system_default ? ' (default)' : ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Description" value={description} fullWidth multiline rows={2}
        onChange={(e) => setDescription(e.target.value)}
      />
    </FormDialog>
  );
}
