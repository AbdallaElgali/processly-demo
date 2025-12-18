'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Box, 
  ThemeProvider, 
  CssBaseline, 
  Paper,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';

import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { DocumentUpload } from '@/components/document-upload';
import { InputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/LayoutHeader';
import { Sidebar } from '@/components/Sidebar';
import { DocumentViewer } from '@/components/DocumentViewer';
import { InputField, FieldType } from '@/types';
import { analyzeDocument } from '@/api/analyze-document';
import LoadingSpinner from '@/components/Loading';

export const FIELD_TYPES: FieldType[] = [
  // --- Capacity & Energy ---
  { id: "C_NOMINAL_AH_DB", label: "Nominal Capacity", unit: "Ah" },
  { id: "E_NOMINAL_WH_DB", label: "Nominal Energy", unit: "Wh" },

  // --- Voltages ---
  { id: "U_MAX_DYN_DB", label: "Max Dynamic Voltage (Operating)", unit: "V" },
  { id: "U_MIN_DYN_DB", label: "Min Dynamic Voltage (Operating)", unit: "V" },
  { id: "U_MAX_PULSE_DB", label: "Max Pulse Voltage", unit: "V" },
  { id: "U_MIN_PULSE_DB", label: "Min Pulse Voltage", unit: "V" },
  { id: "U_MAX_SAFETY_DB", label: "Max Safety Voltage", unit: "V" },
  { id: "U_MIN_SAFETY_DB", label: "Min Safety Voltage", unit: "V" },

  // --- Temperatures ---
  { id: "T_MAX_DB", label: "Max Operating Temperature", unit: "°C" },
  { id: "T_MIN_DB", label: "Min Operating Temperature", unit: "°C" },
  { id: "T_MAX_TERMINAL_DB", label: "Max Terminal Temperature", unit: "°C" },
  { id: "T_MIN_TERMINAL_DB", label: "Min Terminal Temperature", unit: "°C" },
  { id: "T_MAX_SAFETY_DB", label: "Max Safety Temperature", unit: "°C" },
  { id: "T_MIN_SAFETY_DB", label: "Min Safety Temperature", unit: "°C" },
  { id: "T_MAX_TERMINAL_SAFETY_DB", label: "Max Terminal Safety Temp", unit: "°C" },
  { id: "T_MIN_TERMINAL_SAFETY_DB", label: "Min Terminal Safety Temp", unit: "°C" },

  // --- Currents ---
  { id: "I_MAX_CHA_DB", label: "Max Continuous Charge Current", unit: "A" },
  { id: "I_MAX_DCH_DB", label: "Max Continuous Discharge Current", unit: "A" },
  { id: "I_MAX_CHA_SAFETY_DB", label: "Max Safety Charge Current", unit: "A" },
  { id: "I_MAX_DCH_SAFETY_DB", label: "Max Safety Discharge Current", unit: "A" },
  { id: "I_MAX_CHA_PULSE_DB", label: "Max Pulse Charge Current", unit: "A" },
  { id: "I_MAX_DCH_PULSE_DB", label: "Max Pulse Discharge Current", unit: "A" },
];

const SIDEBAR_WIDTH = 260;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

interface UploadedFile {
  id: string;
  name: string;
  specs: InputField[];
  fileBlob: File; 
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [viewerWidth, setViewerWidth] = useState(600); 
  const isResizing = useRef(false);

  const [isDocumentProcessed, setIsDocumentProcessed] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<string>('');
  const [activeSource, setActiveSource] = useState<{pageNumber: number, boundingBox: [number, number, number, number], textSnippet: string} | null>(null);
  
  // Initialize with 5 empty fields for the "No File Selected" state
  const [fields, setFields] = useState<InputField[]>(() => 
    Array.from({ length: 0 }).map((_, i) => ({
      id: `init-${i}`, 
      type: FIELD_TYPES[i % FIELD_TYPES.length].id, 
      label: FIELD_TYPES[i % FIELD_TYPES.length].label, 
      value: '', 
      confidence: null, 
      source: null
    }))
  );

  // --- HELPER: SYNC STATE ---
  // This ensures that whenever we change the UI, we also save it to the "Database" (uploadedFiles)
  const updateActiveFileState = (newFields: InputField[]) => {
    // 1. Update the immediate UI
    setFields(newFields);

    // 2. Persist to the file storage if a file is selected
    if (activeFileId) {
      setUploadedFiles(prev => prev.map(file => 
        file.id === activeFileId 
          ? { ...file, specs: newFields } 
          : file
      ));
    }
  };

  const handleSourceBtnPress = useCallback((source: {pageNumber: number, boundingBox: [number, number, number, number], textSnippet: string}) => {
    if (source && pdfDocument) {
      setActiveSource({ ...source });
    }
  }, [pdfDocument]);

  // --- HANDLER: FIELD CHANGES ---
  const handleFieldChange = (id: string, value: string) => {
    const newFields = fields.map(f => f.id === id ? { ...f, value } : f);
    updateActiveFileState(newFields);
  };

  const handleRemoveField = (id: string) => {
    const newFields = fields.filter(f => f.id !== id);
    updateActiveFileState(newFields);
  };

  const handleAddField = (typeId: string) => {
    const type = FIELD_TYPES.find(t => t.id === typeId);
    if (type) {
      const newField: InputField = {
        id: `new-${Date.now()}`, // Unique ID is crucial
        type: type.id,
        label: type.label,
        value: '',
        confidence: null,
        source: null
      };
      const newFields = [...fields, newField];
      updateActiveFileState(newFields);
    }
  };

  // --- LOGIC: UPLOAD & ANALYZE ---
  const handleDocumentUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const [specs, fileId] = await analyzeDocument(file);
      if (specs) {
        const newFile: UploadedFile = { 
            id: Date.now().toString(), 
            name: file.name, 
            specs: specs,
            fileBlob: file 
        };

        setUploadedFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        
        // Update UI View
        setFields(specs);
        setPdfDocument(URL.createObjectURL(file));
        setIsDocumentProcessed(true);
        setActiveSource(null);
      }
    } catch (error) {
      console.error(error);
      alert('Analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIC: SWITCHING FILES ---
  const handleSelectFile = (id: string) => {
    const file = uploadedFiles.find(f => f.id === id);
    if (file) {
        setActiveFileId(id);
        
        // Load the SAVED fields (which now include your edits)
        setFields(file.specs); 
        
        setPdfDocument(URL.createObjectURL(file.fileBlob));
        setIsDocumentProcessed(true);
        setActiveSource(null);
    }
  };

  // --- RESIZING LOGIC ---
  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > MIN_VIEWER_WIDTH && (window.innerWidth - newWidth - (isSidebarOpen ? SIDEBAR_WIDTH : 0)) > MIN_MAIN_WIDTH) {
      setViewerWidth(newWidth);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isLoading && <LoadingSpinner />}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <LayoutHeader />

        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <Box sx={{ 
            width: isSidebarOpen ? SIDEBAR_WIDTH : 0,
            transition: 'width 0.3s ease',
            borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none',
            bgcolor: colors.surface,
            overflow: 'hidden'
          }}>
            <Sidebar 
              files={uploadedFiles} 
              currentFileId={activeFileId} 
              onSelectFile={handleSelectFile}
            />
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            <Box sx={{ p: 1, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}` }}>
              <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
              </IconButton>
              <Typography variant="body2" sx={{ ml: 1, fontWeight: 500, color: colors.textSecondary }}>
                {isSidebarOpen ? 'Minimize' : 'Expand Sidebar'}
              </Typography>
            </Box>

            <Box sx={{ 
              flex: 1, 
              overflowY: 'auto', 
              p: 3,
              msOverflowStyle: 'none', 
              scrollbarWidth: 'none', 
              '&::-webkit-scrollbar': { display: 'none' } 
            }}>
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.surface, border: `1px dashed ${colors.border}`, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Upload Specification</Typography>
                <DocumentUpload onUpload={handleDocumentUpload} isUploaded={isDocumentProcessed} />
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: colors.primary }}>
                {activeFileId ? uploadedFiles.find(f => f.id === activeFileId)?.name : 'Parameters'} ({fields.length} items)
              </Typography>

              {/* KEY FIX: Adding a key here forces React to destroy and recreate the list 
                 when switching files. This clears any lingering DOM state in the inputs. 
              */}
              <Box key={activeFileId || 'empty'}>
                <InputFieldsList
                  fields={fields}
                  onFieldChange={handleFieldChange} // Updated handler
                  onRemoveField={handleRemoveField} // Updated handler
                  onAddField={handleAddField}       // Updated handler
                  availableFieldTypes={FIELD_TYPES}
                  onShowSource={handleSourceBtnPress}
                />
              </Box>
            </Box>

            <Box sx={{ 
              p: 2, 
              borderTop: `1px solid ${colors.border}`, 
              bgcolor: colors.surface, 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 2 
            }}>
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: '#fff', 
                  color: colors.darkTeal, 
                  px: 3,
                  '&:hover': { bgcolor: '#f5f5f5' } 
                }}
              >
                View Summary
              </Button>
              <Button 
                variant="contained" 
                sx={{ 
                  px: 3,
                  '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 }
                }}
              >
                Submit Validation
              </Button>
            </Box>
          </Box>

          <Box
            onMouseDown={startResizing}
            onDoubleClick={() => setViewerWidth(window.innerWidth / 2)}
            sx={{
              width: '8px', 
              cursor: 'col-resize',
              bgcolor: 'transparent',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                left: '3px', top: 0, bottom: 0, width: '2px',
                bgcolor: 'transparent',
                transition: 'background-color 0.2s',
              },
              '&:hover::after': { bgcolor: colors.primary },
              zIndex: 10
            }}
          />

          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#e4e4e7', minWidth: MIN_VIEWER_WIDTH }}>
            <DocumentViewer pdfDocument={pdfDocument} activeHighlight={activeSource}/>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}