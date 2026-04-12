'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, Typography, CircularProgress, IconButton, Tooltip, Divider, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { colors } from '@/theme/colors';
import { ActiveHighlight } from '@/types';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PADDING_HEIGHT = 20;
const PADDING_WIDTH = 20;

interface PdfViewerProps {
  pdfDocument: string;
  activeHighlight: ActiveHighlight;
}

export const PdfViewer = ({ pdfDocument, activeHighlight }: PdfViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [baseWidth, setBaseWidth] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<Record<number, { w: number, h: number }>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // CRUCIAL MULTI-DOCUMENT FIX: Clear old state when URL changes.
  // useState initializers run on mount; we derive reset values from the ref directly
  // rather than calling setState inside an effect to avoid cascading renders.
  // The `key={fileUrl}` on this component in DocumentRouter already hard-resets
  // the whole component, so this effect only needs to sync baseWidth.
  useEffect(() => {
    console.log("[PdfViewer] Loaded new PDF document string.");
    pageRefs.current = {};
    if (containerRef.current) setBaseWidth(containerRef.current.clientWidth - 40);
  }, [pdfDocument]);

  useEffect(() => {
    const targetPage = activeHighlight?.pageNumber === 0 ? 1 : activeHighlight?.pageNumber;
    if (targetPage && pageRefs.current[targetPage]) {
      setTimeout(() => {
        pageRefs.current[targetPage]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    console.log(activeHighlight);
  }, [activeHighlight, scale, numPages]);

  const getHighlightStyle = (pageNum: number) => {
  if (!activeHighlight || !activeHighlight.boundingBox) return null;
  const dims = pageDimensions[pageNum];
  
  if (!dims || dims.w === 0 || dims.h === 0) return null; 

  const bbox = activeHighlight.boundingBox;
  let x, y, w, h;

  // 1. Extract raw values and determine if they are normalized (0-1) or pixels
  if (Array.isArray(bbox)) {
    // Assuming [x0, y0, x1, y1]
    [x, y, w, h] = [bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]];
  } else {
    // Assuming {x, y, width, height}
    [x, y, w, h] = [bbox.x, bbox.y, bbox.width, bbox.height];
  }

  // 2. Convert normalized (0-1) to absolute pixels if necessary
  const isNormalized = x <= 1 && w <= 1;
  if (isNormalized) {
    x *= dims.w;
    w *= dims.w;
    y *= dims.h;
    h *= dims.h;
  }

  // 3. Apply the Y-Flip (PDF bottom-up -> Web top-down)
  // We do this BEFORE padding so the "top" coordinate is correct
  const flippedY = dims.h - y - h;

  // 4. Apply Padding (centered)
  // Note: 200px/100px is quite large for a PDF, consider reducing these
  const finalX = x - (PADDING_WIDTH / 2);
  const finalY = flippedY - (PADDING_HEIGHT / 2);
  const finalW = w + PADDING_WIDTH;
  const finalH = h + PADDING_HEIGHT;

  // 5. Convert to percentages for the CSS style
  return {
    left: `${(finalX / dims.w) * 100}%`,
    top: `${(finalY / dims.h) * 100}%`,
    width: `${(finalW / dims.w) * 100}%`,
    height: `${(finalH / dims.h) * 100}%`
  };
};

  return (
    <Box sx={{ height: '100%', width: '100%', bgcolor: colors.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* TOOLBAR */}
      <Box sx={{ p: 1, bgcolor: colors.surface, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <IconButton onClick={() => setScale(p => Math.max(p - 0.2, 0.5))} size="small"><RemoveIcon /></IconButton>
        <Typography variant="body2" sx={{ minWidth: '45px', textAlign: 'center', fontWeight: 'bold' }}>{Math.round(scale * 100)}%</Typography>
        <IconButton onClick={() => setScale(p => Math.min(p + 0.2, 3.0))} size="small"><AddIcon /></IconButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <IconButton onClick={() => setScale(1.0)} size="small"><RestartAltIcon /></IconButton>
        <IconButton onClick={() => setScale(1.0)} size="small"><ZoomInMapIcon /></IconButton>
      </Box>

      {/* PDF RENDERER */}
      <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {pdfDocument && (
          <Document file={pdfDocument} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<CircularProgress sx={{ mt: 10, color: 'white' }} />}>
            {Array.from(new Array(numPages), (_, index) => {
              const pageNum = index + 1;
              const targetPage = activeHighlight?.pageNumber === 0 ? 1 : activeHighlight?.pageNumber;
              const isHighlighted = targetPage === pageNum;
              const highlightStyle = isHighlighted ? getHighlightStyle(pageNum) : null;

              // When we have a page target but no precise bounding box (e.g. DB-loaded
              // params where bbox isn't persisted), outline the whole page so the user
              // still gets a clear visual signal of where the spec came from.
              const pageOnlyHighlight = isHighlighted && !highlightStyle;

              return (
                <Box
                  key={pageNum}
                  ref={(el: HTMLDivElement | null) => { pageRefs.current[pageNum] = el; }}
                  sx={{
                    position: 'relative',
                    mx: 'auto',
                    boxShadow: pageOnlyHighlight
                      ? `0 0 0 3px ${colors.primary}, 0px 4px 20px rgba(0,0,0,0.3)`
                      : '0px 4px 20px rgba(0,0,0,0.3)',
                    transition: 'box-shadow 0.2s ease',
                  }}
                >
                  <Page
                    pageNumber={pageNum}
                    width={baseWidth * scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => {
                      setPageDimensions(prev => ({ ...prev, [pageNum]: { w: page.originalWidth, h: page.originalHeight } }));
                    }}
                  />
                  {isHighlighted && highlightStyle && (
                    <Box sx={{ position: 'absolute', border: `2px solid ${colors.primary}`, backgroundColor: 'rgba(25, 118, 210, 0.2)', pointerEvents: 'none', zIndex: 10, boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.1)`, ...highlightStyle }} />
                  )}
                </Box>
              );
            })}
          </Document>
        )}
      </Box>

      {/* TEXT SNIPPET BOX */}
      {activeHighlight?.textSnippet && (
        <Paper elevation={6} sx={{ p: 2, borderTop: `1px solid ${colors.border}`, bgcolor: colors.surface, zIndex: 20 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: colors.primary }}>
            <FormatQuoteIcon fontSize="small" />
            <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>Matched Text (Page {activeHighlight.pageNumber})</Typography>
          </Box>
          <Typography variant="body2" sx={{ pl: 3.5, fontStyle: 'italic', color: 'text.secondary', borderLeft: `2px solid ${colors.border}`, ml: 0.5, py: 0.5 }}>
            &quot;{activeHighlight.textSnippet}&quot;
          </Typography>
        </Paper>
      )}
    </Box>
  );
};