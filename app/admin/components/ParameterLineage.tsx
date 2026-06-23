import React from 'react';
import { Box, Typography, Card, CardContent, Button, CircularProgress, Chip, LinearProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { colors } from '@/theme/colors';
import { useParameterLineage } from '@/hooks/useParameterLineage';

interface ParameterLineageProps {
  projectId: string;
  parameterKey: string;
  onBack: () => void;
}

const ParameterLineage: React.FC<ParameterLineageProps> = ({ projectId, parameterKey, onBack }) => {
  const { lineageData, isLoading, error } = useParameterLineage(projectId, parameterKey);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  if (error) return <Typography color="error">Error loading lineage: {error}</Typography>;
  if (!lineageData) return null;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ textTransform: 'none', color: colors.textSecondary }}>
          Back to Parameter List
        </Button>
      </Box>

      {/* Header Summary Card */}
      <Card sx={{ mb: 4, elevation: 0, border: `1px solid ${colors.border}`, borderRadius: 2, bgcolor: colors.surface }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold">Lineage Trace For</Typography>
            <Typography variant="h4" fontWeight="bold" color="primary">{lineageData.parameterKey}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold">Final Authorized Value</Typography>
            <Typography variant="h5" fontWeight="bold">
              {lineageData.finalValue !== null ? lineageData.finalValue : 'Unassigned'}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              {lineageData.isAiAccepted && <Chip label="AI Accepted" size="small" color="success" variant="outlined" />}
              <Chip label={lineageData.reviewAction || 'PENDING'} size="small" color="default" sx={{ fontWeight: 'bold' }} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Extraction Timeline</Typography>

      {/* Custom Timeline Layout */}
      <Box sx={{ position: 'relative', ml: 2 }}>
        {/* Vertical timeline line */}
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 15, width: 2, bgcolor: colors.border, zIndex: 0 }} />

        {lineageData.events.map((event, index) => {
          const isWinner = event.isWinner;
          const hasFlag = !!event.flag;

          return (
            <Box key={event.candidateId} sx={{ display: 'flex', mb: 4, position: 'relative', zIndex: 1 }}>
              
              {/* Timeline Node */}
              <Box sx={{ mr: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
                <Box 
                  sx={{ 
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isWinner ? '#e8f5e9' : (hasFlag ? '#ffebee' : colors.surface),
                    border: `2px solid ${isWinner ? '#4caf50' : (hasFlag ? '#f44336' : colors.border)}`,
                  }}
                >
                  {isWinner ? <CheckCircleIcon color="success" fontSize="small" /> : <Typography variant="caption" fontWeight="bold" color="text.secondary">{index + 1}</Typography>}
                </Box>
              </Box>

              {/* Event Card */}
              <Card 
                sx={{ 
                  flex: 1, elevation: 0, borderRadius: 2,
                  border: `1px solid ${isWinner ? '#4caf50' : (hasFlag ? '#f44336' : colors.border)}`,
                  boxShadow: isWinner ? '0 4px 12px rgba(76, 175, 80, 0.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Run ID: <Typography component="span" variant="body2" fontFamily="monospace">{event.extractionRunId.substring(0, 8)}</Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.createdAt).toLocaleString()}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" textTransform="uppercase">Extracted Value</Typography>
                      <Typography variant="h6" fontWeight="bold">{event.value || 'N/A'} {event.unit && <span style={{ fontSize: '0.8em', color: 'gray' }}>{event.unit}</span>}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" textTransform="uppercase" display="block" sx={{ mb: 0.5 }}>Confidence Score</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={event.confidence * 100} 
                          sx={{ 
                            flex: 1, height: 8, borderRadius: 4, 
                            bgcolor: colors.background,
                            '& .MuiLinearProgress-bar': { bgcolor: event.confidence > 0.8 ? '#4caf50' : event.confidence > 0.5 ? '#ff9800' : '#f44336' }
                          }} 
                        />
                        <Typography variant="body2" fontWeight="bold">{(event.confidence * 100).toFixed(0)}%</Typography>
                      </Box>
                    </Box>
                  </Box>

                  {event.extractionLogic && (
                    <Box sx={{ bgcolor: colors.background, p: 1.5, borderRadius: 1, mb: hasFlag ? 2 : 0, border: `1px dashed ${colors.border}` }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>Extraction Logic</Typography>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">{event.extractionLogic}</Typography>
                    </Box>
                  )}

                  {/* Flag Alert */}
                  {hasFlag && (
                    <Box sx={{ bgcolor: '#ffebee', p: 1.5, borderRadius: 1, display: 'flex', gap: 1, alignItems: 'flex-start', border: '1px solid #ffcdd2' }}>
                      <WarningAmberIcon color="error" fontSize="small" />
                      <Box>
                        <Typography variant="body2" color="error" fontWeight="bold">Flagged: {event.flag?.flagType || 'System Alert'}</Typography>
                        <Typography variant="caption" color="error">{event.flag?.flagReason}</Typography>
                      </Box>
                    </Box>
                  )}

                </CardContent>
              </Card>

            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ParameterLineage;