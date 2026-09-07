'use client';

import { Box, CircularProgress, Divider, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import SaveIcon from '@mui/icons-material/Save';
import DoneAllIcon from '@mui/icons-material/DoneAll'; 
import MessageIcon from '@mui/icons-material/Message';
import SettingsIcon from '@mui/icons-material/Settings'; // <-- NEW: Import for Templates
import { colors } from '@/theme/colors';

const TOOLBAR_WIDTH = 56;

interface ActionToolbarProps {
  onUploadClick: () => void;
  onAnalyze: () => void;
  onSave: () => void;
  onApprove: () => void; 
  onExport: () => void;
  onToggleSidebar: () => void;
  onFeedbackClick: () => void; 
  onManageTemplatesClick: () => void; // <-- NEW: Prop for opening templates modal
  isSidebarOpen: boolean;
  isAnalyzing: boolean;
  analyzeStatus: string;
  isSaving: boolean;
  isApproving: boolean; 
  isExporting: boolean;
  isAnalyzeDisabled: boolean;
  isApproveDisabled: boolean; 
  isExportDisabled: boolean;
  isFeedbackDisabled: boolean; 
}

export const ActionToolbar = ({
  onUploadClick,
  onAnalyze,
  onSave,
  onApprove, 
  onExport,
  onToggleSidebar,
  onFeedbackClick,
  onManageTemplatesClick, // <-- NEW: Destructure prop
  isSidebarOpen,
  isAnalyzing,
  analyzeStatus,
  isSaving,
  isApproving, 
  isExporting,
  isAnalyzeDisabled,
  isApproveDisabled, 
  isExportDisabled,
  isFeedbackDisabled, 
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

      {/* --- NEW: Manage Templates Button --- */}
      <Tooltip title="Manage Templates" placement="right">
        <IconButton onClick={onManageTemplatesClick} sx={{ color: 'text.secondary' }}>
          <SettingsIcon />
        </IconButton>
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