import { Box, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { colors } from '@/theme/colors';

interface HeaderProps {
  onToggleSidebar?: () => void;
  title?: string; // Optional for backward compatibility
  settingsIcon?: React.ReactNode; // Optional for backward compatibility
}

export const LayoutHeader = ({ onToggleSidebar, title, settingsIcon }: HeaderProps) => {
  return (
    <Box sx={{ 
      height: '60px', 
      flexShrink: 0,
      bgcolor: colors.surface,
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2,
      borderBottom: `1px solid ${colors.border}`,
      zIndex: 1200
    }}>
      
      {/* LEFT: Mobile Menu Icon + Voltavision Logo */}
      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        <IconButton 
          onClick={onToggleSidebar}
          sx={{ mr: 2, display: { md: 'none' }, color: colors.textSecondary }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h5" sx={{ 
          color: colors.primary, 
          fontWeight: 'bold', 
          letterSpacing: '-0.5px',
          whiteSpace: 'nowrap'
        }}>
          Voltavision <span style={{ color: colors.textSecondary, fontSize: '0.8em', fontWeight: 'normal' }}>Processly Demo</span>
        </Typography>
      </Box>

      {/* CENTER: Dynamic Title */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {title && (
          <Typography variant="h6" fontWeight="bold">
            {title}
          </Typography>
        )}
      </Box>
      
      {/* RIGHT: Dynamic Actions / Settings */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {settingsIcon}
      </Box>

    </Box>
  );
};