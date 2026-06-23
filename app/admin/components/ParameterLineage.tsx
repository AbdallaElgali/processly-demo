import React, { useMemo } from 'react';
import { Box, Typography, Card, CardContent, Button, CircularProgress, Chip, LinearProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { colors } from '@/theme/colors';
import { useParameterLineage } from '@/hooks/useParameterLineage';

interface ParameterLineageProps {
  projectId: string;
  parameterKey: string;
  onBack: () => void;
}

const ParameterLineage: React.FC<ParameterLineageProps> = ({ projectId, parameterKey, onBack }) => {
  const { lineageData, isLoading, error } = useParameterLineage(projectId, parameterKey);

  const groupedRuns = useMemo(() => {
    if (!lineageData || !Array.isArray(lineageData.events)) return [];
    
    const groups: Record<string, typeof lineageData.events> = {};
    
    lineageData.events.forEach(ev => {
      if (!groups[ev.extractionRunId]) groups[ev.extractionRunId] = [];
      groups[ev.extractionRunId].push(ev);
    });

    return Object.entries(groups).map(([runId, candidates]) => {
      candidates.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return {
        runId,
        candidates,
        createdAt: candidates[0].createdAt 
      };
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [lineageData]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  if (error) return <Typography color="error">Error loading lineage: {error}</Typography>;
  if (!lineageData) return null;

  const isModified = lineageData.reviewAction === 'MODIFIED';

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ textTransform: 'none', color: colors.textSecondary }}>
          Back to Parameter List
        </Button>
      </Box>

      {/* Header Summary Card */}
      <Card sx={{ 
        mb: 4, 
        elevation: 0, 
        bgcolor: colors.surface,
        border: '1px solid',
        borderColor: isModified ? 'warning.main' : colors.border,
        borderRadius: 2
      }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold">Lineage Trace For</Typography>
            <Typography variant="h4" fontWeight="bold" color="primary">{lineageData.parameterKey}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color={isModified ? "warning.main" : "text.secondary"} textTransform="uppercase" fontWeight="bold">
              {isModified ? "Final Human Entered Value" : "Final Authorized Value"}
            </Typography>
            <Typography variant="h4" fontWeight="bold" color={isModified ? "warning.main" : "text.primary"}>
              {lineageData.finalValue !== null ? lineageData.finalValue : <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Null / Cleared</span>}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              {lineageData.isAiAccepted && <Chip icon={<SmartToyIcon fontSize="small"/>} label="AI Accepted" size="small" color="success" variant="outlined" />}
              {isModified && <Chip icon={<PersonIcon fontSize="small"/>} label="Human Overridden" size="small" color="warning" variant="outlined" />}
              <Chip label={lineageData.reviewAction || 'PENDING'} size="small" variant="outlined" color="info" sx={{ fontWeight: 'bold' }} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Extraction Timeline</Typography>

      {/* Custom Timeline Layout Grouped By Run */}
      <Box sx={{ position: 'relative', ml: 2 }}>
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 15, width: 2, bgcolor: colors.border, zIndex: 0 }} />

        {groupedRuns.map((run, index) => {
          return (
            <Box key={run.runId} sx={{ display: 'flex', mb: 5, position: 'relative', zIndex: 1 }}>
              
              {/* Timeline Stage Node */}
              <Box sx={{ mr: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
                <Box 
                  sx={{ 
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: colors.surface, border: `2px solid ${colors.border}`,
                  }}
                >
                  <Typography variant="caption" fontWeight="bold" color="text.primary">{index + 1}</Typography>
                </Box>
              </Box>

              {/* Run Container */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Extraction Run: <Typography component="span" variant="body2" fontFamily="monospace" color="text.primary">{run.runId.substring(0, 8)}</Typography> 
                  <span style={{ margin: '0 8px' }}>•</span> 
                  {new Date(run.createdAt).toLocaleString()}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {run.candidates.map((event, candidateIndex) => {
                    const hasFlag = !!event.flag;
                    const isWinner = event.isWinner;
                    const isFullyAccepted = isWinner && lineageData.isAiAccepted;
                    
                    // Determine if the flag is active or historical
                    const isFlagActive = event.flag?.status !== 'DISMISSED' && event.flag?.status !== 'RESOLVED';

                    // Determine Accent Color for the left border
                    let accentColor = 'transparent';
                    if (isFullyAccepted) accentColor = 'success.main';
                    else if (isWinner) accentColor = 'info.main';
                    else if (hasFlag && isFlagActive) accentColor = 'error.main';
                    else if (hasFlag && !isFlagActive) accentColor = 'warning.main';

                    return (
                      <Card 
                        key={`${event.candidateId}-${candidateIndex}`}
                        sx={{ 
                          elevation: 0, 
                          borderRadius: 2,
                          bgcolor: colors.surface,
                          border: `1px solid ${colors.border}`,
                          borderLeft: accentColor !== 'transparent' ? `4px solid` : `1px solid`,
                          borderLeftColor: accentColor !== 'transparent' ? accentColor : colors.border,
                        }}
                      >
                        <CardContent>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                                Cand: {event.candidateId.substring(0, 8)}
                              </Typography>
                              {isFullyAccepted && <Chip icon={<CheckCircleIcon />} label="Accepted Candidate" size="small" color="success" variant="outlined" />}
                              {(isWinner && !isFullyAccepted) && <Chip label="Selected by Engine (Overridden)" size="small" color="info" variant="outlined" />}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(event.createdAt).toLocaleTimeString()}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                            <Box sx={{ flex: 1, bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" textTransform="uppercase">Extracted Value</Typography>
                              <Typography variant="h6" fontWeight="bold" color="text.primary">
                                {event.value !== null ? event.value : <span style={{ opacity: 0.5 }}>Null</span>} 
                                {event.unit && <span style={{ fontSize: '0.8em', color: 'text.secondary', marginLeft: '4px' }}>{event.unit}</span>}
                              </Typography>
                            </Box>
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <Typography variant="caption" color="text.secondary" textTransform="uppercase" display="block" sx={{ mb: 0.5 }}>Confidence Score</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={event.confidence * 100} 
                                  sx={{ 
                                    flex: 1, height: 6, borderRadius: 3, 
                                    bgcolor: 'action.hover',
                                    '& .MuiLinearProgress-bar': { bgcolor: event.confidence > 0.8 ? 'success.main' : event.confidence > 0.5 ? 'warning.main' : 'error.main' }
                                  }} 
                                />
                                <Typography variant="body2" fontWeight="bold" color="text.primary">{(event.confidence * 100).toFixed(0)}%</Typography>
                              </Box>
                            </Box>
                          </Box>

                          {event.extractionLogic && (
                            <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: hasFlag ? 2 : 0 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>Extraction Logic</Typography>
                              <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem" color="text.primary">{event.extractionLogic}</Typography>
                            </Box>
                          )}

                          {/* REBUILT: Robust Flag Details Block */}
                          {hasFlag && (
                            <Box sx={{ 
                              border: '1px solid', 
                              borderColor: isFlagActive ? 'error.main' : 'warning.main', 
                              bgcolor: 'action.hover',
                              p: 1.5, 
                              borderRadius: 1, 
                              display: 'flex', 
                              gap: 1.5, 
                              alignItems: 'flex-start' 
                            }}>
                              <WarningAmberIcon color={isFlagActive ? 'error' : 'warning'} fontSize="small" sx={{ mt: 0.5 }} />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                  <Typography variant="body2" color={isFlagActive ? 'error.main' : 'warning.main'} fontWeight="bold">
                                    Flag Type: {event.flag?.flagType || 'System Alert'}
                                  </Typography>
                                  <Chip 
                                    label={event.flag?.status || 'UNKNOWN'} 
                                    size="small" 
                                    color={isFlagActive ? 'error' : 'warning'}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                                  />
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                  Flagged on: {event.flag?.createdAt ? new Date(event.flag.createdAt).toLocaleString() : 'Unknown date'}
                                </Typography>
                                <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                                  {event.flag?.flagReason || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No reason provided by the system or reviewer.</span>}
                                </Typography>
                              </Box>
                            </Box>
                          )}

                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>

            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ParameterLineage;