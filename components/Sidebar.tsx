import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { colors } from '@/theme/colors';
import { useEffect, useState } from 'react';

interface SidebarProps {
  files: Array<{ name: string; id: string }>;
  currentFileId: string | null;
  onSelectFile: (id: string) => void;
}

export const Sidebar = ({ files, currentFileId, onSelectFile }: SidebarProps) => {
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    if (currentFileId) {
      const currentFile = files.find(f => f.id === currentFileId);
      if (currentFile) {
        if (currentFile.name.length > 30) {
          setFileName(currentFile.name.slice(0, 15) + '...' + currentFile.name.slice(-10));
        } else {
          setFileName(currentFile?.name || '');
        }
      }
    } else {
      setFileName('');
    }
  }, [currentFileId, files]);
  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%',
      bgcolor: colors.surface, // Matches the reference image sidebar
      borderRight: `1px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      py: 2
    }}>
      <Typography variant="overline" sx={{ px: 2, color: colors.textSecondary, letterSpacing: 1 }}>
        Uploaded Files
      </Typography>

      <List sx={{ px: 1 }}>
        {files.map((file) => {
          const isActive = currentFileId === file.id;
          return (
            <ListItemButton
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              selected={isActive}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'rgba(0, 170, 185, 0.15)', // Transparent Cyan
                  borderLeft: `3px solid ${colors.primary}`, // The cyan accent line from your screenshot
                  '&:hover': { bgcolor: 'rgba(0, 170, 185, 0.25)' }
                },
                '&:hover': { bgcolor: colors.surfaceHighlight }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: isActive ? colors.primary : colors.textSecondary }}>
                <InsertDriveFileIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary={fileName} 
                primaryTypographyProps={{ 
                  variant: 'body2', 
                  color: isActive ? 'white' : colors.textSecondary,
                  fontWeight: isActive ? 600 : 400
                }} 
              />
            </ListItemButton>
          );
        })}
      </List>
      
      {files.length === 0 && (
         <Box sx={{ p: 2, color: colors.textSecondary, fontStyle: 'italic', fontSize: '0.8rem' }}>
            No files loaded
         </Box>
      )}
    </Box>
  );
};