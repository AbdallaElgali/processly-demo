'use client';

import { useMemo, useState } from 'react';
import {
  Box, Button, Chip, FormControlLabel, IconButton, Stack, Switch, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import SaveAltOutlinedIcon from '@mui/icons-material/SaveAltOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@mui/material';
import { toast } from '@/components/ui/Toast';
import { useCanonicalParameters } from '@/hooks/useCanonicalParameters';
import { useTemplates } from '@/hooks/useTemplates';
import { errorMessage } from '@/lib/errors';
import { SAVE_AS_TEMPLATE_AVAILABLE, copyName, templateAccess, templateScope } from '@/lib/templates/rules';
import type { ExtractionTemplateBase, TemplateRule } from '@/api/templates';
import { NameDialog } from './NameDialog';
import { RuleDialog } from './RuleDialog';

type Dialog =
  | { kind: 'create' }
  | { kind: 'saveProject' }
  | { kind: 'copy'; template: ExtractionTemplateBase }
  | { kind: 'rule'; rule?: TemplateRule }
  | { kind: 'delete'; template: ExtractionTemplateBase }
  | null;

/**
 * The templates side of the Parameters screen (plan-A 6.5): list, create,
 * open one to edit its rules, delete, set as default, and save this project
 * as a template. Master/detail in one narrow pane: the list, or the open
 * template with a back button.
 */
export function TemplatesPanel({ projectId, projectName, parameterCount }: { projectId: string; projectName: string | null; parameterCount: number }) {
  const t = useTemplates();
  const { parameters: canonical } = useCanonicalParameters();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openTemplate = t.open;
  const summary = t.templates?.find((x) => x.id === t.openId) ?? null;
  const access = summary ? templateAccess(summary, t.userId) : null;
  const isDefault = (id: string) => t.defaultTemplateId === id;

  const canonicalById = useMemo(() => new Map((canonical ?? []).map((p) => [p.id, p])), [canonical]);

  const setDefault = async (template: ExtractionTemplateBase) => {
    try {
      await t.setDefault(template.id);
      toast.show(`“${template.name}” is now your default template for new projects.`, { severity: 'success' });
    } catch (e) {
      toast.show(`Could not set the default: ${errorMessage(e)}`, { severity: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (dialog?.kind !== 'delete') return;
    setDeleteBusy(true);
    try {
      await t.remove(dialog.template.id);
      toast.show(`Template “${dialog.template.name}” deleted.`, { severity: 'success' });
      setDialog(null);
    } catch (e) {
      toast.show(`Could not delete the template: ${errorMessage(e)}`, { severity: 'error' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const header = (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      useFlexGap
      sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'border.subtle', flexWrap: 'wrap', minHeight: 52 }}
    >
      {summary ? (
        <>
          <Tooltip title="Back to all templates">
            <IconButton size="small" aria-label="Back to all templates" onClick={t.closeTemplate}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="subtitle2" noWrap sx={{ color: 'text.primary', minWidth: 0, flex: '0 1 auto' }} title={summary.name}>
            {summary.name}
          </Typography>
          <Chip size="small" variant="outlined" label={templateScope(summary, t.userId)} sx={{ height: 22 }} />
          {isDefault(summary.id) && <Chip size="small" color="warning" variant="outlined" icon={<StarIcon />} label="Your default" sx={{ height: 22 }} />}
          <Box sx={{ flex: 1 }} />
          {!isDefault(summary.id) && (
            <Button size="small" startIcon={<StarBorderIcon />} onClick={() => void setDefault(summary)}>
              Set as default
            </Button>
          )}
          {access?.copyable && (
            <Button size="small" variant="outlined" disabled={!openTemplate} startIcon={<ContentCopyOutlinedIcon />} onClick={() => setDialog({ kind: 'copy', template: summary })}>
              Save a copy
            </Button>
          )}
          {/* The system default cannot be changed or deleted (backend 403, step 3.4): no controls, a copy instead. */}
          {!access?.copyable && (
            <Tooltip title={access?.editable ? 'Delete this template' : access?.reason}>
              <span>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={!access?.editable}
                  onClick={() => setDialog({ kind: 'delete', template: summary })}
                >
                  Delete
                </Button>
              </span>
            </Tooltip>
          )}
        </>
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ color: 'text.primary', flex: 1 }}>Templates</Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SaveAltOutlinedIcon />}
            onClick={() => setDialog({ kind: 'saveProject' })}
            disabled={!SAVE_AS_TEMPLATE_AVAILABLE || parameterCount === 0}
          >
            Save this project as template
          </Button>
          <Button size="small" variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setDialog({ kind: 'create' })}>
            New template
          </Button>
        </>
      )}
    </Stack>
  );

  const listColumns: DataTableColumn<ExtractionTemplateBase>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      value: (x) => x.name,
      render: (x) => (
        <Stack direction="row" spacing={0.75} alignItems="center">
          {isDefault(x.id) && <StarIcon sx={{ fontSize: 16, color: 'status.warning' }} titleAccess="Your default template" />}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{x.name}</Typography>
        </Stack>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      sortable: true,
      value: (x) => templateScope(x, t.userId),
      render: (x) => <Chip size="small" variant="outlined" label={templateScope(x, t.userId)} sx={{ height: 22 }} />,
    },
  ];

  const rules = openTemplate?.rules ?? [];
  const shownRules = rules.filter((r) => showInactive || r.is_active);
  const inactiveCount = rules.length - rules.filter((r) => r.is_active).length;

  const ruleColumns: DataTableColumn<TemplateRule>[] = [
    {
      key: 'parameter',
      label: 'Parameter',
      sortable: true,
      value: (r) => r.canonical_name,
      render: (r) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.custom_alias}</Typography>
          {r.custom_alias !== r.canonical_name && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.muted', display: 'block' }}>{r.canonical_name}</Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'details',
      label: 'Rule',
      render: (r) => {
        const fallback = canonicalById.get(r.parameter_id)?.default_description;
        const description = r.description_override?.trim();
        return (
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {!r.is_active && <Chip size="small" label="Inactive" sx={{ height: 20 }} />}
              {r.expected_unit_override && <Chip size="small" variant="outlined" label={`Unit ${r.expected_unit_override}`} sx={{ height: 20 }} />}
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: description ? 'text.secondary' : 'text.muted', fontStyle: description ? 'normal' : 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {description || (fallback ? `Default: ${fallback}` : 'No description')}
            </Typography>
            {r.ai_instructions?.trim() && (
              <Typography variant="caption" sx={{ color: 'status.info', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                AI: {r.ai_instructions.trim()}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    ...(access?.editable
      ? [{
          key: 'edit',
          label: '',
          align: 'right' as const,
          width: 56,
          render: (r: TemplateRule) => (
            <Tooltip title="Edit rule">
              <IconButton
                size="small"
                aria-label={`Edit rule ${r.canonical_name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDialog({ kind: 'rule', rule: r });
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ),
        }]
      : []),
  ];

  let body: React.ReactNode;
  if (summary) {
    body = (
      <Box sx={{ p: 2 }}>
        {access && !access.editable && (
          <Stack direction="row" spacing={1} alignItems="center" role="note" sx={{ mb: 1.5, px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'surface.sunken', color: 'text.secondary' }}>
            <LockOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
            <Typography variant="body2">{access.reason}</Typography>
          </Stack>
        )}
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap sx={{ mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
            {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
            {inactiveCount > 0 ? ` (${inactiveCount} inactive)` : ''}
          </Typography>
          {inactiveCount > 0 && (
            <FormControlLabel
              control={<Switch size="small" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
              label={<Typography variant="body2">Show inactive</Typography>}
              sx={{ mr: 0 }}
            />
          )}
          {!access?.copyable && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={!access?.editable || !canonical}
              onClick={() => setDialog({ kind: 'rule' })}
            >
              Add rule
            </Button>
          )}
        </Stack>
        {t.openError ? (
          <ErrorState title="Could not load this template" description={t.openError} onRetry={() => void t.openTemplate(summary.id)} />
        ) : !openTemplate ? (
          <Stack spacing={0.5} aria-busy="true" aria-label="Loading rules">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={52} />)}
          </Stack>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={DataObjectIcon}
            title="This template has no rules"
            description="A project made from it starts with no parameters. Add a rule per parameter."
            action={access?.editable ? { label: 'Add rule', onClick: () => setDialog({ kind: 'rule' }) } : undefined}
          />
        ) : (
          <DataTable
            columns={ruleColumns}
            rows={shownRules}
            getRowKey={(r) => r.id}
            dense
            defaultSortKey="parameter"
            emptyTitle="Every rule here is inactive"
            emptyDescription="Turn on Show inactive to see them."
          />
        )}
      </Box>
    );
  } else if (t.listError) {
    body = <ErrorState title="Could not load templates" description={t.listError} onRetry={t.retry} />;
  } else if (t.loading) {
    body = (
      <Stack spacing={0.5} sx={{ p: 2 }} aria-busy="true" aria-label="Loading templates">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rounded" height={44} />)}
      </Stack>
    );
  } else if ((t.templates ?? []).length === 0) {
    body = (
      <EmptyState
        icon={DataObjectIcon}
        title="Create your first template"
        description={`A template is a reusable set of parameters with their aliases and AI instructions. ${SAVE_AS_TEMPLATE_AVAILABLE ? 'Start from this project or from scratch.' : 'Start from scratch.'}`}
        action={{ label: 'New template', onClick: () => setDialog({ kind: 'create' }) }}
        secondaryAction={SAVE_AS_TEMPLATE_AVAILABLE && parameterCount > 0 ? { label: 'Save this project as template', onClick: () => setDialog({ kind: 'saveProject' }) } : undefined}
      />
    );
  } else {
    body = (
      <Box sx={{ p: 2 }}>
        <DataTable
          columns={listColumns}
          rows={t.templates ?? []}
          getRowKey={(x) => x.id}
          dense
          onRowClick={(x) => void t.openTemplate(x.id)}
          defaultSortKey="name"
        />
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.muted' }}>
          Select a template to see and edit its rules. The system default and other people&apos;s templates are read-only here; save a copy of the system default to change it.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: 'surface.panel' }}>
      {header}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{body}</Box>

      {dialog?.kind === 'create' && (
        <NameDialog
          title="New template"
          description="Name it now; you add its rules next."
          placeholder="e.g. Cylindrical cells, strict units"
          submitLabel="Create template"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const made = await t.create(name);
            toast.show(`Template “${made.name}” created.`, { severity: 'success' });
            void t.openTemplate(made.id);
          }}
        />
      )}
      {dialog?.kind === 'saveProject' && (
        <NameDialog
          title="Save this project as a template"
          description={`Copies this project's ${parameterCount} ${parameterCount === 1 ? 'parameter' : 'parameters'} (alias, description, AI instructions and unit) into a new personal template. Extracted values and documents are not copied. The unit copied is each parameter's current unit.`}
          initialName={projectName ? `${projectName} template` : ''}
          submitLabel="Save template"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const made = await t.saveProjectAsTemplate(projectId, name);
            toast.show(`Template “${made.name}” saved from this project.`, { severity: 'success' });
            void t.openTemplate(made.id);
          }}
        />
      )}
      {dialog?.kind === 'copy' && (
        <NameDialog
          title="Save a copy"
          description={`Copies “${dialog.template.name}” and its ${rules.length} ${rules.length === 1 ? 'rule' : 'rules'} into a new personal template you can change.`}
          initialName={copyName(dialog.template.name)}
          submitLabel="Save copy"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const made = await t.saveCopy(dialog.template, rules, name);
            toast.show(`Template “${made.name}” saved.`, { severity: 'success' });
            void t.openTemplate(made.id);
          }}
        />
      )}
      {dialog?.kind === 'rule' && openTemplate && canonical && (
        <RuleDialog
          key={dialog.rule?.id ?? 'new'}
          rule={dialog.rule}
          rules={rules}
          canonical={canonical}
          onClose={() => setDialog(null)}
          onSave={async (body) => {
            await t.saveRule(body);
            toast.show(dialog.rule ? 'Rule saved.' : 'Rule added.', { severity: 'success' });
          }}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={dialog?.kind === 'delete' ? `Delete “${dialog.template.name}”?` : 'Delete template?'}
        description="The template and its rules are deleted. Projects already made from it keep their parameters; only their link to the template is cleared. This cannot be undone."
        confirmLabel="Delete template"
        destructive
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDialog(null)}
      />
    </Box>
  );
}
