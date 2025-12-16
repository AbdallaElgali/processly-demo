import { Box, Typography, Paper } from '@mui/material';
import { colors } from '@/theme/colors';

export const DocumentViewer = () => {
  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%',
      bgcolor: colors.background,
      borderLeft: `1px solid ${colors.border}`,
      p: 2,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" color={colors.textPrimary}>
          Document View
        </Typography>
      </Box>
      
      {/* The Document Container - Flex grow to fill available space */}
      <Paper sx={{ 
        flexGrow: 1, 
        bgcolor: '#fff', // PDF/Doc background is usually white
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative'
      }}>
        <Box sx={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: '#999'
        }}>
          <Typography>PDF Preview Component</Typography>
        </Box>
      </Paper>
    </Box>
  );
};