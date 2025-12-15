'use client';

import { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  ThemeProvider, 
  CssBaseline, 
  Button,
  Alert
} from '@mui/material';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { DocumentUpload } from '@/components/document-upload';
import { InputFieldsList } from '@/components/input-fields-list';
import { InputField, FieldType } from '@/types';
import { analyzeDocument } from '@/api/analyze-document';
import LoadingSpinner from '@/components/Loading';

// Predefined field types
export const FIELD_TYPES: FieldType[] = [
  // Capacity & Energy
  { id: "C_NOMINAL_AH_DB", label: "Nominal Capacity", unit: "Ah" },
  { id: "E_NOMINAL_WH_DB", label: "Nominal Energy", unit: "Wh" },

  // Voltages
  { id: "U_MAX_DYN_DB", label: "Maximum Dynamic Voltage", unit: "V" },
  { id: "U_MIN_DYN_DB", label: "Minimum Dynamic Voltage", unit: "V" },
  { id: "U_MAX_PULSE_DB", label: "Maximum Pulse Voltage", unit: "V" },
  { id: "U_MIN_PULSE_DB", label: "Minimum Pulse Voltage", unit: "V" },
  { id: "U_MAX_SAFETY_DB", label: "Maximum Safety Voltage", unit: "V" },
  { id: "U_MIN_SAFETY_DB", label: "Minimum Safety Voltage", unit: "V" },

  // Temperatures
  { id: "T_MAX_DB", label: "Maximum Operating Temperature", unit: "°C" },
  { id: "T_MIN_DB", label: "Minimum Operating Temperature", unit: "°C" },
  { id: "T_MAX_TERMINAL_DB", label: "Max Terminal Temperature", unit: "°C" },
  { id: "T_MIN_TERMINAL_DB", label: "Min Terminal Temperature", unit: "°C" },
  { id: "T_MAX_SAFETY_DB", label: "Maximum Safety Temperature", unit: "°C" },
  { id: "T_MIN_SAFETY_DB", label: "Minimum Safety Temperature", unit: "°C" },
  { id: "T_MAX_TERMINAL_SAFETY_DB", label: "Max Terminal Safety Temperature", unit: "°C" },
  { id: "T_MIN_TERMINAL_SAFETY_DB", label: "Min Terminal Safety Temperature", unit: "°C" },

  // Currents
  { id: "I_MAX_CHA_DB", label: "Max Continuous Charge Current", unit: "A" },
  { id: "I_MAX_DCH_DB", label: "Max Continuous Discharge Current", unit: "A" },
  { id: "I_MAX_CHA_SAFETY_DB", label: "Max Safety Charge Current", unit: "A" },
  { id: "I_MAX_DCH_SAFETY_DB", label: "Max Safety Discharge Current", unit: "A" },
  { id: "I_MAX_CHA_PULSE_DB", label: "Max Pulse Charge Current", unit: "A" },
  { id: "I_MAX_DCH_PULSE_DB", label: "Max Pulse Discharge Current", unit: "A" },
];

