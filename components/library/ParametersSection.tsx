'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Skeleton } from '@mui/material';
import type { CanonicalParameter } from '@/api/templates';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchField } from '@/components/ui/SearchField';
import { toast } from '@/components/ui/Toast';
import { NewParameterDialog } from '@/components/parameters/NewParameterDialog';
import { useCanonicalParameters } from '@/hooks/useCanonicalParameters';
import { BUILTIN_NOTE, NEW_PARAMETER_EXPORT_NOTE, canEditParameter, groupDictionary } from '@/lib/parameters/dictionary';
import { DictionaryEditDialog } from './DictionaryEditDialog';

/** The whole canonical dictionary by category, with "New parameter" and Edit for parameters that are not built in. */
export function ParametersSection() {
  const { parameters, error, reload } = useCanonicalParameters();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CanonicalParameter | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (parameters ?? []).filter((p) => !q || [p.name, p.default_description ?? '', p.category ?? ''].some((t) => t.toLowerCase().includes(q)));
    return groupDictionary(list);
  }, [parameters, query]);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
        <SearchField value={query} onChange={setQuery} placeholder="Search parameters" sx={{ flex: 1, minWidth: 220 }} />
        <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          New parameter
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.muted', mb: 2 }}>{NEW_PARAMETER_EXPORT_NOTE}</Typography>

      {error ? (
        <ErrorState title="Could not load the parameter dictionary" description={error} onRetry={reload} />
      ) : !parameters ? (
        <Stack spacing={0.5} aria-busy="true" aria-label="Loading parameters">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={44} />)}
        </Stack>
      ) : groups.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.muted' }}>No parameter matches.</Typography>
      ) : (
        groups.map((g) => (
          <Box key={g.key} component="section" aria-label={g.label} sx={{ mb: 3, border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel', overflow: 'hidden' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1, bgcolor: 'surface.sunken' }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{g.label}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{g.parameters.length}</Typography>
            </Stack>
            {g.parameters.map((p) => (
              <Stack key={p.id} direction="row" spacing={1.5} alignItems="flex-start" sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'border.subtle' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.name}</Typography>
                    {p.expected_unit && <Chip size="small" variant="outlined" label={`Unit ${p.expected_unit}`} sx={{ height: 20 }} />}
                    {p.is_builtin && <Chip size="small" icon={<LockOutlinedIcon />} label="Built in" sx={{ height: 20 }} />}
                  </Stack>
                  <Typography variant="caption" sx={{ color: p.default_description ? 'text.secondary' : 'text.muted', display: 'block' }}>
                    {p.default_description || 'No description'}
                  </Typography>
                </Box>
                {canEditParameter(p) ? (
                  <Tooltip title="Edit description and unit">
                    <IconButton size="small" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title={BUILTIN_NOTE}>
                    <LockOutlinedIcon sx={{ fontSize: 18, color: 'text.muted', mt: 0.5 }} aria-label={BUILTIN_NOTE} />
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Box>
        ))
      )}

      {creating && (
        <NewParameterDialog
          onClose={() => setCreating(false)}
          onCreated={(p) => toast.show(`Parameter ${p.name} created.`, { severity: 'success' })}
        />
      )}
      {editing && <DictionaryEditDialog key={editing.id} parameter={editing} onClose={() => setEditing(null)} />}
    </Box>
  );
}
