'use client';

import { Box, CircularProgress, Divider, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import SaveIcon from '@mui/icons-material/Save';
import DoneAllIcon from '@mui/icons-material/DoneAll'; // <-- NEW: Import for batch approval
import { colors } from '@/theme/colors';
import MessageIcon from '@mui/icons-material/Message';

const TOOLBAR_WIDTH = 56;

interface ActionToolbarProps {
  onUploadClick: () => void;
  onAnalyze: () => void;
  onSave: () => void;
  onApprove: () => void; // <-- NEW
  onExport: () => void;
  onToggleSidebar: () => void;
  onFeedbackClick: () => void; // <-- NEW
  isSidebarOpen: boolean;
  isAnalyzing: boolean;
  analyzeStatus: string;
  isSaving: boolean;
  isApproving: boolean; // <-- NEW
  isExporting: boolean;
  isAnalyzeDisabled: boolean;
  isApproveDisabled: boolean; // <-- NEW
  isExportDisabled: boolean;
  isFeedbackDisabled: boolean; // <-- NEW
}

export const ActionToolbar = ({
  onUploadClick,
  onAnalyze,
  onSave,
  onApprove, // <-- NEW
  onExport,
  onToggleSidebar,
  onFeedbackClick,
  isSidebarOpen,
  isAnalyzing,
  analyzeStatus,
  isSaving,
  isApproving, // <-- NEW
  isExporting,
  isAnalyzeDisabled,
  isApproveDisabled, // <-- NEW
  isExportDisabled,
  isFeedbackDisabled, // <-- NEW
}: ActionToolbarProps) => {
  return (
    <Box sx={{
      width: TOOLBAR_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 2,
      gap: 2,
      borderRight: `1px solid ${colors.border}`,
      bgcolor: colors.surface,
    }}>
      <Tooltip title="Upload Document" placement="right">
        <IconButton onClick={onUploadClick} color="primary">
          <CloudUploadIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title={isAnalyzing ? analyzeStatus : 'Analyze'} placement="right">
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={onAnalyze} disabled={isAnalyzeDisabled}>
            <AutoAwesomeIcon />
          </IconButton>
          {isAnalyzing && (
            <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1, color: colors.secondary }} />
          )}
        </Box>
      </Tooltip>

      <Tooltip title="Save" placement="right">
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={onSave} disabled={isSaving} color="success">
            <SaveIcon />
          </IconButton>
          {isSaving && (
            <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
          )}
        </Box>
      </Tooltip>

      {/* --- NEW: Approve Document Button --- */}
      <Tooltip title="Approve Document" placement="right">
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={onApprove} disabled={isApproveDisabled} color="primary">
            <DoneAllIcon />
          </IconButton>
          {isApproving && (
            <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
          )}
        </Box>
      </Tooltip>

      <Tooltip title="Export .battery File" placement="right">
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={onExport} disabled={isExportDisabled} color="info">
            <DownloadIcon />
          </IconButton>
          {isExporting && (
            <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
          )}
        </Box>
      </Tooltip>

      <Divider sx={{ width: '70%', my: 1 }} />

      <IconButton onClick={onToggleSidebar}>
        {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
      </IconButton>
      <Tooltip title="Feedback" placement="right">
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={onFeedbackClick} disabled={isFeedbackDisabled} color="secondary">
            <MessageIcon />
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
};