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

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfDocument: string;
  activeHighlight: any;
}

export const PdfViewer = ({ pdfDocument, activeHighlight }: PdfViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [baseWidth, setBaseWidth] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<Record<number, { w: number, h: number }>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // CRUCIAL MULTI-DOCUMENT FIX: Clear old state when URL changes
  useEffect(() => {
    console.log("[PdfViewer] Loaded new PDF document string.");
    setNumPages(0);
    setPageDimensions({});
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
  }, [activeHighlight, scale, numPages]);

  const getHighlightStyle = (pageNum: number) => {
    if (!activeHighlight || !activeHighlight.boundingBox) return null;
    const dims = pageDimensions[pageNum];
    
    // Will wait until react-pdf successfully mounts the page and gets dimensions
    if (!dims || dims.w === 0 || dims.h === 0) {
      console.log(`[PdfViewer] Waiting for native dimensions on page ${pageNum}...`);
      return null; 
    }

    let v0, v1, v2, v3;
    const bbox = activeHighlight.boundingBox;

    if (Array.isArray(bbox)) {
      [v0, v1, v2, v3] = bbox;
    } else if (typeof bbox === 'object') {
      v0 = bbox.x0; v1 = bbox.y0; v2 = bbox.x1; v3 = bbox.y1;
    }

    if (v0 === undefined || v2 === undefined) {
      console.warn("[PdfViewer] Invalid bounding box format:", bbox);
      return null;
    }

    const isAbsolute = v0 > 1 || v2 > 1;
    const left = isAbsolute ? (v0 / dims.w) * 100 : v0 * 100;
    const top = isAbsolute ? (v1 / dims.h) * 100 : v1 * 100;
    const width = isAbsolute ? ((v2 - v0) / dims.w) * 100 : (v2 - v0) * 100;
    const height = isAbsolute ? ((v3 - v1) / dims.h) * 100 : (v3 - v1) * 100;

    return {
      left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`
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

              return (
                <Box key={pageNum} ref={(el: HTMLDivElement | null) => { pageRefs.current[pageNum] = el; }} sx={{ position: 'relative', boxShadow: '0px 4px 20px rgba(0,0,0,0.3)', mx: 'auto' }}>
                  <Page 
                    pageNumber={pageNum} 
                    width={baseWidth * scale} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => {
                       console.log(`[PdfViewer] Page ${pageNum} loaded. Dimensions: ${page.originalWidth}x${page.originalHeight}`);
                       setPageDimensions(prev => ({ ...prev, [pageNum]: { w: page.originalWidth, h: page.originalHeight } }))
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
            "{activeHighlight.textSnippet}"
          </Typography>
        </Paper>
      )}
    </Box>
  );
};