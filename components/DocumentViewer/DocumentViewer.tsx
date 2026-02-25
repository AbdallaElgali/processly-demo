'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  IconButton, 
  Tooltip, 
  Divider,
  Paper 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

import { colors } from '@/theme/colors';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Highlight {
  pageNumber: number;
  boundingBox: [number, number, number, number]; // [x1, y1, x2, y2]
  textSnippet?: string;
}

interface DocumentViewerProps {
  pdfDocument: string | null;
  activeHighlight: Highlight | null;
}

export const DocumentViewer = ({ pdfDocument, activeHighlight }: DocumentViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [baseWidth, setBaseWidth] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  
  // Store native dimensions of each page
  const [pageDimensions, setPageDimensions] = useState<Record<number, { w: number, h: number }>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 1. Handle Scrolling
  useEffect(() => {
    if (activeHighlight && pageRefs.current[activeHighlight.pageNumber]) {
      setTimeout(() => {
        pageRefs.current[activeHighlight.pageNumber]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [activeHighlight, scale]);

  // 2. Initial Measurement
  useEffect(() => {
    if (containerRef.current) {
      setBaseWidth(containerRef.current.clientWidth - 40);
    }
  }, [pdfDocument]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleResetZoom = () => setScale(1.0);
  const handleFitWidth = () => {
    if (containerRef.current) {
      setBaseWidth(containerRef.current.clientWidth - 40);
      setScale(1.0);
    }
  };

  // Helper to calculate styles
  const getHighlightStyle = (pageNum: number) => {
    if (!activeHighlight || !activeHighlight.boundingBox) return null;
    
    const dims = pageDimensions[pageNum];
    if (!dims) return null; 

    const [v0, v1, v2, v3] = activeHighlight.boundingBox;
    const isAbsolute = activeHighlight.boundingBox.some(v => v > 1);

    let left, top, width, height;

    if (isAbsolute) {
        left = (v0 / dims.w) * 100;
        top = (v1 / dims.h) * 100;
        width = ((v2 - v0) / dims.w) * 100;
        height = ((v3 - v1) / dims.h) * 100;
    } else {
        left = v0 * 100;
        top = v1 * 100;
        width = v2 * 100;
        height = v3 * 100;
    }

    return {
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`
    };
  };

  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%', 
      bgcolor: colors.surface, 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden' 
    }}>
      {/* 1. TOP TOOLBAR */}
      <Box sx={{ 
        p: 1, 
        bgcolor: colors.surface, 
        borderBottom: `1px solid ${colors.border}`, 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1
      }}>
        <Tooltip title="Zoom Out">
          <IconButton onClick={handleZoomOut} size="small"><RemoveIcon /></IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: '45px', textAlign: 'center', fontWeight: 'bold' }}>
          {Math.round(scale * 100)}%
        </Typography>
        <Tooltip title="Zoom In">
          <IconButton onClick={handleZoomIn} size="small"><AddIcon /></IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Tooltip title="Reset">
          <IconButton onClick={handleResetZoom} size="small"><RestartAltIcon /></IconButton>
        </Tooltip>
        <Tooltip title="Fit Width">
          <IconButton onClick={handleFitWidth} size="small"><ZoomInMapIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* 2. MAIN SCROLL AREA */}
      <Box 
        ref={containerRef}
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          scrollbarWidth: 'thin',
        }}
      >
        {pdfDocument ? (
          <Document
            file={pdfDocument}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<CircularProgress sx={{ mt: 10, color: 'white' }} />}
          >
            {Array.from(new Array(numPages), (_, index) => {
              const pageNum = index + 1;
              const isHighlighted = activeHighlight?.pageNumber === pageNum;
              const highlightStyle = isHighlighted ? getHighlightStyle(pageNum) : null;

              return (
                <Box 
                  key={pageNum} 
                  ref={(el: HTMLDivElement | null) => { pageRefs.current[pageNum] = el; }}
                  sx={{ 
                    position: 'relative', 
                    boxShadow: '0px 4px 20px rgba(0,0,0,0.3)',
                    transition: 'width 0.2s ease-out',
                    mx: 'auto' 
                  }}
                >
                  <Page 
                    pageNumber={pageNum} 
                    width={baseWidth * scale} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => {
                        setPageDimensions(prev => ({
                            ...prev,
                            [pageNum]: { w: page.originalWidth, h: page.originalHeight }
                        }));
                    }}
                  />
                  
                  {isHighlighted && highlightStyle && (
                    <Box
                      sx={{
                        position: 'absolute',
                        border: `2px solid ${colors.primary}`,
                        backgroundColor: 'rgba(25, 118, 210, 0.2)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.1)`, 
                        transition: 'all 0.3s ease',
                        ...highlightStyle
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Document>
        ) : (
          <Box sx={{ mt: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)', mx: 'auto' }}>
            <Typography>Upload a document to view</Typography>
          </Box>
        )}
      </Box>

      {/* 3. NEW: SNIPPET FOOTER BAR */}
      {activeHighlight?.textSnippet && (
        <Paper 
          elevation={6}
          sx={{ 
            p: 2, 
            borderTop: `1px solid ${colors.border}`, 
            bgcolor: colors.surface,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: colors.primary }}>
            <FormatQuoteIcon fontSize="small" />
            <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Matched Text (Page {activeHighlight.pageNumber})
            </Typography>
          </Box>
          <Typography 
            variant="body2" 
            sx={{ 
              pl: 3.5, 
              fontStyle: 'italic', 
              color: 'text.secondary',
              borderLeft: `2px solid ${colors.border}`,
              ml: 0.5,
              pl: 1.5,
              py: 0.5
            }}
          >
            "{activeHighlight.textSnippet}"
          </Typography>
        </Paper>
      )}
    </Box>
  );
};