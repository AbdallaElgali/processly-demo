'use client';

import { Box, CircularProgress, Divider, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import SaveIcon from '@mui/icons-material/Save';
import { colors } from '@/theme/colors';

const TOOLBAR_WIDTH = 56;

interface ActionToolbarProps {
  onUploadClick: () => void;
  onAnalyze: () => void;
  onSave: () => void;
  onExport: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isAnalyzing: boolean;
  analyzeStatus: string;
  isSaving: boolean;
  isExporting: boolean;
  isAnalyzeDisabled: boolean;
  isExportDisabled: boolean;
}

export const ActionToolbar = ({
  onUploadClick,
  onAnalyze,
  onSave,
  onExport,
  onToggleSidebar,
  isSidebarOpen,
  isAnalyzing,
  analyzeStatus,
  isSaving,
  isExporting,
  isAnalyzeDisabled,
  isExportDisabled,
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
    </Box>
  );
};
