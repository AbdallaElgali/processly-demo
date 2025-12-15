'use client';

import React, { useRef } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { colors } from '@/theme/colors';

interface DocumentUploadProps {
  onUpload: (file: File) => void;
  isUploaded: boolean;
}

export const DocumentUpload = ({ onUpload, isUploaded }: DocumentUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <Paper
      onClick={handleClick}
      variant="outlined"
      sx={{
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: isUploaded ? colors.secondary : colors.border,
        backgroundColor: isUploaded ? `${colors.secondary}10` : colors.surface, // 10 is approx 6% opacity
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: isUploaded ? colors.secondary : colors.primary,
          backgroundColor: isUploaded ? `${colors.secondary}20` : `${colors.primary}08`,
        },
      }}
    >
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.png"
      />
      
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {isUploaded ? (
          <CheckCircleIcon sx={{ fontSize: 32, color: colors.secondary }} />
        ) : (
          <CloudUploadIcon sx={{ fontSize: 32, color: colors.primary }} />
        )}
        
        <Box>
          <Typography variant="h6" color="text.primary" gutterBottom>
            {isUploaded ? 'Document Uploaded Successfully' : 'Upload Document'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isUploaded 
              ? 'Click to replace with a different file' 
              : 'Drag and drop or click to select a file'}
          </Typography>
        </Box>

        {!isUploaded && (
          <Button variant="contained" color="primary" sx={{ mt: 1 }}>
            Select File
          </Button>
        )}
      </Box>
    </Paper>
  );
};