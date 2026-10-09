'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import {
  Box, Button, Chip, Divider, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';

import { tokens } from '@/theme/tokens';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { ProjectRail } from '@/components/shell/ProjectRail';
import { AppHeader } from '@/components/shell/AppHeader';
import { JobBadge, type BadgeKind } from '@/components/jobs/JobBadge';
import { useThemePreference } from '@/hooks/useThemePreference';
import { useLocalStorageFlag } from '@/hooks/useLocalStorageFlag';

import { SearchField } from '@/components/ui/SearchField';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCardGrid, SkeletonRows } from '@/components/ui/Skeletons';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { toast, ToastHost } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormDialog } from '@/components/ui/FormDialog';
import { DensityToggle, type Density } from '@/components/ui/DensityToggle';
import { GuidedTour } from '@/components/ui/GuidedTour';

const BADGE_KINDS: { kind: BadgeKind }[] = [
  { kind: 'running' }, { kind: 'queued' }, { kind: 'unseen' }, { kind: 'failed' }, { kind: 'interrupted' },
];

interface Run { id: string; type: string; model: string; date: string }
const MOCK_RUNS: Run[] = [
  { id: '1', type: 'MAIN_MULTI_AGENT', model: 'gpt-5', date: '2026-10-08' },
  { id: '2', type: 'ITERATIVE', model: 'gpt-5', date: '2026-10-08' },
  { id: '3', type: 'SINGLE_PARAM', model: 'gpt-5-mini', date: '2026-10-09' },
];
const RUN_COLUMNS: DataTableColumn<Run>[] = [
  { key: 'type', label: 'Type', sortable: true, value: (r) => r.type },
  { key: 'model', label: 'Model', sortable: true, value: (r) => r.model },
  { key: 'date', label: 'Date', sortable: true, value: (r) => r.date },
];

/**
 * The component gallery (plan-A section 2, step 5). Absorbs `/dev/theme`'s
 * token preview as its first section.
 *
 * Per AM5, the shell components (AppHeader, ProjectRail, Breadcrumb,
 * ThemeToggle, JobBadge) were built to the full 8.4 bar in step 3 and are
 * shown here, not rebuilt. JobBanner and JobTray (also already built) read
 * live state from the real job store, so faking their running/failed/etc.
 * states here would mean injecting fabricated jobs into production state;
 * instead they are described, and their states are visible for real once a
 * job runs (Extract/Review, steps 7-10).
 */
