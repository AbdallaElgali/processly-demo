'use client';

import { Box, CircularProgress, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { ProjectDocument } from '@/api/types/projects';
import type { Job } from '@/lib/jobs/types';

const isPdf = (name: string, type: string) => type.toLowerCase().includes('pdf') || name.toLowerCase().endsWith('.pdf');

/**
 * One tab per project document above the viewer (AM11). Replaces Extract's
 * documents table: "not yet analyzed", in-flight uploads and rejected files
 * are shown here instead. Step 9 (AM12) adds overflow search, per-document
 * view state, prefetch and next/previous shortcuts.
 */
export function DocumentTabs({
  documents,
  activeId,
  onSelect,
  uploadJobs,
}: {
  documents: ProjectDocument[];
  activeId: string | null;
  onSelect: (id: string) => void;
  uploadJobs: Job[];
}) {
  const inFlight = uploadJobs
    .filter((j) => j.status === 'queued' || j.status === 'running')
    .flatMap((j) => (j.payload.kind === 'upload' ? j.payload.fileRefs.map((f) => ({ key: `${j.id}-${f.idbId}`, name: f.name, queued: j.status === 'queued' })) : []));
  const rejected = uploadJobs
    .filter((j) => j.status === 'completed' && (j.uploadWarnings?.length ?? 0) > 0)
    .flatMap((j) => j.uploadWarnings ?? []);

  const value = documents.some((d) => d.id === activeId) ? activeId : false;

  return (
    <Stack direction="row" alignItems="center" sx={{ borderBottom: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel', minHeight: 44 }}>
      <Tabs
        value={value}
        onChange={(_, id: string) => onSelect(id)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Project documents"
        sx={{ flex: 1, minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', maxWidth: 260 } }}
      >
        {documents.map((d) => {
          const Icon = isPdf(d.name, d.type) ? PictureAsPdfOutlinedIcon : TableChartOutlinedIcon;
          return (
            <Tab
              key={d.id}
              value={d.id}
              iconPosition="start"
              icon={<Icon sx={{ fontSize: 18 }} />}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap title={d.name} sx={{ color: 'inherit' }}>{d.name}</Typography>
                  {!d.analyzed && (
                    <Tooltip title="Uploaded, but not yet analyzed">
                      <Box component="span" sx={{ px: 0.5, borderRadius: 0.5, fontSize: 11, fontWeight: 600, bgcolor: 'status.neutralBg', color: 'status.neutral', whiteSpace: 'nowrap' }}>
                        not analyzed
                      </Box>
                    </Tooltip>
                  )}
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      {inFlight.map((f) => (
        <Tooltip key={f.key} title={f.queued ? 'Queued for upload' : 'Uploading'}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.5, color: 'text.secondary', maxWidth: 220 }}>
            <CircularProgress size={12} thickness={5} variant={f.queued ? 'determinate' : 'indeterminate'} value={f.queued ? 25 : undefined} />
            <Typography variant="body2" noWrap>{f.name}</Typography>
          </Stack>
        </Tooltip>
      ))}

      {rejected.length > 0 && (
        <Tooltip title={`Not accepted: ${rejected.join('; ')}`}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1.5, color: 'status.warning' }} tabIndex={0} aria-label={`${rejected.length} file(s) not accepted: ${rejected.join('; ')}`}>
            <WarningAmberIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              {rejected.length} not accepted
            </Typography>
          </Stack>
        </Tooltip>
      )}
    </Stack>
  );
}
