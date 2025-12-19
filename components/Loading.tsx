import React from 'react';
import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import { colors } from '@/theme/colors'; // Assuming this exists from previous steps

interface LoadingSpinnerProps {
  message?: string;
  open?: boolean; // Added control prop
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Processing...", 
  open = true 
}) => {
  return (
    <Backdrop
      open={open}
      sx={{
        // 1. Dark, semi-transparent background (No more white flash)
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 999,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', 
        // 2. The "Pro" touch: blurs the dashboard behind it
        backdropFilter: 'blur(4px)', 
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        {/* Background Track (The "Rail") */}
        <CircularProgress
          variant="determinate"
          value={100}
          size={50}
          thickness={4}
          sx={{
            color: colors.border, // Dark gray track
            position: 'absolute',
            left: 0,
          }}
        />
        
        {/* Foreground Spinner (The "Active" part) */}
        <CircularProgress
          variant="indeterminate"
          disableShrink
          size={50}
          thickness={4}
          sx={{
            color: colors.primary, // Voltavision Cyan
            animationDuration: '800ms',
            // Custom rounded caps look cleaner
            [`& .MuiCircularProgress-circle`]: {
              strokeLinecap: 'round',
            },
          }}
        />
      </Box>

      {/* Compact, Technical Text */}
      {message && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: colors.textSecondary,
            fontFamily: 'monospace', // Adds that "Terminal/System" feel
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
            animation: 'pulse 1.5s infinite ease-in-out',
            '@keyframes pulse': {
              '0%': { opacity: 0.6 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.6 },
            }
          }}
        >
          {message}
        </Typography>
      )}
    </Backdrop>
  );
};

export default LoadingSpinner;