export default function App() {
  const [showStats, setShowStats] = useState(false);
  const [fields, setFields] = useState<InputField[]>(() => 
    FIELD_TYPES.slice(0, 5).map((type, index) => ({
      id: `field-${index}`,
      type: type.id,
      label: type.label,
      value: '',
      confidence: null,
      source: null,
    }))
  );

  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Calculate statistics
  const stats = {
    total: fields.length,
    filled: fields.filter(f => f.value).length,
    highConfidence: fields.filter(f => f.confidence !== null && f.confidence >= 95).length,
    mediumConfidence: fields.filter(f => f.confidence !== null && f.confidence >= 80 && f.confidence < 95).length,
    lowConfidence: fields.filter(f => f.confidence !== null && f.confidence < 80).length,
  };

  const handleDocumentUpload = async(file: File) => {
    try{
      setIsLoading(true);
      const specs = await analyzeDocument(file);
      if (specs){
        setDocumentUploaded(true);
        setFields(specs);
        
      }
      console.log('Extracted Specs:', specs);
    }
    catch (error)  {
      console.error('Error during document analysis:', error);
      alert('Failed to analyze document. Please try again.');
    } finally{
      setIsLoading(false);
      setShowStats(false);
    }
  };

  const handleAddField = (fieldTypeId: string) => {
    const fieldType = FIELD_TYPES.find(t => t.id === fieldTypeId);
    if (!fieldType) return;

    const newField: InputField = {
      id: `field-${Date.now()}`,
      type: fieldTypeId,
      label: fieldType.label,
      value: '',
      confidence: null,
      source: null,
    };

    setFields([...fields, newField]);
  };

  const handleRemoveField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, value } : f
    ));
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isLoading && <LoadingSpinner />}
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
        <Container maxWidth="md">
          
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
              Voltavision Processly
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Streamline your document processing with AI-powered data extraction
            </Typography>
          </Box>

          {/* Document Upload */}
          <Box sx={{ mb: 4 }}>
            <DocumentUpload 
              onUpload={handleDocumentUpload}
              isUploaded={documentUploaded}
            />
          </Box>

          {/* Statistics */}
          {showStats && documentUploaded && (
            <Paper sx={{ mb: 4, p: 3 }}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Extraction Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={2.4} textAlign="center">
                  <Typography variant="h4" fontWeight="bold">{stats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Fields</Typography>
                </Grid>
                <Grid item xs={6} md={2.4} textAlign="center">
                  <Typography variant="h4" fontWeight="bold">{stats.filled}</Typography>
                  <Typography variant="body2" color="text.secondary">Filled</Typography>
                </Grid>
                <Grid item xs={6} md={2.4} textAlign="center">
                  <Typography variant="h4" fontWeight="bold" color={colors.secondary}>
                    {stats.highConfidence}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">High (&gt;95%)</Typography>
                </Grid>
                <Grid item xs={6} md={2.4} textAlign="center">
                  <Typography variant="h4" fontWeight="bold" color={colors.accent}>
                    {stats.mediumConfidence}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Medium (80-95%)</Typography>
                </Grid>
                <Grid item xs={6} md={2.4} textAlign="center">
                  <Typography variant="h4" fontWeight="bold" color="#ef4444">
                    {stats.lowConfidence}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Low (&lt;80%)</Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Confidence Legend */}
          {showStats && documentUploaded && (
            <Paper sx={{ mb: 4, p: 3 }}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Confidence Legend
              </Typography>
              <Grid container spacing={2}>
                {[
                  { color: colors.secondary, label: 'High (>95%)', desc: 'Very reliable' },
                  { color: colors.accent, label: 'Good (80-95%)', desc: 'Likely correct' },
                  { color: '#f97316', label: 'Medium (50-80%)', desc: 'Please verify' }, // Orange
                  { color: '#ef4444', label: 'Low (<50%)', desc: 'Needs review' },
                ].map((item, index) => (
                  <Grid item xs={12} md={3} key={index}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <Box 
                        sx={{ 
                          width: 40, 
                          height: 40, 
                          bgcolor: `${item.color}20`, 
                          border: `2px solid ${item.color}`, 
                          borderRadius: 2 
                        }} 
                      />
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">{item.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Input Fields */}
          <InputFieldsList
            fields={fields}
            onFieldChange={handleFieldChange}
            onRemoveField={handleRemoveField}
            onAddField={handleAddField}
            availableFieldTypes={FIELD_TYPES}
          />

        </Container>
        <Container maxWidth="md" sx={{ my: 4, textAlign: 'center' }}>
          <Button variant="contained" color="primary" sx={{ mt: 1, width: 150 }}>
              Submit
          </Button>
        </Container>
        
      </Box>
    
    </ThemeProvider>
  );
}

