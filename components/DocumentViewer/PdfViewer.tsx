'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Box, Divider, IconButton, InputBase, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenOutlinedIcon from '@mui/icons-material/FitScreenOutlined';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ErrorState } from '@/components/ui/ErrorState';
import { projectDataStore } from '@/lib/project-data/store';
import { bboxToPageRect } from '@/lib/documents/pdfGeometry';
import { HIGHLIGHT_PAD_PX } from '@/lib/documents/config';
import { shadow } from '@/theme/tokens';
import type { ViewerHighlight } from './types';

// Served from public/pdfjs/ (scripts/copy-pdf-assets.mjs), never from a CDN.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

/**
 * Module-level so react-pdf sees the same object every render; a new options
 * object makes it reload the document. CMaps and standard fonts are local for
 * the same reason as the worker. `verbosity: 0` (errors only) drops pdf.js's
 * font-hinting warnings ("TT: undefined function"), which are about the file,
 * not the app, and otherwise fill the console on some producers' PDFs.
 */
const PDF_OPTIONS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  verbosity: 0,
};

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const PAGE_GAP = 16;
const PAD = 16;

interface PageMeta {
  view: [number, number, number, number];
  rotate: number;
  /** Displayed width / height (rotation applied). */
  aspect: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Backend page numbers are 1-based; a 0 has been seen on single-page sources. */
const targetPage = (h: ViewerHighlight | null, numPages: number) => {
  const p = h?.source.pageNumber;
  if (p === null || p === undefined) return null;
  return Math.min(Math.max(p === 0 ? 1 : p, 1), Math.max(numPages, 1));
};

interface PdfViewerProps {
  fileUrl: string;
  projectId: string;
  documentId: string;
  highlight: ViewerHighlight | null;
}

/**
 * The PDF viewer (plan-A §8, AM12, AM13).
 *
 * - Chrome on theme tokens; only the page itself (`document.page`) stays white.
 * - Pages are virtualised: every page has its real size from the start (read
 *   from pdf.js before anything renders), but only those near the viewport
 *   render a canvas. Large specifications open and switch quickly.
 * - Where the user was (page, offset in page, zoom) is saved per document in
 *   the project-data store and restored on return, also after this viewer was
 *   unmounted.
 * - Highlights go through `bboxToPageRect`, which handles the bottom-left
 *   origin, offset MediaBoxes and rotated pages. A source with a page but no
 *   usable box gets the labelled "Approximate location" page outline (DAM).
 */
export function PdfViewer({ fileUrl, projectId, documentId, highlight }: PdfViewerProps) {
  const saved = useMemo(() => projectDataStore.getDocumentView(projectId, documentId), [projectId, documentId]);

  const [pages, setPages] = useState<PageMeta[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(saved?.scale ?? 1);
  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageInput, setPageInput] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Where the viewport is, as page + fraction; re-applied after every re-layout. */
  const posRef = useRef<{ page: number; offset: number }>({ page: saved?.page ?? 1, offset: saved?.pageOffset ?? 0 });
  const handledNonce = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  // ---- layout -------------------------------------------------------------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // A hidden-but-mounted viewer keeps its size (it is visibility:hidden,
      // not display:none); a 0 here is a transient detach, so ignore it.
      if (el.clientWidth > 0) setWidth(el.clientWidth);
      setViewport({ top: el.scrollTop, height: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(160, width - PAD * 2) * scale;
  const layout = useMemo(() => {
    if (!pages) return null;
    const heights = pages.map((p) => pageWidth / p.aspect);
    const offsets: number[] = [];
    let y = PAD;
    for (const h of heights) {
      offsets.push(y);
      y += h + PAGE_GAP;
    }
    return { heights, offsets, total: y - PAGE_GAP + PAD };
  }, [pages, pageWidth]);

  const ready = !!layout && width > 0;

  const pageAt = useCallback(
    (y: number) => {
      if (!layout) return 1;
      let lo = 0;
      let hi = layout.offsets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (layout.offsets[mid] <= y) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
    [layout],
  );

  // Re-apply the remembered position after any re-layout (first load, zoom,
  // pane resize), so the user stays on the same spot of the same page.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!ready || !el || !layout) return;
    const { page, offset } = posRef.current;
    const i = Math.min(Math.max(page, 1), layout.offsets.length) - 1;
    // Positions are measured from PAD above the page, so page 1 at offset 0 is the very top.
    el.scrollTop = layout.offsets[i] - PAD + offset * layout.heights[i];
    setViewport({ top: el.scrollTop, height: el.clientHeight });
  }, [ready, layout]);

  const onScroll = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = scrollRef.current;
      if (!el || !layout) return;
      const page = pageAt(el.scrollTop + PAD);
      const offset = Math.min(1, Math.max(0, (el.scrollTop + PAD - layout.offsets[page - 1]) / layout.heights[page - 1]));
      posRef.current = { page, offset };
      projectDataStore.setDocumentView(projectId, documentId, { page, pageOffset: offset });
      setViewport({ top: el.scrollTop, height: el.clientHeight });
    });
  };

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const changeScale = (next: number) => {
    const clamped = Math.min(3, Math.max(0.5, next));
    setScale(clamped);
    projectDataStore.setDocumentView(projectId, documentId, { scale: clamped });
  };
  const zoomStep = (dir: 1 | -1) => {
    const next =
      dir === 1
        ? (ZOOM_STEPS.find((z) => z > scale + 1e-6) ?? 3)
        : ([...ZOOM_STEPS].reverse().find((z) => z < scale - 1e-6) ?? 0.5);
    changeScale(next);
  };

  const goToPage = (page: number) => {
    const el = scrollRef.current;
    if (!el || !layout) return;
    const i = Math.min(Math.max(page, 1), layout.offsets.length) - 1;
    el.scrollTo({ top: layout.offsets[i] - PAD, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // ---- jump to a highlight (once per jump, identified by its nonce) ------
  const numPages = pages?.length ?? 0;
  const hlPage = targetPage(highlight, numPages);
  const hlRect = useMemo(() => {
    if (!highlight || !pages || hlPage === null) return null;
    const meta = pages[hlPage - 1];
    return meta ? bboxToPageRect(highlight.source.boundingBox, meta.view, meta.rotate) : null;
  }, [highlight, pages, hlPage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!highlight || !ready || !el || !layout || hlPage === null) return;
    if (handledNonce.current === highlight.nonce) return;
    handledNonce.current = highlight.nonce;
    const i = hlPage - 1;
    let top = layout.offsets[i] - PAD;
    let left = el.scrollLeft;
    if (hlRect) {
      const rectTop = layout.offsets[i] + hlRect.top * layout.heights[i];
      const rectH = hlRect.height * layout.heights[i];
      top = rectTop - Math.max(PAD, (el.clientHeight - rectH) / 2);
      const pageLeft = Math.max(PAD, (el.scrollWidth - pageWidth) / 2);
      const rectLeft = pageLeft + hlRect.left * pageWidth;
      left = rectLeft - Math.max(PAD, (el.clientWidth - hlRect.width * pageWidth) / 2);
    }
    el.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [highlight, ready, layout, hlPage, hlRect, pageWidth]);

  // ---- fullscreen ---------------------------------------------------------
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  };

  // ---- document load ------------------------------------------------------
  const onLoadSuccess = async (pdf: PDFDocumentProxy) => {
    try {
      const metas = await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, i) => {
          const page = await pdf.getPage(i + 1);
          const view = page.view as [number, number, number, number];
          const rotate = ((page.rotate % 360) + 360) % 360;
          const w = view[2] - view[0];
          const h = view[3] - view[1];
          return { view, rotate, aspect: rotate === 90 || rotate === 270 ? h / w : w / h };
        }),
      );
      setPages(metas);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The PDF could not be read.');
    }
  };

  // Pages within one viewport above and below render; the rest are sized placeholders.
  const currentPage = layout ? pageAt(viewport.top + viewport.height * 0.25) : 1;
  const isNear = (i: number) => {
    if (!layout) return false;
    const top = layout.offsets[i];
    const bottom = top + layout.heights[i];
    return bottom >= viewport.top - viewport.height && top <= viewport.top + viewport.height * 2;
  };

  const iconSx = { color: 'text.secondary' } as const;

  return (
    <Box
      ref={rootRef}
      sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'document.canvas', containerType: 'inline-size' }}
    >
      {/* ---- toolbar: theme surface, not the document ---- */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ px: 1, minHeight: 40, bgcolor: 'surface.panel', borderBottom: 1, borderColor: 'border.subtle', color: 'text.primary', flexShrink: 0 }}
      >
        <Tooltip title="Previous page">
          <span>
            <IconButton size="small" sx={iconSx} aria-label="Previous page" disabled={!ready || currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <InputBase
            value={pageInput ?? String(currentPage)}
            onFocus={(e) => {
              setPageInput(String(currentPage));
              e.target.select();
            }}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setPageInput(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = Number(pageInput);
                if (n) goToPage(n);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            disabled={!ready}
            inputProps={{ 'aria-label': 'Page number', inputMode: 'numeric', size: 3 }}
            sx={{
              width: 40, fontSize: 13, color: 'text.primary', borderRadius: 1, border: 1, borderColor: 'border.subtle', bgcolor: 'surface.canvas',
              '& input': { textAlign: 'center', py: 0.25, fontVariantNumeric: 'tabular-nums' },
              '&.Mui-focused': { borderColor: 'accent.focus' },
            }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            / {numPages || '–'}
          </Typography>
        </Stack>
        <Tooltip title="Next page">
          <span>
            <IconButton size="small" sx={iconSx} aria-label="Next page" disabled={!ready || currentPage >= numPages} onClick={() => goToPage(currentPage + 1)}>
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Zoom out (−)">
          <span>
            <IconButton size="small" sx={iconSx} aria-label="Zoom out" disabled={scale <= 0.5} onClick={() => zoomStep(-1)}>
              <RemoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography
          variant="body2"
          aria-live="polite"
          aria-label={`Zoom ${Math.round(scale * 100)} percent`}
          sx={{ minWidth: 44, textAlign: 'center', color: 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {Math.round(scale * 100)}%
        </Typography>
        <Tooltip title="Zoom in (+)">
          <span>
            <IconButton size="small" sx={iconSx} aria-label="Zoom in" disabled={scale >= 3} onClick={() => zoomStep(1)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Fit to width (0)">
          <span>
            <IconButton size="small" sx={iconSx} aria-label="Fit to width" disabled={scale === 1} onClick={() => changeScale(1)}>
              <FitScreenOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />
        <Tooltip title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          <IconButton size="small" sx={iconSx} aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ---- pages: the document surface, light in both modes ---- */}
      <Box
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Document pages"
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', outlineOffset: -2 }}
      >
        {loadError ? (
          <ErrorState title="This PDF could not be read" description={loadError} />
        ) : (
          <Document
            file={fileUrl}
            options={PDF_OPTIONS}
            onLoadSuccess={(pdf) => void onLoadSuccess(pdf)}
            onLoadError={(e) => setLoadError(e.message)}
            loading={<PageSkeleton />}
            error={<span />}
          >
            {!layout ? (
              <PageSkeleton />
            ) : (
              <Box sx={{ position: 'relative', height: layout.total, minWidth: pageWidth + PAD * 2 }}>
                {pages!.map((_, i) => {
                  const pageNum = i + 1;
                  const isTarget = hlPage === pageNum;
                  return (
                    <Box
                      key={pageNum}
                      data-page={pageNum}
                      sx={{
                        position: 'absolute',
                        top: layout.offsets[i],
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: pageWidth,
                        height: layout.heights[i],
                        bgcolor: 'document.page',
                        // The canvas around the page is mode-invariant, so its shadow is too.
                        boxShadow: shadow.light.md,
                        outline: isTarget && !hlRect ? '3px solid' : 'none',
                        outlineColor: 'document.highlightPageOutline',
                        outlineOffset: 2,
                      }}
                    >
                      {isNear(i) && (
                        <Page
                          pageNumber={pageNum}
                          width={pageWidth}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={<span />}
                        />
                      )}
                      {isTarget && hlRect && (
                        <Box
                          aria-hidden
                          key={highlight?.nonce}
                          sx={{
                            position: 'absolute',
                            pointerEvents: 'none',
                            left: `calc(${hlRect.left * 100}% - ${HIGHLIGHT_PAD_PX}px)`,
                            top: `calc(${hlRect.top * 100}% - ${HIGHLIGHT_PAD_PX}px)`,
                            width: `calc(${hlRect.width * 100}% + ${HIGHLIGHT_PAD_PX * 2}px)`,
                            height: `calc(${hlRect.height * 100}% + ${HIGHLIGHT_PAD_PX * 2}px)`,
                            border: '2px solid',
                            borderColor: 'document.highlightStroke',
                            bgcolor: 'document.highlightFill',
                            borderRadius: 0.5,
                            animation: 'bda-hl-in 180ms cubic-bezier(0.2, 0, 0, 1)',
                            '@keyframes bda-hl-in': {
                              from: { opacity: 0, transform: 'scale(1.08)' },
                              to: { opacity: 1, transform: 'scale(1)' },
                            },
                          }}
                        />
                      )}
                      {isTarget && !hlRect && (
                        <Box
                          sx={{
                            position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1,
                            bgcolor: 'document.highlightStroke', color: 'common.white', fontSize: 12, fontWeight: 600,
                          }}
                        >
                          Approximate location: page {pageNum}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Document>
        )}
      </Box>
    </Box>
  );
}

function PageSkeleton() {
  return (
    <Stack spacing={2} alignItems="center" sx={{ p: 2 }} aria-busy="true" aria-label="Loading document">
      <Skeleton variant="rectangular" sx={{ width: '90%', height: 0, pb: '120%', bgcolor: 'document.page' }} />
    </Stack>
  );
}
