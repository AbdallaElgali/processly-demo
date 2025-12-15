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
  Button
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import { InputField } from '@/types';
import { colors } from '@/theme/colors';

interface InputFieldItemProps {
  field: InputField;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}

const getConfidenceColor = (confidence: number | null) => {
  if (confidence === null) return colors.border;
  if (confidence >= 95) return colors.secondary; // Green
  if (confidence >= 80) return colors.accent;    // Orange/Yellow
  return '#ef4444'; // Red (Standard MUI error red)
};

export const InputFieldItem = ({ field, onChange, onRemove }: InputFieldItemProps) => {
  const confidenceColor = getConfidenceColor(field.confidence);

  return (
    <Card variant="outlined" sx={{ mb: 2, position: 'relative', overflow: 'visible' }}>
      {/* Confidence Indicator Strip on Left */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: confidenceColor,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        }}
      />
      
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ flexGrow: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
          
          {/* Label Display */}
          <Box>
            <Typography variant="body1" fontWeight={600} color="text.primary">
              {field.label}
            </Typography>
          </Box>

          {/* Value Input */}
          <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              size="small"
              value={field.value}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder="Value not found"
              variant="outlined"
            />
            
            {/* Confidence & Source Metadata */}
            {field.confidence !== null && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={field.confidence} 
                    sx={{ 
                      flexGrow: 1, 
                      height: 6, 
                      borderRadius: 3,
                      bgcolor: `${confidenceColor}20`,
                      '& .MuiLinearProgress-bar': {
                        bgcolor: confidenceColor
                      }
                    }} 
                  />
                  <Typography variant="caption" sx={{ color: confidenceColor, fontWeight: 'bold', minWidth: 35 }}>
                    {Math.round(field.confidence)}%
                  </Typography>
                </Box>
                
                {field.source && (
                  <Tooltip title={`Source: ${field.source}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                      <InfoIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                      <Button variant="text" size="small">
                        Source
                      </Button>
                    </Box>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Actions */}
        <IconButton 
          onClick={() => onRemove(field.id)} 
          size="small"
          sx={{ color: colors.textSecondary, '&:hover': { color: '#ef4444' } }}
        >
          <DeleteIcon />
        </IconButton>
      </CardContent>
    </Card>
  );
};