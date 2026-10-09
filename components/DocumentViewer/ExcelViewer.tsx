'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography, Tabs, Tab, IconButton, Divider, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import * as XLSX from 'xlsx';
import { ErrorState } from '@/components/ui/ErrorState';
import { ActiveHighlight } from '@/types';

interface ExcelViewerProps {
  excelDocument: string;
  activeHighlight?: ActiveHighlight;
}

const getColumnLetter = (colIndex: number) => {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export const ExcelViewer = ({ excelDocument, activeHighlight }: ExcelViewerProps) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // NEW: Viewport Controls
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  const highlightedCellRef = useRef<HTMLTableCellElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Parse
  useEffect(() => {
    setWorkbook(null);
    setActiveSheet('');

    const parseExcel = async () => {
      try {
        setLoading(true);
        const response = await fetch(excelDocument);
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        setWorkbook(wb);
        if (wb.SheetNames.length > 0 && !activeHighlight?.pageNumber) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch {
        setError('Failed to load spreadsheet data.');
      } finally {
        setLoading(false);
      }
    };
    if (excelDocument) parseExcel();
  }, [excelDocument]);

  // 2. Intelligent Sheet Switching
  useEffect(() => {
    if (activeHighlight?.pageNumber !== undefined && activeHighlight?.pageNumber !== null && workbook) {
      const targetIdentifier = activeHighlight.pageNumber.toString();
      let newSheetName = null;

      if (workbook.SheetNames.includes(targetIdentifier)) {
        newSheetName = targetIdentifier; // Exact name match
      } else {
        const parsedIndex = parseInt(targetIdentifier, 10);
        if (!isNaN(parsedIndex)) {
          const zeroBasedIndex = parsedIndex > 0 ? parsedIndex - 1 : 0;
          newSheetName = workbook.SheetNames[zeroBasedIndex];
        }
      }

      if (newSheetName && newSheetName !== activeSheet) {
        setActiveSheet(newSheetName);
      }
    }
  }, [activeHighlight, workbook, activeSheet]);

  // 3. Transform Bounds into a 2D Block
  // 3. Transform Bounds into a 2D Block
  const highlightRange = useMemo(() => {
    if (!activeHighlight) return null;

    if (activeHighlight.boundingBox) {
      let x0, y0, x1, y1;
      const bbox = activeHighlight.boundingBox;
      
      if (Array.isArray(bbox)) {
        [x0, y0, x1, y1] = bbox;
      } else {
        // { x, y, width, height } payload
        x0 = bbox.x;
        y0 = bbox.y - 1;
        x1 = bbox.x + (bbox.width || 0);
        y1 = bbox.y + (bbox.height || 0);
      }

      if (x0 !== undefined && y0 !== undefined && x1 !== undefined && y1 !== undefined) {
        return {
          r1: Math.min(Math.floor(y0), Math.floor(y1)) + 1,
          r2: Math.max(Math.floor(y0), Math.floor(y1)) + 1, 
          c1: Math.min(Math.floor(x0), Math.floor(x1)) + 1,
          c2: Math.max(Math.floor(x0), Math.floor(x1)) + 1 
        };
      }
    }

    if (activeHighlight.cellCoordinates && activeHighlight.cellCoordinates.row !== -1) {
      return {
        r1: activeHighlight.cellCoordinates.row,
        r2: activeHighlight.cellCoordinates.row,
        c1: activeHighlight.cellCoordinates.column,
        c2: activeHighlight.cellCoordinates.column
      };
    }
    return null;
  }, [activeHighlight]);

  // 4. Scroll Execution
  useEffect(() => {
    if (highlightedCellRef.current && !loading) {
      const timer = setTimeout(() => {
        highlightedCellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [highlightRange, activeSheet, loading, scale]);

  // Fullscreen Logic
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen();
    }
  };

  const { sheetData, colHeaders } = useMemo(() => {
    if (!workbook || !activeSheet) return { sheetData: [], colHeaders: [] };
    const worksheet = workbook.Sheets[activeSheet];
    if (!worksheet) return { sheetData: [], colHeaders: [] };

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
    let maxCols = 0;
    jsonData.forEach(row => { if (row.length > maxCols) maxCols = row.length; });
    const headers = Array.from({ length: maxCols }, (_, i) => getColumnLetter(i));

    const normalizedData = jsonData.map(row => {
      const paddedRow = [...row];
      while (paddedRow.length < maxCols) paddedRow.push('');
      return paddedRow;
    });

    return { sheetData: normalizedData, colHeaders: headers };
  }, [workbook, activeSheet]);

  // Step 9 moves this viewer onto tokens only (AM13); its rebuild is step 9b (AM16).
  // Chrome follows the theme; the grid is the document and stays light (8.3).
  if (loading) {
    return (
      <Box sx={{ height: '100%', p: 2, bgcolor: 'document.canvas' }} aria-busy="true" aria-label="Loading spreadsheet">
        <Skeleton variant="rectangular" height="100%" sx={{ bgcolor: 'document.page' }} />
      </Box>
    );
  }
  if (error) return <Box sx={{ height: '100%', bgcolor: 'surface.canvas' }}><ErrorState title="This spreadsheet could not be read" description={error} /></Box>;

  return (
    <Box ref={containerRef} sx={{ height: '100%', width: '100%', bgcolor: 'document.canvas', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* TOOLBAR */}
      <Box sx={{ px: 1, minHeight: 40, bgcolor: 'surface.panel', borderBottom: 1, borderColor: 'border.subtle', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: 'text.primary', '& .MuiIconButton-root': { color: 'text.secondary' } }}>
        <Tooltip title="Zoom Out">
          <IconButton onClick={() => setScale(p => Math.max(p - 0.2, 0.5))} size="small"><RemoveIcon /></IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: '45px', textAlign: 'center', fontWeight: 600, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{Math.round(scale * 100)}%</Typography>
        <Tooltip title="Zoom In">
          <IconButton onClick={() => setScale(p => Math.min(p + 0.2, 3.0))} size="small"><AddIcon /></IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Tooltip title="Reset Zoom">
          <IconButton onClick={() => setScale(1.0)} size="small"><RestartAltIcon /></IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton onClick={toggleFullScreen} size="small">
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* EXCEL GRID */}
      <TableContainer sx={{ flex: 1, overflow: 'auto', bgcolor: 'document.page' }}>
        {/* We apply CSS zoom to the table to scale the grid while keeping standard DOM behavior */}
        <Table stickyHeader size="small" sx={{ minWidth: 'max-content', borderCollapse: 'collapse', zoom: scale }}>
          
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'document.headerCell', borderRight: 1, borderBottom: 2, borderColor: 'document.gridLine', position: 'sticky', top: 0, left: 0, zIndex: 4 }} />
              {colHeaders.map((header, index) => {
                 const isColHighlighted = highlightRange && (index + 1) >= highlightRange.c1 && (index + 1) <= highlightRange.c2;
                 return (
                  <TableCell 
                    key={index} align="center"
                    sx={{ 
                      bgcolor: isColHighlighted ? 'document.highlightFill' : 'document.headerCell',
                      color: isColHighlighted ? 'document.highlightStroke' : 'document.text',
                      fontWeight: 'bold', borderRight: 1, borderBottom: 2, borderColor: 'document.gridLine', minWidth: 80,
                      position: 'sticky', top: 0, zIndex: 3
                    }}
                  >
                    {header}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {sheetData.map((row, rowIndex) => {
              const currentUIrow = rowIndex + 1;
              const isRowInHighlight = highlightRange && currentUIrow >= highlightRange.r1 && currentUIrow <= highlightRange.r2;

              return (
              <TableRow key={rowIndex}>
                <TableCell 
                  sx={{ 
                    bgcolor: isRowInHighlight ? 'document.highlightFill' : 'document.headerCell',
                    color: isRowInHighlight ? 'document.highlightStroke' : 'document.text',
                    fontWeight: 'bold', borderRight: 2, borderBottom: 1, borderColor: 'document.gridLine',
                    position: 'sticky', left: 0, zIndex: 2, textAlign: 'center', minWidth: 50
                  }}
                >
                  {currentUIrow}
                </TableCell>
                
                {row.map((cell, colIndex) => {
                  const currentUIcol = colIndex + 1;
                  const isHighlightedCell = isRowInHighlight && currentUIcol >= highlightRange.c1 && currentUIcol <= highlightRange.c2;
                  
                  const isTopLeft = highlightRange && currentUIrow === highlightRange.r1 && currentUIcol === highlightRange.c1;
                  
                  const isTopEdge = isHighlightedCell && currentUIrow === highlightRange.r1;
                  const isBottomEdge = isHighlightedCell && currentUIrow === highlightRange.r2;
                  const isLeftEdge = isHighlightedCell && currentUIcol === highlightRange.c1;
                  const isRightEdge = isHighlightedCell && currentUIcol === highlightRange.c2;

                  return (
                  <TableCell 
                    key={colIndex} 
                    ref={isTopLeft ? highlightedCellRef : null}
                    sx={{ 
                      borderRight: 1,
                      borderBottom: 1,
                      borderColor: 'document.gridLine',
                      color: 'document.text',
                      bgcolor: 'document.page',
                      whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
                      
                      ...(isHighlightedCell && {
                        bgcolor: 'document.highlightFill',
                        color: 'document.highlightStroke',
                        fontWeight: '600',
                        ...(isTopEdge && { borderTop: (t) => `2px solid ${t.vars.palette.document.highlightStroke} !important` }),
                        ...(isBottomEdge && { borderBottom: (t) => `2px solid ${t.vars.palette.document.highlightStroke} !important` }),
                        ...(isLeftEdge && { borderLeft: (t) => `2px solid ${t.vars.palette.document.highlightStroke} !important` }),
                        ...(isRightEdge && { borderRight: (t) => `2px solid ${t.vars.palette.document.highlightStroke} !important` })
                      })
                    }}
                    title={String(cell)}
                  >
                    {String(cell ?? '')}
                  </TableCell>
                )})}
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </TableContainer>

      {/* TABS */}
      {workbook && workbook.SheetNames.length > 1 && (
        <Box sx={{ borderTop: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel' }}>
          <Tabs value={activeSheet} onChange={(e, v) => setActiveSheet(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 40 }}>
            {workbook.SheetNames.map(sheet => (
              <Tab key={sheet} label={sheet} value={sheet} sx={{ minHeight: 40, textTransform: 'none', fontWeight: activeSheet === sheet ? 'bold' : 'normal', borderRight: 1, borderColor: 'border.subtle' }} />
            ))}
          </Tabs>
        </Box>
      )}

    </Box>
  );
};