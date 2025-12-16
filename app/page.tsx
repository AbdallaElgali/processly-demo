'use client';

import { useState } from 'react';
import { 
  Box, 
  Grid, 
  ThemeProvider, 
  CssBaseline, 
  Paper,
  Typography,
  Button,
  useMediaQuery
} from '@mui/material';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { DocumentUpload } from '@/components/document-upload';
import { InputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/LayoutHeader';
import { Sidebar } from '@/components/Sidebar';
import { DocumentViewer } from '@/components/DocumentViewer'; // Ensure you have this file from previous steps
import { InputField, FieldType } from '@/types';
import { analyzeDocument } from '@/api/analyze-document';
import LoadingSpinner from '@/components/Loading';

// ... (Paste your FIELD_TYPES constant here) ...
export const FIELD_TYPES: FieldType[] = [
  { id: "C_NOMINAL_AH_DB", label: "Nominal Capacity", unit: "Ah" },
  { id: "E_NOMINAL_WH_DB", label: "Nominal Energy", unit: "Wh" },
  // ... rest of your fields
];

interface UploadedFile {
  id: string;
  name: string;
  specs: InputField[];
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fields, setFields] = useState<InputField[]>(() => []);
  
  // Mobile check
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDocumentUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const specs = await analyzeDocument(file);
      if (specs) {
        const newFile: UploadedFile = {
          id: Date.now().toString(),
          name: file.name,
          specs: specs
        };
        setUploadedFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        setFields(specs);
      }
    } catch (error) {
      console.error(error);
      alert('Analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isLoading && <LoadingSpinner />}
      
      {/* Root Layout: 100dvh ensures full height even on mobile with URL bars */}
      <Box sx={{ 
        height: '100dvh', 
        width: '100%',
        maxWidth: '100%',
        display: 'flex', 
        flexDirection: 'column', 
        bgcolor: colors.background,
        overflow: 'hidden' 
      }}>
        
        <LayoutHeader />

        {/* Main Grid Content */}
        {/* xs={12} makes it stack on mobile. md={...} makes it columns on desktop */}
        <Grid container spacing={0} sx={{ flex: 1, overflow: 'hidden', width: '100%', minHeight: 0 }}>
          
          {/* 1. Sidebar (Hidden on mobile unless toggled, but for now strictly responsive) */}
          {/* On Mobile: We might want to hide this or put it in a drawer. 
              For this code, I will hide it on XS and assume a Drawer would be added later, 
              or we stack it if you prefer. Here I stack it but limit height. */}
          <Grid item xs={12} md={2} sx={{ 
            height: { xs: 'auto', md: '100%' }, 
            minHeight: 0,
            borderBottom: { xs: `1px solid ${colors.border}`, md: 'none' },
            display: { xs: uploadedFiles.length > 0 ? 'block' : 'none', md: 'block' }
          }}>
            <Sidebar 
              files={uploadedFiles} 
              currentFileId={activeFileId} 
              onSelectFile={(id) => {
                const file = uploadedFiles.find(f => f.id === id);
                if (file) { setActiveFileId(id); setFields(file.specs); }
              }}
            />
          </Grid>

          {/* 2. Main Input Area (Center) */}
          <Grid item xs={12} md={5} sx={{ 
            height: '100%', 
            minHeight: 0,
            display: 'flex', 
            flexDirection: 'column',
            borderRight: { md: `1px solid ${colors.border}` },
            bgcolor: colors.background
          }}>
            
            {/* Scrollable Container */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3, minHeight: 0 }}>
              
              {/* Upload Card */}
              <Paper sx={{ 
                p: 3, 
                mb: 3, 
                bgcolor: colors.surface, 
                border: `1px dashed ${colors.border}`,
                textAlign: 'center'
              }}>
                <Typography variant="h6" color={colors.textPrimary} sx={{ mb: 1 }}>
                  Upload Specification
                </Typography>
                <DocumentUpload onUpload={handleDocumentUpload} isUploaded={false} />
              </Paper>

              <Typography variant="subtitle1" color={colors.primary} sx={{ mb: 2, fontWeight: 'bold' }}>
                Extracted Data
              </Typography>

              <InputFieldsList
                fields={fields}
                onFieldChange={(id, val) => setFields(fields.map(f => f.id === id ? { ...f, value: val } : f))}
                onRemoveField={(id) => setFields(fields.filter(f => f.id !== id))}
                onAddField={(typeId) => {
                  const type = FIELD_TYPES.find(t => t.id === typeId);
                  if(type) setFields([...fields, { id: `new-${Date.now()}`, type: type.id, label: type.label, value: '', confidence: null, source: null }]);
                }}
                availableFieldTypes={FIELD_TYPES}
              />
            </Box>

            {/* Footer Action Area */}
            <Box sx={{ p: 2, borderTop: `1px solid ${colors.border}`, bgcolor: colors.surface }}>
              <Button 
                variant="contained" 
                fullWidth 
                size="large"
                sx={{ 
                  bgcolor: colors.primary, 
                  color: 'white',
                  fontWeight: 'bold',
                  '&:hover': { bgcolor: colors.primaryHover }
                }}
              >
                Submit Validation
              </Button>
            </Box>
          </Grid>

          {/* 3. Document Viewer (Right) */}
          {/* On Mobile: Hidden by default or pushed to bottom? 
              Common pattern: Hide on mobile or show in tabs. I will stack it at bottom. */}
          <Grid item xs={12} md={5} sx={{ 
            height: { xs: '500px', md: '100%' },
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderTop: { xs: `1px solid ${colors.border}`, md: 'none' }
          }}>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: colors.surface }}>
              <DocumentViewer />
            </Box>
          </Grid>

        </Grid>
      </Box>
    </ThemeProvider>
  );
}