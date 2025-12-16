import { Box, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu'; // Import if using hamburger on mobile
import { colors } from '@/theme/colors';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const LayoutHeader = ({ onToggleSidebar }: HeaderProps) => {
  return (
    <Box sx={{ 
      height: '60px', 
      bgcolor: colors.surface,
      display: 'flex', 
      alignItems: 'center', 
      px: 2,
      borderBottom: `1px solid ${colors.border}`,
      zIndex: 1200
    }}>
      {/* Mobile Menu Icon (Only visible on small screens usually) */}
      <IconButton 
        onClick={onToggleSidebar}
        sx={{ mr: 2, display: { md: 'none' }, color: colors.textSecondary }}
      >
        <MenuIcon />
      </IconButton>

      <Typography variant="h5" sx={{ 
        color: colors.primary, 
        fontWeight: 'bold', 
        letterSpacing: '-0.5px' 
      }}>
        Voltavision <span style={{ color: colors.textSecondary, fontSize: '0.8em', fontWeight: 'normal' }}>Demo</span>
      </Typography>
    </Box>
  );
};