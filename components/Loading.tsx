import React from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

// Optional: Define a prop type for flexibility
interface LoadingSpinnerProps {
  message?: string;
  size?: number; // Size in pixels
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, size = 60 }) => {
  return (
    // OUTER BOX: Creates the full-screen, opaque overlay (The "Backdrop")
    <Box
      sx={{
        // 1. Full-screen covering the viewport
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        
        // 2. Semi-transparent background (blocks interaction)
        backgroundColor: 'rgba(255, 255, 255, 0.8)', // White with 80% opacity
        
        // 3. Center the content (the spinner)
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        
        // 4. Ensure it sits on top of all other content
        zIndex: 9999, 
        
        // Disable pointer events on the overlay itself, but we need them active 
        // to receive the mouse click and effectively block the elements beneath.
        // We ensure the whole box is the blocking element.
      }}
    >
      {/* INNER BOX: Centers the CircularProgress and Message */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: 'primary.main', // Color for the spinner
          padding: 4,
          // You can add a background here if you want the spinner area to stand out more
        }}
      >
        <CircularProgress size={size} color="inherit" />
        
        {/* Conditionally render the message if provided */}
        {message && (
          <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
            {message}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default LoadingSpinner;