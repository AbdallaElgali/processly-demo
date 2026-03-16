'use client';

import React, { useRef, DragEvent } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { colors } from '@/theme/colors';

interface DocumentUploadProps {
  onUpload: (file: File) => void;
  isUploaded: boolean;
  isLoading?: boolean;
}

export const DocumentUpload = ({ 
  onUpload, 
  isUploaded, 
  isLoading = false // Extracted from props with a default value
}: DocumentUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isLoading) return; // Prevent clicks while loading
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return; // Extra safeguard
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    if (e.target) {
      e.target.value = ''; 
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return; // Prevent dropping files while loading
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <>
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.png,.xlsx,.xlsm"
        disabled={isLoading} // Disable the native input
      />
      
      <Paper
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: isLoading ? 'default' : 'pointer',
          pointerEvents: isLoading ? 'none' : 'auto', // Disables hover effects while loading
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isLoading ? alpha(colors.primary, 0.5) : isUploaded ? colors.secondary : colors.border,
          backgroundColor: isLoading ? alpha(colors.primary, 0.02) : isUploaded ? alpha(colors.secondary, 0.06) : colors.surface, 
          transition: 'all 0.3s ease-in-out',
          // Add a subtle pulse animation when loading
          animation: isLoading ? 'pulse 1.5s infinite ease-in-out' : 'none',
          '@keyframes pulse': {
            '0%': { opacity: 0.7 },
            '50%': { opacity: 1 },
            '100%': { opacity: 0.7 },
          },
          '&:hover': {
            borderColor: isUploaded ? colors.secondary : colors.primary,
            backgroundColor: isUploaded ? alpha(colors.secondary, 0.12) : alpha(colors.primary, 0.04),
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {/* Dynamically render the icon based on loading/uploaded state */}
          {isLoading ? (
            <CircularProgress size={36} thickness={4} sx={{ color: colors.primary }} />
          ) : isUploaded ? (
            <CheckCircleIcon sx={{ fontSize: 36, color: colors.secondary }} />
          ) : (
            <CloudUploadIcon sx={{ fontSize: 36, color: colors.primary }} />
          )}
          
          <Box>
            <Typography variant="h6" color="text.primary" gutterBottom>
              {isLoading 
                ? 'Uploading...' 
                : isUploaded 
                  ? 'Document Uploaded Successfully' 
                  : 'Upload Document'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isLoading
                ? 'Please wait while we process your file.'
                : isUploaded 
                  ? 'Click to replace with a different file' 
                  : 'Drag and drop or click to select a file'}
            </Typography>
          </Box>

          {/* Hide the button completely when loading or uploaded */}
          {!isUploaded && !isLoading && (
            <Button variant="contained" color="primary" sx={{ mt: 1 }}>
              Select File
            </Button>
          )}
        </Box>
      </Paper>
    </>
  );
};