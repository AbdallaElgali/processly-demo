'use client';

import { useMemo, useState } from 'react';
import {
  Box, Button, Chip, IconButton, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchField } from '@/components/ui/SearchField';
import { toast } from '@/components/ui/Toast';
import { useCanonicalParameters } from '@/hooks/useCanonicalParameters';
import { useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import { groupFields, resolveCategory } from '@/lib/categories';
import { errorMessage } from '@/lib/errors';
import { matchesQuery, metaOf, parametersNotInProject } from '@/lib/parameters/meta';
import { editParameterMetadata, loadProjectDetails, removeParameter } from '@/lib/project-data/actions';
import type { CanonicalParameter } from '@/api/templates';
import type { InputField } from '@/types';
import { ParameterEditDialog } from './ParameterEditDialog';

const B1 = 'Unavailable: the backend route that adds a parameter to a project fails (backend item B1).';

/**
 * The project's parameter schema (plan-A 6.5, AM14): this project's
 * parameters grouped by category, with the alias, description and AI
 * instructions editable and a parameter removable after a confirmation.
 * "Add parameter" is a labelled placeholder until the backend route works.
 */
export function ProjectParameters({ projectId }: { projectId: string }) {
  const state = useProjectData(projectId);
  const fields = state?.fields;
  const dirty = state?.dirty;
  const loading = !state || (state.loading.details && !state.details);
  const loadError = state?.error ?? null;
  const { parameters: canonical, error: canonicalError } = useCanonicalParameters();
  const activity = useProjectActivity(projectId);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<InputField | null>(null);
  const [removing, setRemoving] = useState<InputField | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);

  // Removing while an extraction or correction runs would pull a row out from under its save.
  const writing = [activity.running, activity.queued?.job].find((j) => j && j.kind !== 'upload');
  const removalPaused = !!writing;

  const canonicalByKey = useMemo(() => new Map((canonical ?? []).map((p) => [p.name, p])), [canonical]);

  const groups = useMemo(() => {
    const list = (fields ?? []).filter((f) => matchesQuery(f, canonicalByKey.get(f.id), query));
    const searching = query.trim() !== '';
    if (!canonical) return [{ key: 'all', label: 'Parameters', fields: list }];
    return groupFields(list, canonical)
      .filter((g) => !searching || g.fields.length > 0)
      .map((g) => ({ key: g.category.key, label: g.category.label, fields: g.fields }));
  }, [fields, canonical, canonicalByKey, query]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parametersNotInProject(canonical ?? [], fields ?? [])
      .filter((p) => !q || [p.name, p.default_description ?? '', p.category ?? ''].some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => resolveCategory(a.category).order - resolveCategory(b.category).order || a.name.localeCompare(b.name));
  }, [canonical, fields, query]);

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeParameter(projectId, removing.id, removing.dbId);
      toast.show(`${metaOf(removing).alias} removed from this project.`, { severity: 'success' });
      setRemoving(null);
    } catch (e) {
      toast.show(`Could not remove ${metaOf(removing).alias}: ${errorMessage(e)}`, { severity: 'error' });
    } finally {
      setRemoveBusy(false);
    }
  };

  const total = fields?.length ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: 'surface.panel' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        useFlexGap
        sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'border.subtle', flexWrap: 'wrap', minHeight: 52 }}
      >
        <Typography variant="subtitle2" sx={{ color: 'text.primary', mr: 0.5 }}>
          This project
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1, fontVariantNumeric: 'tabular-nums' }}>
            {total} {total === 1 ? 'parameter' : 'parameters'}
          </Typography>
        </Typography>
        <SearchField value={query} onChange={setQuery} placeholder="Search parameters" aria-label="Search parameters" sx={{ flex: 1, minWidth: 180 }} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled>
            Add parameter
          </Button>
          <Chip size="small" variant="outlined" color="warning" label="Unavailable (backend B1)" title={B1} />
        </Stack>
      </Stack>

      {removalPaused && (
        <Typography variant="caption" role="status" sx={{ px: 2, py: 0.75, bgcolor: 'status.infoBg', color: 'status.info', fontWeight: 600 }}>
          Removing is paused while this project&apos;s extraction is queued or running. Editing is still allowed.
        </Typography>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <Stack spacing={0.5} sx={{ p: 2 }} aria-busy="true" aria-label="Loading parameters">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={64} />
            ))}
          </Stack>
        ) : loadError && total === 0 ? (
          <ErrorState title="Could not load this project's parameters" description={loadError} onRetry={() => void loadProjectDetails(projectId)} />
        ) : total === 0 ? (
          <EmptyState
            icon={TuneOutlinedIcon}
            title="This project has no parameters"
            description="Parameters are copied from a template when the project is created. Adding one by hand is unavailable until the backend route is fixed (B1)."
          />
        ) : (
          <>
            {canonicalError && (
              <Typography variant="caption" role="alert" sx={{ display: 'block', px: 2, py: 0.75, color: 'status.warning', bgcolor: 'status.warningBg' }}>
                The parameter dictionary did not load, so parameters are not grouped by category and default descriptions are missing.
              </Typography>
            )}
            {groups.every((g) => g.fields.length === 0) && query.trim() !== '' && available.length === 0 ? (
              <EmptyState title="No parameter matches" description={`Nothing matches “${query.trim()}”.`} secondaryAction={{ label: 'Clear search', onClick: () => setQuery('') }} />
            ) : (
              groups.map((group) => (
                <Box key={group.key} role="group" aria-label={group.label}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ position: 'sticky', top: 0, zIndex: 1, px: 2, py: 0.75, bgcolor: 'surface.sunken', borderBottom: 1, borderColor: 'border.subtle' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{group.label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{group.fields.length}</Typography>
                  </Stack>
                  {group.fields.length === 0 ? (
                    <Typography variant="body2" sx={{ px: 2, py: 1.25, color: 'text.muted', borderBottom: 1, borderColor: 'border.subtle' }}>
                      No parameters in this category.
                    </Typography>
                  ) : (
                    <Box role="list">
                      {group.fields.map((field) => (
                        <ParameterItem
                          key={field.id}
                          field={field}
                          canonical={canonicalByKey.get(field.id)}
                          unsaved={!!dirty?.includes(field.id)}
                          removalPaused={removalPaused}
                          onEdit={() => setEditing(field)}
                          onRemove={() => setRemoving(field)}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              ))
            )}

            {canonical && (
              <Box sx={{ borderTop: 1, borderColor: 'border.subtle' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowAvailable((v) => !v)}
                  aria-expanded={showAvailable}
                  aria-controls="available-parameters"
                  sx={{
                    all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
                    bgcolor: 'surface.sunken', color: 'text.primary',
                    '&:hover': { filter: 'brightness(0.98)' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'accent.focus', outlineOffset: -2 },
                  }}
                >
                  <ExpandMoreIcon sx={{ fontSize: 20, transform: showAvailable ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Not in this project</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{available.length}</Typography>
                </Box>
                {showAvailable && (
                  <Box id="available-parameters">
                    <Typography variant="caption" sx={{ display: 'block', px: 2, py: 0.75, color: 'status.warning', bgcolor: 'status.warningBg', fontWeight: 600 }}>
                      {B1}
                    </Typography>
                    {available.length === 0 ? (
                      <Typography variant="body2" sx={{ px: 2, py: 1.25, color: 'text.muted' }}>
                        {query.trim() ? 'No dictionary parameter matches.' : 'This project has every parameter in the dictionary.'}
                      </Typography>
                    ) : (
                      <Box role="list">
                        {available.map((p) => (
                          <AvailableItem key={p.id} parameter={p} />
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      {editing && (
        <ParameterEditDialog
          key={editing.id}
          field={editing}
          defaultDescription={canonicalByKey.get(editing.id)?.default_description ?? null}
          onSave={async (patch) => {
            await editParameterMetadata(projectId, editing.dbId, patch);
            toast.show(`${metaOf(editing).alias} updated.`, { severity: 'success' });
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Remove ${metaOf(removing).alias}?` : 'Remove parameter?'}
        description={
          removing && (
            <>
              <Box component="span" sx={{ fontFamily: 'monospace' }}>{removing.id}</Box> is deleted from this project, together with
              the values extracted for it and its flag history. This cannot be undone.
              {dirty?.includes(removing.id) ? ' Its unsaved edit is discarded.' : ''} Documents and the other parameters are not touched.
            </>
          )
        }
        confirmLabel="Remove parameter"
        destructive
        busy={removeBusy}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </Box>
  );
}

function ParameterItem({
  field,
  canonical,
  unsaved,
  removalPaused,
  onEdit,
  onRemove,
}: {
  field: InputField;
  canonical: CanonicalParameter | undefined;
  unsaved: boolean;
  removalPaused: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const meta = metaOf(field);
  const description = meta.description.trim();
  const fallback = canonical?.default_description ?? null;
  return (
    <Box
      role="listitem"
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.25, borderBottom: 1, borderColor: 'border.subtle',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{meta.alias}</Typography>
          {meta.alias !== field.id && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.muted' }}>{field.id}</Typography>
          )}
          {canonical?.expected_unit && (
            <Chip size="small" variant="outlined" label={canonical.expected_unit} title="Expected unit from the dictionary" sx={{ height: 20 }} />
          )}
          {unsaved && (
            <Chip size="small" color="warning" variant="outlined" label="Unsaved value edit" title="This parameter has an unsaved value edit in the Workspace" sx={{ height: 20 }} />
          )}
        </Stack>
        <Typography
          variant="body2"
          sx={{
            color: description ? 'text.secondary' : 'text.muted', fontStyle: description ? 'normal' : 'italic', mt: 0.25,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {description || (fallback ? `Default: ${fallback}` : 'No description')}
        </Typography>
        {meta.aiInstructions.trim() && (
          <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 0.5, color: 'status.info' }}>
            <SmartToyOutlinedIcon sx={{ fontSize: 15, mt: '2px', flexShrink: 0 }} aria-label="AI instructions" />
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {meta.aiInstructions.trim()}
            </Typography>
          </Stack>
        )}
      </Box>
      <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
        <Tooltip title="Edit alias, description and AI instructions">
          <IconButton size="small" aria-label={`Edit ${meta.alias}`} onClick={onEdit}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={removalPaused ? 'Paused while an extraction is queued or running' : 'Remove from this project'}>
          <span>
            <IconButton size="small" aria-label={`Remove ${meta.alias}`} onClick={onRemove} disabled={removalPaused} sx={{ '&:hover': { color: 'status.danger' } }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function AvailableItem({ parameter }: { parameter: CanonicalParameter }) {
  return (
    <Box role="listitem" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: 1, borderColor: 'border.subtle' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>{parameter.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{resolveCategory(parameter.category).label}</Typography>
          {parameter.expected_unit && <Chip size="small" variant="outlined" label={parameter.expected_unit} sx={{ height: 20 }} />}
        </Stack>
        {parameter.default_description && (
          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.25 }}>{parameter.default_description}</Typography>
        )}
      </Box>
      <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled aria-label={`Add ${parameter.name} (unavailable)`}>
        Add
      </Button>
    </Box>
  );
}
