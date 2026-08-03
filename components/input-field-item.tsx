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
  Badge,
  Button,
  InputBase // <-- Added
} from '@mui/material';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FlagIcon from '@mui/icons-material/Flag';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // <-- Added
import ExpandLessIcon from '@mui/icons-material/ExpandLess'; // <-- Added
import { InputField, SpecificationSource, SCHEMA_GROUPS } from '@/types';
import { updateProjectParameter } from '@/api/projects'; // <-- Added
import { colors } from '@/theme/colors';

interface InputFieldItemProps {
  field: InputField;
  onChange: (id: string, value: string, unit: string) => void;
  onRemove: (id: string) => void;
  onShowSource: (source: SpecificationSource) => void;
  onSwitch: (fieldId: string, specId: string) => void;
  onFlag?: (id: string, isFlagged: boolean, reason?: string | null) => void;
  onUpdateMetadata: (dbId: string, fieldId: string, data: updateProjectParameter) => void; // <-- Added
  readOnly?: boolean;
}

const getConfidenceColor = (confidence: number | null) => {
  if (confidence === null) return colors.border;
  if (confidence >= 95) return colors.success;
  if (confidence >= 80) return colors.warning;
  return '#ef4444';
};

type PanelView = 'none' | 'ai' | 'snippet' | 'flag';

