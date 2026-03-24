'use client';

import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Tooltip, 
  Typography,
  Chip,
  Collapse,
  Badge
} from '@mui/material';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { InputField, SCHEMA_GROUPS } from '@/types'; // Import SCHEMA_GROUPS
import { colors } from '@/theme/colors';

interface InputFieldItemProps {
  field: InputField;
  onChange: (id: string, value: string, unit: string) => void; 
  onRemove: (id: string) => void;
  onShowSource: (source: any) => void;
  onSwitch: (fieldId: string, specId: string) => void;
}

const getConfidenceColor = (confidence: number | null) => {
  if (confidence === null) return colors.border;
  if (confidence >= 95) return colors.success; 
  if (confidence >= 80) return colors.warning;    
  return '#ef4444'; 
};

export const InputFieldItem = ({ field, onChange, onRemove, onShowSource, onSwitch }: InputFieldItemProps) => {
  const [showAiTools, setShowAiTools] = useState(false);

  const activeSpec = field.specifications.find(s => s.id === field.selectedSpecId) || field.specifications[0];
  const suggestions = field.specifications.filter(s => s.id !== activeSpec?.id);

  const displayValue = activeSpec ? activeSpec.value : '';
  
  // THE FIX: Find the default unit from SCHEMA_GROUPS using the field.type
  const defaultUnit = SCHEMA_GROUPS.flatMap(g => g.fields).find(f => f.id === field.type)?.unit || '';

  // Use the active spec's unit if it exists (even if empty string), otherwise use the default schema unit
  const displayUnit = activeSpec?.unit ?? defaultUnit; 
  
  const displayConfidence = activeSpec ? activeSpec.confidence : null;
  const displaySource = activeSpec ? activeSpec.source : null;

  const hasAiData = displayConfidence !== null || suggestions.length > 0;

  return (
    <Box sx={{ py: 1.5, borderBottom: `1px solid ${colors.border}40`, '&:last-child': { borderBottom: 'none' } }}>
      
      {/* PRIMARY HUMAN INPUT ROW */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        
        {/* Label */}
        <Box sx={{ flex: '0 0 30%', minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} color="text.primary" noWrap title={field.label}>
            {field.label}
          </Typography>
        </Box>

        {/* Input Fields (Value + Unit) */}
        <Box sx={{ flex: '1 1 auto', display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={displayValue}
            onChange={(e) => onChange(field.id, e.target.value, displayUnit)}
            placeholder="Enter value..."
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
                borderRadius: 1.5,
              }
            }}
          />
          <TextField
            size="small"
            value={displayUnit}
            onChange={(e) => onChange(field.id, displayValue, e.target.value)}
            placeholder="Unit"
            variant="outlined"
            sx={{
              width: 90, 
              flexShrink: 0,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
                borderRadius: 1.5,
              }
            }}
          />
        </Box>

        {/* Action Tools */}
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {displaySource && (
            <Tooltip title="Locate in Document" arrow>
              <IconButton 
                size="small" 
                onClick={() => onShowSource(displaySource)}
                sx={{ color: colors.textSecondary, '&:hover': { color: colors.primary, bgcolor: `${colors.primary}15` } }}
              >
                <FindInPageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {hasAiData && (
            <Tooltip title="AI Assistant & Alternatives" arrow>
              <IconButton 
                size="small" 
                onClick={() => setShowAiTools(!showAiTools)}
                sx={{ 
                  color: showAiTools ? colors.primary : colors.textSecondary, 
                  bgcolor: showAiTools ? `${colors.primary}15` : 'transparent'
                }}
              >
                <Badge color="primary" variant="dot" invisible={suggestions.length === 0 || showAiTools}>
                  <AutoAwesomeIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* SECONDARY AI ASSISTANT PANEL */}
      <Collapse in={showAiTools} unmountOnExit>
        <Box sx={{ 
          mt: 1, 
          ml: '30%', 
          p: 1.5, 
          bgcolor: `${colors.primary}08`, 
          borderRadius: 1.5,
          border: `1px solid ${colors.primary}20`
        }}>
          
          {displayConfidence !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: suggestions.length > 0 ? 1.5 : 0 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Current Value Confidence:
              </Typography>
              <Chip 
                size="small" 
                label={`${Math.round(displayConfidence)}%`} 
                sx={{ 
                  height: 20, 
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: getConfidenceColor(displayConfidence),
                  color: '#fff'
                }} 
              />
            </Box>
          )}

          {suggestions.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ display: 'block', mb: 1 }}>
                AI Suggested Alternatives:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {suggestions.map(spec => (
                  <Chip
                    key={spec.id}
                    size="small"
                    variant="outlined"
                    label={`${spec.value} ${spec.unit || ''}`}
                    onClick={() => {
                      onSwitch(field.id, spec.id);
                      setShowAiTools(false);
                    }}
                    sx={{ 
                      fontSize: '0.75rem',
                      borderColor: getConfidenceColor(spec.confidence), 
                      color: 'text.primary',
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: `${getConfidenceColor(spec.confidence)}15`, cursor: 'pointer' }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

        </Box>
      </Collapse>

    </Box>
  );
};