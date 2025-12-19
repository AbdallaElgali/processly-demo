import { Box, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { colors } from '@/theme/colors';

export const LayoutHeader = ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => {
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
      <IconButton 
        onClick={onToggleSidebar}
        sx={{ mr: 2, display: { md: 'none' }, color: colors.textSecondary }}
      >
        <MenuIcon />
      </IconButton>

      {/* Exact Voltavision SVG Logo Path from Source */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <svg 
          width="180" // Adjusted width for header
          viewBox="0 0 278 40" 
          fill={colors.primary} // Uses your theme color
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          <path d="M253.031 39.9994H258.779L260.952 35.7419V23.9329L263.316 19.2944H269.724V39.9994H275.473L277.646 35.7419V11.9887H258.745L253.031 23.1928V39.9994ZM228.708 32.6943V23.809L231.004 19.2944H238.389V28.1787L236.091 32.6943H228.708ZM220.876 39.9994H240.506L246.22 28.7949V11.9887H226.59L220.876 23.1928V39.9994ZM205.393 39.9994H211.242L213.415 35.7419V11.9887H209.114L205.393 19.2938V39.9994ZM175.783 39.9994H194.965L198.214 33.6245V28.3587L185.207 21.0536V19.295H197.519L199.951 14.5443V11.9898H180.881L177.689 18.2417V23.6305L190.696 30.924V32.6943H178.215L175.783 37.4447V39.9994ZM162.317 39.9994H168.166L170.339 35.7419V11.9887H166.037L162.317 19.2938V39.9994ZM133.088 11.9887L130.914 16.2462V39.9994H146.286L162.701 7.78695V0H157.928L141.267 32.6943H138.837V11.9887H133.088ZM97.9186 39.9994H109.616L112.035 35.2493V32.6948H105.84V23.9218L108.204 19.295H115.06V40H120.808L122.982 35.7422V11.989H103.632L97.9174 23.1934L97.9186 39.9994ZM76.981 19.2944H80.9025V39.9994H86.6498L88.8236 35.7419V19.2944H93.238L95.6577 14.5437V11.989H88.823V5.15449H82.896L76.9804 16.7397L76.981 19.2944ZM63.6054 39.9994H69.3527L71.5261 35.7419V0H67.3358L63.6054 7.32766V39.9994ZM38.6437 32.6943V23.809L40.9405 19.2944H48.3242V28.1787L46.0272 32.6943H38.6437ZM30.8118 39.9994H50.4419L56.1559 28.7949V11.9887H36.5261L30.8118 23.1928V39.9994ZM2.17375 11.9887L0 16.2462V39.9994H15.4845L26.0383 19.2944V11.989H20.9297L10.3759 32.6948H7.92222V11.989L2.17375 11.9887Z" />
        </svg>

        {/* Processly Tag - Using a clean, contrasting font */}
        <Typography sx={{ 
          color: colors.textSecondary, 
          fontSize: '12px', 
          fontWeight: 600, 
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderLeft: `1px solid ${colors.border}`,
          pl: 1.5,
          mt: 0.5
        }}>
          Processly Demo
        </Typography>
      </Box>
    </Box>
  );
};