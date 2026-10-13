'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Box, Button, CircularProgress, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import type { ProjectDocument } from '@/api/types/projects';
import type { Job } from '@/lib/jobs/types';
import { IDLE, isPdfDocument, type DocFileState } from '@/lib/documents/fileStore';
import { SearchField } from '@/components/ui/SearchField';

/** The small status beside a tab's name: fetch state first, then "not analyzed". */
function DocStatus({ doc, file }: { doc: ProjectDocument; file: DocFileState }) {
  if (file.status === 'unavailable') {
    return (
      <Tooltip title="Source file unavailable on the server; extracted values are preserved">
        <CloudOffOutlinedIcon aria-label="Source unavailable" sx={{ fontSize: 16, color: 'text.muted' }} />
      </Tooltip>
    );
  }
  if (file.status === 'error') {
    return (
      <Tooltip title={file.error ?? 'Could not be loaded'}>
        <ErrorOutlineIcon aria-label="Could not be loaded" sx={{ fontSize: 16, color: 'status.danger' }} />
      </Tooltip>
    );
  }
  if (!doc.analyzed) {
    return (
      <Tooltip title="Uploaded, but not yet analyzed">
        <Box component="span" sx={{ px: 0.5, borderRadius: 0.5, fontSize: 11, fontWeight: 600, bgcolor: 'status.neutralBg', color: 'status.neutral', whiteSpace: 'nowrap' }}>
          not analyzed
        </Box>
      </Tooltip>
    );
  }
  return null;
}

const DocIcon = ({ doc, size = 18 }: { doc: ProjectDocument; size?: number }) => {
  const Icon = isPdfDocument(doc) ? PictureAsPdfOutlinedIcon : TableChartOutlinedIcon;
  return <Icon sx={{ fontSize: size }} />;
};

/**
 * One tab per project document above the viewer (AM11, AM12), with the
 * fetch state on each tab ("source unavailable", load error, "not
 * analyzed"), in-flight uploads and rejected files. The "all documents" menu
 * lists every document with a search, for projects whose tabs overflow.
 * `,` and `.` move to the previous / next document (handled by the
 * Workspace, listed in its `?` sheet).
 */
export function DocumentTabs({
  documents,
  activeId,
  onSelect,
  uploadJobs,
  files,
}: {
  documents: ProjectDocument[];
  activeId: string | null;
  onSelect: (id: string) => void;
  uploadJobs: Job[];
  files: ReadonlyMap<string, DocFileState>;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const firstItem = useRef<HTMLLIElement>(null);

  const inFlight = uploadJobs
    .filter((j) => j.status === 'queued' || j.status === 'running')
    .flatMap((j) => (j.payload.kind === 'upload' ? j.payload.fileRefs.map((f) => ({ key: `${j.id}-${f.idbId}`, name: f.name, queued: j.status === 'queued' })) : []));
  const rejected = uploadJobs
    .filter((j) => j.status === 'completed' && (j.uploadWarnings?.length ?? 0) > 0)
    .flatMap((j) => j.uploadWarnings ?? []);

  const value = documents.some((d) => d.id === activeId) ? activeId : false;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? documents.filter((d) => d.name.toLowerCase().includes(q)) : documents;
  }, [documents, query]);

  const closeMenu = () => {
    setMenuAnchor(null);
    setQuery('');
  };
  const choose = (id: string) => {
    onSelect(id);
    closeMenu();
  };

  return (
    <Stack direction="row" alignItems="center" sx={{ borderBottom: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel', minHeight: 44, flexShrink: 0 }}>
      <Tabs
        value={value}
        onChange={(_, id: string) => onSelect(id)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Project documents"
        sx={{ flex: 1, minWidth: 0, minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', maxWidth: 260, color: 'text.secondary', gap: 0.75 }, '& .MuiTab-iconWrapper': { m: 0 }, '& .Mui-selected': { color: 'text.primary' } }}
      >
        {documents.map((d) => {
          const file = files.get(d.id) ?? IDLE;
          return (
            <Tab
              key={d.id}
              value={d.id}
              iconPosition="start"
              icon={file.status === 'loading' && d.id === activeId ? <CircularProgress size={14} thickness={5} aria-label="Loading" /> : <DocIcon doc={d} />}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap title={d.name} sx={{ color: 'inherit' }}>{d.name}</Typography>
                  <DocStatus doc={d} file={file} />
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

      {documents.length > 1 && (
        <Tooltip title="All documents (previous , · next .)">
          <Button
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            endIcon={<ExpandMoreIcon />}
            aria-haspopup="menu"
            aria-expanded={!!menuAnchor}
            aria-label={`All documents, ${documents.length}`}
            sx={{ mx: 0.5, flexShrink: 0, color: 'text.secondary', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            {documents.length}
          </Button>
        </Tooltip>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)' } }, list: { 'aria-label': 'All documents', dense: true } }}
        disableAutoFocusItem
      >
        <Box
          sx={{ px: 1.5, pt: 0.5, pb: 1 }}
          // Keeps MenuList's type-ahead from stealing the search's keystrokes.
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              firstItem.current?.focus();
            } else if (e.key === 'Enter' && matches[0]) {
              e.preventDefault();
              choose(matches[0].id);
            } else if (e.key !== 'Escape' && e.key !== 'Tab') {
              e.stopPropagation();
            }
          }}
        >
          <SearchField value={query} onChange={setQuery} placeholder="Find a document" autoFocus fullWidth sx={{ maxWidth: 'none' }} />
        </Box>
        {matches.length === 0 && (
          <Typography variant="body2" sx={{ px: 2, py: 1, color: 'text.muted' }}>No document matches “{query}”.</Typography>
        )}
        {matches.map((d, i) => {
          const file = files.get(d.id) ?? IDLE;
          return (
            <MenuItem key={d.id} ref={i === 0 ? firstItem : undefined} selected={d.id === activeId} onClick={() => choose(d.id)}>
              <ListItemIcon sx={{ color: 'text.secondary' }}><DocIcon doc={d} /></ListItemIcon>
              <ListItemText primary={d.name} slotProps={{ primary: { noWrap: true, title: d.name } }} />
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ ml: 1 }}>
                <DocStatus doc={d} file={file} />
                {d.id === activeId && <CheckIcon sx={{ fontSize: 16, color: 'accent.text' }} aria-label="Open" />}
              </Stack>
            </MenuItem>
          );
        })}
      </Menu>
    </Stack>
  );
}