export const InputFieldItem = ({ field, onChange, onRemove, onShowSource, onSwitch, onFlag, onUpdateMetadata, readOnly = false }: InputFieldItemProps) => {
  const [activePanel, setActivePanel] = useState<PanelView>('none');
  const [flagReasonDraft, setFlagReasonDraft] = useState<string>(field.flagReason || '');
  
  // NEW: State for the metadata details expander
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // Cast field to any to access the newly mapped optional properties
  const fAny = field as any;
  const currentAlias = fAny.parameter_alias || field.label || '';
  const currentDesc = fAny.description_override || '';
  const currentAi = fAny.ai_instructions || '';

  // NEW: Inline editing states
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [editAlias, setEditAlias] = useState(currentAlias);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(currentDesc);

  const [isEditingAi, setIsEditingAi] = useState(false);
  const [editAi, setEditAi] = useState(currentAi);

  const activeSpec = field.specifications.find(s => s.id === field.selectedSpecId) || field.specifications[0];
  const suggestions = field.specifications.filter(s => s.id !== activeSpec?.id);

  const displayValue = activeSpec ? activeSpec.value : '';

  const defaultUnit = SCHEMA_GROUPS.flatMap(g => g.fields).find(f => f.id === field.id)?.unit || '';
  const displayUnit = activeSpec?.unit ?? defaultUnit;

  const displayConfidence = activeSpec ? activeSpec.confidence : null;
  const displaySource = activeSpec ? activeSpec.source : null;

  const hasAiData = displayConfidence !== null || suggestions.length > 0;

  const isFlagged = field.isFlagged ?? false;
  const flagReason = field.flagReason ?? null;
  
  const handleSourceClick = () => {
    if (!displaySource) return;

    if (displaySource.boundingBox === null && displaySource.pageNumber === null) {
      setActivePanel(prev => prev === 'snippet' ? 'none' : 'snippet');
    } else {
      onShowSource(displaySource);
    }
  };

  const handleSaveFlag = () => {
    setActivePanel('none');
    if (onFlag) onFlag(field.id, true, flagReasonDraft); 
  };

  const handleClearFlag = () => {
    setActivePanel('none');
    setFlagReasonDraft('');
    if (onFlag) onFlag(field.id, false, '');
  };

  // NEW: Save handlers for metadata
  const handleSaveMetadata = (newAlias: string, newDesc: string, newAi: string) => {
    if (newAlias === currentAlias && newDesc === currentDesc && newAi === currentAi) return;
    
    onUpdateMetadata(field.dbId, field.id, {
      parameter_alias: newAlias || null,
      description_override: newDesc || null,
      ai_instructions: newAi || null
    });
  };

  const handleBlurAlias = () => {
    setIsEditingAlias(false);
    handleSaveMetadata(editAlias, currentDesc, currentAi);
  };

  const handleBlurDesc = () => {
    setIsEditingDesc(false);
    handleSaveMetadata(currentAlias, editDesc, currentAi);
  };

  const handleBlurAi = () => {
    setIsEditingAi(false);
    handleSaveMetadata(currentAlias, currentDesc, editAi);
  };

  return (
    <Box sx={{ py: 1.5, borderBottom: `1px solid ${colors.border}40`, '&:last-child': { borderBottom: 'none' } }}>

      {/* PRIMARY HUMAN INPUT ROW */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>

        {/* Expand Button & Label Area */}
        <Box sx={{ flex: '0 0 30%', minWidth: 0, display: 'flex', alignItems: 'center' }}>
          <IconButton 
            size="small" 
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            sx={{ p: 0.5, mr: 0.5, color: 'text.secondary', ml: -1 }}
          >
            {isDetailsExpanded ? <ExpandLessIcon fontSize="inherit" /> : <ExpandMoreIcon fontSize="inherit" />}
          </IconButton>
          
          {isEditingAlias ? (
            <InputBase
              value={editAlias}
              onChange={(e) => setEditAlias(e.target.value)}
              onBlur={handleBlurAlias}
              onKeyDown={(e) => e.key === 'Enter' && handleBlurAlias()}
              autoFocus
              sx={{ typography: 'body2', fontWeight: 500, flex: 1, color: 'text.primary' }}
            />
          ) : (
            <Typography 
              variant="body2" 
              fontWeight={500} 
              color="text.primary" 
              noWrap 
              title={readOnly ? currentAlias : "Double click to edit alias"}
              onDoubleClick={() => {
                if (!readOnly) {
                  setEditAlias(currentAlias);
                  setIsEditingAlias(true);
                }
              }}
              sx={{ cursor: readOnly ? 'default' : 'text', flex: 1 }}
            >
              {currentAlias || field.id}
            </Typography>
          )}
        </Box>

        {/* Input Fields (Value + Unit) */}
        <Box sx={{ flex: '1 1 auto', display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={displayValue}
            onChange={readOnly ? undefined : (e) => onChange(field.id, e.target.value, displayUnit)}
            placeholder={readOnly ? '—' : 'Enter value...'}
            variant="outlined"
            inputProps={{ readOnly }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: readOnly ? `${colors.surfaceHighlight}80` : 'background.paper',
                borderRadius: 1.5,
                cursor: readOnly ? 'default' : undefined,
              }
            }}
          />
          <TextField
            size="small"
            value={displayUnit}
            onChange={readOnly ? undefined : (e) => onChange(field.id, displayValue, e.target.value)}
            placeholder="Unit"
            variant="outlined"
            inputProps={{ readOnly }}
            sx={{
              width: 90,
              flexShrink: 0,
              '& .MuiOutlinedInput-root': {
                bgcolor: readOnly ? `${colors.surfaceHighlight}80` : 'background.paper',
                borderRadius: 1.5,
                cursor: readOnly ? 'default' : undefined,
              }
            }}
          />
        </Box>

        {/* Action Tools */}
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>

          {/* Flag Toggle Tool */}
          <Tooltip title={isFlagged ? "Edit Flag" : "Flag Parameter"} arrow>
            <IconButton
              size="small"
              onClick={() => setActivePanel(prev => prev === 'flag' ? 'none' : 'flag')}
              sx={{
                color: isFlagged ? colors.warning : colors.textSecondary,
                bgcolor: activePanel === 'flag' ? `${colors.warning}15` : 'transparent',
                '&:hover': { color: colors.warning, bgcolor: `${colors.warning}15` }
              }}
            >
              {isFlagged ? <FlagIcon fontSize="small" /> : <OutlinedFlagIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Source Locator Tool */}
          {displaySource && (
            <Tooltip title="Locate in Document" arrow>
              <IconButton
                size="small"
                onClick={handleSourceClick}
                sx={{
                  color: activePanel === 'snippet' ? colors.primary : colors.textSecondary,
                  bgcolor: activePanel === 'snippet' ? `${colors.primary}15` : 'transparent',
                  '&:hover': { color: colors.primary, bgcolor: `${colors.primary}15` }
                }}
              >
                <FindInPageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* AI Assistance Tool */}
          {hasAiData && (
            <Tooltip title="AI Assistant & Alternatives" arrow>
              <IconButton
                size="small"
                onClick={() => setActivePanel(prev => prev === 'ai' ? 'none' : 'ai')}
                sx={{
                  color: activePanel === 'ai' ? colors.primary : colors.textSecondary,
                  bgcolor: activePanel === 'ai' ? `${colors.primary}15` : 'transparent',
                  '&:hover': { color: colors.primary, bgcolor: `${colors.primary}15` }
                }}
              >
                <Badge color="primary" variant="dot" invisible={suggestions.length === 0 || activePanel === 'ai'}>
                  <AutoAwesomeIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* METADATA EXPANSION AREA (Description & AI Instructions) */}
      <Collapse in={isDetailsExpanded} unmountOnExit>
        <Box sx={{
          mt: 1,
          ml: 4, // Aligns under the label text
          mr: 2,
          pb: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}>
          
          {/* Description Override */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>
              Description Override
            </Typography>
            {isEditingDesc ? (
              <InputBase
                fullWidth
                multiline
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onBlur={handleBlurDesc}
                autoFocus
                sx={{ 
                  typography: 'body2', 
                  color: 'text.primary',
                  bgcolor: 'background.paper', 
                  p: 1, 
                  borderRadius: 1, 
                  border: `1px solid ${colors.primary}40` 
                }}
              />
            ) : (
              <Typography 
                variant="body2" 
                color={currentDesc ? 'text.primary' : 'text.disabled'}
                onDoubleClick={() => {
                  if (!readOnly) {
                    setEditDesc(currentDesc);
                    setIsEditingDesc(true);
                  }
                }}
                sx={{ 
                  cursor: readOnly ? 'default' : 'text', 
                  minHeight: '24px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={readOnly ? "" : "Double click to edit description"}
              >
                {currentDesc || "Double-click to add a description..."}
              </Typography>
            )}
          </Box>

          {/* AI Instructions */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>
              AI Extraction Instructions
            </Typography>
            {isEditingAi ? (
              <InputBase
                fullWidth
                multiline
                value={editAi}
                onChange={(e) => setEditAi(e.target.value)}
                onBlur={handleBlurAi}
                autoFocus
                sx={{ 
                  typography: 'body2', 
                  color: 'text.primary',
                  bgcolor: 'background.paper', 
                  p: 1, 
                  borderRadius: 1, 
                  border: `1px solid ${colors.primary}40` 
                }}
              />
            ) : (
              <Typography 
                variant="body2" 
                color={currentAi ? 'text.primary' : 'text.disabled'}
                onDoubleClick={() => {
                  if (!readOnly) {
                    setEditAi(currentAi);
                    setIsEditingAi(true);
                  }
                }}
                sx={{ 
                  cursor: readOnly ? 'default' : 'text', 
                  minHeight: '24px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={readOnly ? "" : "Double click to edit AI instructions"}
              >
                {currentAi || "Double-click to add AI instructions..."}
              </Typography>
            )}
          </Box>

        </Box>
      </Collapse>

      {/* SECONDARY PANEL EXPANSION AREA (AI, Snippet, Flag) */}
      <Collapse in={activePanel !== 'none'} unmountOnExit>
        <Box sx={{
          mt: 1,
          ml: '30%',
          p: 1.5,
          bgcolor: `${colors.primary}08`,
          borderRadius: 1.5,
          border: `1px solid ${colors.primary}20`
        }}>

          {/* VIEW: AI TOOLS */}
          {activePanel === 'ai' && (
            <Box>
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
                    {readOnly ? 'AI Suggested Alternatives (read-only):' : 'AI Suggested Alternatives:'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {suggestions.map(spec => (
                      <Chip
                        key={spec.id}
                        size="small"
                        variant="outlined"
                        label={`${spec.value} ${spec.unit || ''}`}
                        onClick={readOnly ? undefined : () => {
                          onSwitch(field.id, spec.id);
                          setActivePanel('none');
                        }}
                        sx={{
                          fontSize: '0.75rem',
                          borderColor: getConfidenceColor(spec.confidence),
                          color: 'text.primary',
                          bgcolor: 'background.paper',
                          cursor: readOnly ? 'default' : 'pointer',
                          '&:hover': readOnly ? {} : { bgcolor: `${getConfidenceColor(spec.confidence)}15` }
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* VIEW: SOURCE SNIPPET FALLBACK */}
          {activePanel === 'snippet' && displaySource?.textSnippet && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                Exact source coordinates not found.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Matched to the following extracted snippet:
              </Typography>
              <Box sx={{
                p: 1.5,
                bgcolor: 'background.paper',
                borderLeft: `3px solid ${colors.primary}`,
                borderRadius: 1,
                typography: 'body2',
                fontStyle: 'italic',
                color: 'text.secondary'
              }}>
                &quot;{displaySource.textSnippet}&quot;
              </Box>
            </Box>
          )}

          {/* VIEW: FLAGGING UI */}
          {activePanel === 'flag' && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ display: 'block', mb: 1 }}>
                Flag this parameter for review:
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={flagReasonDraft}
                onChange={(e) => setFlagReasonDraft(e.target.value)}
                placeholder="Optional reason (e.g., missing from doc, check table on page 4)"
                variant="outlined"
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                {isFlagged && (
                  <Button size="small" color="error" onClick={handleClearFlag}>
                    Remove Flag
                  </Button>
                )}
                <Button size="small" variant="contained" onClick={handleSaveFlag} disableElevation>
                  {isFlagged ? 'Update Flag' : 'Save Flag'}
                </Button>
              </Box>
            </Box>
          )}

        </Box>
      </Collapse>

    </Box>
  );
};