export default function GalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { mode, ready } = useThemePreference();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formValue, setFormValue] = useState('');
  const [tableState, setTableState] = useState<'data' | 'loading' | 'error' | 'empty'>('data');
  const [density, setDensity] = useState<Density>('comfortable');
  const [tourDismissed, setTourDismissed] = useLocalStorageFlag('gallery.tour.dismissed', false);

  const swatchGroups = [
    ['accent', tokens.light.accent],
    ['surface', tokens.light.surface],
    ['border', tokens.light.border],
    ['status', tokens.light.status],
  ] as const;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'surface.canvas' }}>
      <ToastHost />
      {!tourDismissed && (
        <GuidedTour
          storageKey="gallery.tour.dismissed"
          steps={[
            { target: '[data-tour="gallery-title"]', title: 'Welcome', body: 'This gallery shows every shared primitive in both colour modes.' },
            { target: '[data-tour="restart-tour"]', title: 'Come back any time', body: 'Dismissal is remembered per browser; this button clears it.' },
          ]}
        />
      )}

      <Box sx={{ p: 4, maxWidth: 1100, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
          <Typography variant="h4" sx={{ color: 'text.primary' }} data-tour="gallery-title">
            Component gallery
          </Typography>
          <ThemeToggle />
          <Chip
            size="small"
            label={ready ? `mode: ${mode}` : 'mode: resolving'}
            sx={{ bgcolor: 'status.neutralBg', color: 'status.neutral' }}
          />
          <Button
            data-tour="restart-tour"
            size="small"
            onClick={() => setTourDismissed(false)}
          >
            Restart tour
          </Button>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Every colour below is a palette token (verified by{' '}
          <code>npm run check:contrast</code>), and every control below is
          reachable by keyboard. Toggle the theme and tab through to check
          both.
        </Typography>

        {/* ---------------------------------------------------------- Tokens */}
        <Section title="Tokens">
          {swatchGroups.map(([group, values]) => (
            <Box key={group} sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1.5 }}>
                {group}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {Object.keys(values)
                  .filter((key) => !key.startsWith('$'))
                  .map((key) => (
                    <Paper
                      key={key}
                      elevation={0}
                      sx={{ width: 150, p: 1.5, border: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel' }}
                    >
                      <Box
                        sx={{
                          height: 40, borderRadius: 1, mb: 1, border: 1,
                          borderColor: 'border.subtle', bgcolor: `${group}.${key}`,
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {group}.{key}
                      </Typography>
                    </Paper>
                  ))}
              </Box>
            </Box>
          ))}

          <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1.5 }}>
            document (mode-invariant — stays light in both modes, CLAUDE.md 8.3)
          </Typography>
          <Box sx={{ p: 3, bgcolor: 'document.canvas', borderRadius: 1 }}>
            <Box
              sx={{
                p: 3, bgcolor: 'document.page', color: 'document.text', border: 1,
                borderColor: 'document.gridLine', position: 'relative', maxWidth: 420,
              }}
            >
              <Typography variant="body2" sx={{ color: 'document.text' }}>
                Nennkapazitat: 4.2 Ah
              </Typography>
              <Box
                sx={{
                  position: 'absolute', inset: '8px 8px auto 8px', height: 28,
                  border: 2, borderColor: 'document.highlightStroke',
                  bgcolor: 'document.highlightFill', borderRadius: 0.5,
                }}
              />
            </Box>
          </Box>
        </Section>

        {/* ------------------------------------------------- Shell & nav (step 3) */}
        <Section title="Shell & navigation" subtitle="Built in step 3; shown here, not rebuilt (AM5).">
          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mb: 1 }}>
            AppHeader — reflects this browser&apos;s real signed-in user and job tray.
          </Typography>
          <Box sx={{ border: 1, borderColor: 'border.subtle', mb: 3 }}>
            <AppHeader breadcrumb={<Breadcrumb customer="Acme GmbH" project="D11-A" />} />
          </Box>

          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mb: 1 }}>
            ProjectRail — collapse toggle and arrow/Home/End keyboard navigation (tab in, then try arrow keys).
          </Typography>
          <Box sx={{ height: 360, border: 1, borderColor: 'border.subtle', display: 'flex', mb: 3 }}>
            <ProjectRail
              projectId="gallery-demo-project"
              collapsed={railCollapsed}
              onToggleCollapsed={() => setRailCollapsed((c) => !c)}
            />
            <Box sx={{ flex: 1, p: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Screen content goes here.
              </Typography>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mb: 1 }}>
            JobBadge — every kind. Never colour alone: each has a tooltip and an aria-label.
          </Typography>
          <Stack direction="row" spacing={3} sx={{ mb: 1 }}>
            {BADGE_KINDS.map(({ kind }) => (
              <Stack key={kind} direction="row" spacing={1} alignItems="center">
                <JobBadge kind={kind} size={10} />
                <Typography variant="body2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                  {kind}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.muted' }}>
            JobBanner and JobTray (components/jobs) read live state from the job
            store — their queued/running/interrupted/failed states are visible
            for real once a job runs (Extract and Review, steps 7-10), rather
            than faked here with injected job records.
          </Typography>
        </Section>

        {/* --------------------------------------------------------- Inputs */}
        <Section title="Inputs & buttons">
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Button variant="contained">Contained</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="text">Text</Button>
            <Button variant="contained" disabled>Disabled</Button>
            <Button variant="contained" loading>Loading</Button>
            <TextField size="small" label="Input" defaultValue="4.2" />
            <Switch defaultChecked />
            <Chip label="Chip" />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mb: 1 }}>
            SearchField — Esc clears, and the global &quot;/&quot; shortcut focuses it.
          </Typography>
          <SearchField value={search} onChange={setSearch} placeholder="Try typing, then press Esc" sx={{ mb: 1 }} />

          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 2, mb: 1 }}>
            StatusChip — the four project lifecycle states.
          </Typography>
          <Stack direction="row" spacing={1}>
            <StatusChip status="NEW" />
            <StatusChip status="PENDING_REVIEW" />
            <StatusChip status="IN_REVIEW" />
            <StatusChip status="APPROVED" />
          </Stack>

          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 2, mb: 1 }}>
            DensityToggle — controlled; the caller persists the choice.
          </Typography>
          <DensityToggle value={density} onChange={setDensity} />
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Current density: {density}
          </Typography>
        </Section>

        {/* ---------------------------------------------- Feedback & empty states */}
        <Section title="Feedback & empty states">
          <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1 }}>Toast</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
            <Button size="small" onClick={() => toast.show('Extraction complete.', { severity: 'success', action: { label: 'Open', onClick: () => {} } })}>
              Success + action
            </Button>
            <Button size="small" onClick={() => toast.show('Cap reached: 40 of 52 assignments kept.', { severity: 'warning' })}>
              Warning
            </Button>
            <Button size="small" onClick={() => toast.show('Upload failed for 2 files.', { severity: 'error' })}>
              Error
            </Button>
            <Button size="small" onClick={() => toast.show('New results are in.', { severity: 'info', durationMs: 60000 })}>
              Info (hover to pause, 60s)
            </Button>
          </Stack>

          <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1 }}>EmptyState</Typography>
          <Paper variant="outlined" sx={{ borderColor: 'border.subtle', mb: 3 }}>
            <EmptyState
              icon={FolderOpenOutlinedIcon}
              title="No projects yet"
              description="Create a project, upload its datasheets, and run an extraction."
              action={{ label: 'New project', onClick: () => {} }}
            />
          </Paper>
          <Paper variant="outlined" sx={{ borderColor: 'border.subtle', mb: 3 }}>
            <EmptyState
              icon={SearchOffOutlinedIcon}
              title="Nothing matches that search"
              description="Try a different name, customer or status."
              secondaryAction={{ label: 'Clear search', onClick: () => {} }}
            />
          </Paper>

          <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1 }}>ErrorState</Typography>
          <Paper variant="outlined" sx={{ borderColor: 'border.subtle', mb: 3 }}>
            <ErrorState description="The project list could not be loaded." onRetry={() => {}} />
          </Paper>

          <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1 }}>Skeletons</Typography>
          <Box sx={{ mb: 1 }}>
            <SkeletonCardGrid count={3} />
          </Box>
          <SkeletonRows count={3} columns={3} />
        </Section>

        {/* --------------------------------------------------------- Dialogs */}
        <Section title="Dialogs">
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
              Open ConfirmDialog
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
              Open FormDialog
            </Button>
          </Stack>

          <ConfirmDialog
            open={confirmOpen}
            title="Remove this parameter?"
            description="This only removes it from the project; the canonical dictionary is unaffected."
            confirmLabel="Remove"
            destructive
            busy={confirmBusy}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmBusy(true);
              setTimeout(() => { setConfirmBusy(false); setConfirmOpen(false); }, 900);
            }}
          />

          <FormDialog
            open={formOpen}
            title="New template"
            onClose={() => setFormOpen(false)}
            submitLabel="Create"
            busy={formBusy}
            submitDisabled={!formValue.trim()}
            onSubmit={() => {
              setFormBusy(true);
              setTimeout(() => { setFormBusy(false); setFormOpen(false); setFormValue(''); }, 900);
            }}
          >
            <TextField
              autoFocus label="Template name" value={formValue} fullWidth
              onChange={(e) => setFormValue(e.target.value)}
            />
          </FormDialog>
        </Section>

        {/* ------------------------------------------------------- Data table */}
        <Section title="DataTable">
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            {(['data', 'loading', 'error', 'empty'] as const).map((s) => (
              <Button key={s} size="small" variant={tableState === s ? 'contained' : 'outlined'} onClick={() => setTableState(s)}>
                {s}
              </Button>
            ))}
          </Stack>
          <DataTable
            columns={RUN_COLUMNS}
            rows={tableState === 'empty' ? [] : MOCK_RUNS}
            getRowKey={(r) => r.id}
            loading={tableState === 'loading'}
            error={tableState === 'error' ? 'Could not load extraction runs.' : null}
            emptyTitle="No runs yet"
            emptyDescription="Run an extraction to see it here."
            defaultSortKey="date"
          />
        </Section>
      </Box>
    </Box>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 5 }}>
      <Typography variant="h6" sx={{ color: 'text.primary' }}>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mb: 2 }}>{subtitle}</Typography>
      )}
      <Divider sx={{ my: 2 }} />
      {children}
    </Box>
  );
}
