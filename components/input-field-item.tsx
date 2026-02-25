'use client';

import { 
  Box, 
  TextField, 
  IconButton, 
  Tooltip, 
  LinearProgress, 
  Typography,
  Card,
  CardContent,
  Button,
  Chip // Added Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import { InputField } from '@/types';
import { colors } from '@/theme/colors';

interface InputFieldItemProps {
  field: InputField;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onShowSource: (source: any) => void;
  onSwitch: (fieldId: string, specId: string) => void; // NEW PROP
}

const getConfidenceColor = (confidence: number | null) => {
  if (confidence === null) return colors.border;
  if (confidence >= 95) return colors.success; 
  if (confidence >= 80) return colors.warning;    
  return '#ef4444'; 
};

export const InputFieldItem = ({ field, onChange, onRemove, onShowSource, onSwitch }: InputFieldItemProps) => {
  // 1. Identify the active specification and the alternative suggestions
  const activeSpec = field.specifications.find(s => s.id === field.selectedSpecId) || field.specifications[0];
  const suggestions = field.specifications.filter(s => s.id !== activeSpec?.id);

  // 2. Safely extract display values (handles empty/manual states)
  const displayValue = activeSpec ? activeSpec.value : '';
  const displayConfidence = activeSpec ? activeSpec.confidence : null;
  const displaySource = activeSpec ? activeSpec.source : null;
  const confidenceColor = getConfidenceColor(displayConfidence);

  return (
    <Card variant="outlined" sx={{ mb: 2, position: 'relative', overflow: 'visible' }}>
      <Box
        sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          bgcolor: confidenceColor,
          borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
        }}
      />
      
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ flexGrow: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
          
          <Box sx={{ mt: 1 }}>
            <Typography variant="body1" fontWeight={600} color="text.primary">
              {field.label}
            </Typography>
          </Box>

          <Box sx={{ position: 'relative' }}>
            {/* ACTIVE VALUE INPUT */}
            <TextField
              fullWidth
              size="small"
              value={displayValue}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder="Value not found"
              variant="outlined"
            />
            
            {/* ACTIVE CONFIDENCE & METADATA */}
            {displayConfidence !== null && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={displayConfidence} 
                    sx={{ 
                      flexGrow: 1, height: 6, borderRadius: 3, bgcolor: `${confidenceColor}20`,
                      '& .MuiLinearProgress-bar': { bgcolor: confidenceColor }
                    }} 
                  />
                  <Typography variant="caption" sx={{ color: confidenceColor, fontWeight: 'bold', minWidth: 35 }}>
                    {Math.round(displayConfidence)}%
                  </Typography>
                </Box>
                
                {displaySource && (
                  <Tooltip title={`Source: ${displaySource.textSnippet || 'N/A'}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                      <InfoIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                      <Button variant="text" size="small" onClick={() => onShowSource(displaySource)}>
                        Source
                      </Button>
                    </Box>
                  </Tooltip>
                )}
              </Box>
            )}

            {/* NEW: ALTERNATIVE SUGGESTIONS CHIPS */}
            {suggestions.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Alternatives:
                </Typography>
                {suggestions.map(spec => (
                  <Chip
                    key={spec.id}
                    size="small"
                    variant="outlined"
                    label={`${spec.value} ${spec.unit || ''} (${Math.round(spec.confidence || 0)}%)`}
                    onClick={() => onSwitch(field.id, spec.id)}
                    sx={{ 
                      borderColor: getConfidenceColor(spec.confidence), 
                      color: 'text.secondary',
                      '&:hover': { bgcolor: `${getConfidenceColor(spec.confidence)}15` }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <IconButton onClick={() => onRemove(field.id)} size="small" sx={{ color: colors.textSecondary, mt: 0.5 }}>
          <DeleteIcon />
        </IconButton>
      </CardContent>
    </Card>
  );
};