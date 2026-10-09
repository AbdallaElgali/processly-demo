'use client';

import dynamic from 'next/dynamic';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import type { ProjectDocument } from '@/api/types/projects';
import type { DocFileState } from '@/lib/documents/fileStore';
import { IDLE } from '@/lib/documents/fileStore';
import type { ViewerHighlight } from '@/components/DocumentViewer/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SourceUnavailable } from '@/components/DocumentViewer/SourceUnavailable';
import { ViewerErrorBoundary } from '@/components/DocumentViewer/ViewerErrorBoundary';

// react-pdf needs the browser (DOMMatrix, workers), so the viewers never render on the server.
const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((m) => m.DocumentRouter),
  { ssr: false, loading: () => <ViewerSkeleton /> },
);

function ViewerSkeleton() {
  return (
    <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ height: '100%', bgcolor: 'document.canvas' }} aria-busy="true">
      <Skeleton variant="rectangular" sx={{ width: '70%', height: '70%', bgcolor: 'document.page' }} />
      <Typography variant="caption" sx={{ color: 'document.text' }}>Loading document…</Typography>
    </Stack>
  );
}

/**
 * The viewer area (AM12). The active document is shown; the last few viewed
 * stay mounted underneath, hidden (`visibility: hidden` keeps their size and
 * scroll position, `inert` keeps them out of the tab order and away from
 * screen readers), so switching back is instant and does not re-parse.
 */
export function DocumentViewport({
  projectId,
  documents,
  activeId,
  mountedIds,
  highlights,
  files,
  uploadsInFlight,
  onRetry,
}: {
  projectId: string;
  documents: ProjectDocument[];
  activeId: string | null;
  mountedIds: string[];
  highlights: Record<string, ViewerHighlight>;
  files: ReadonlyMap<string, DocFileState>;
  uploadsInFlight: boolean;
  onRetry: (doc: ProjectDocument) => void;
}) {
  if (!activeId) {
    return (
      <Box sx={{ flex: 1, bgcolor: 'surface.canvas', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          icon={DescriptionOutlinedIcon}
          title={uploadsInFlight ? 'Upload in progress' : 'No document open'}
          description={uploadsInFlight ? 'The document appears here once the upload finishes.' : 'Choose a document above.'}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, position: 'relative', bgcolor: 'document.canvas' }}>
      {/* Rendered in tab order, not recency order: reordering the stack moved
          live pdf.js canvases between DOM positions and remounted a viewer
          mid-switch, which crashed react-pdf (a page asking a destroyed
          document for its content). */}
      {documents.filter((d) => mountedIds.includes(d.id)).map((doc) => {
        const id = doc.id;
        const file = files.get(id) ?? IDLE;
        const active = id === activeId;
        return (
          <Box
            key={id}
            inert={!active}
            aria-hidden={!active}
            sx={{ position: 'absolute', inset: 0, visibility: active ? 'visible' : 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            {file.status === 'ready' && file.url && file.mime ? (
              <ViewerErrorBoundary name={doc.name}>
                <DocumentRouter projectId={projectId} documentId={id} fileUrl={file.url} mime={file.mime} highlight={highlights[id] ?? null} />
              </ViewerErrorBoundary>
            ) : file.status === 'unavailable' ? (
              <SourceUnavailable name={doc.name} onRetry={() => onRetry(doc)} />
            ) : file.status === 'error' ? (
              <Box sx={{ height: '100%', bgcolor: 'surface.canvas' }}>
                <ErrorState title="The document could not be loaded" description={file.error ?? undefined} onRetry={() => onRetry(doc)} />
              </Box>
            ) : (
              <ViewerSkeleton />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
