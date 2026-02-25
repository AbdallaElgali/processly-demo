'use client';

import React, { useRef, DragEvent } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles'; // Added for safe opacity handling
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
    // FIX 2: Clear the input value so the same file can be uploaded again
    if (e.target) {
      e.target.value = ''; 
    }
  };

  // FIX 1: Add Drag and Drop Handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Crucial: prevents the browser from opening the file
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <>
      {/* 1. Move the input OUTSIDE the Paper to prevent infinite click loops */}
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.png,.xlsx,.xlsm"
      />
      
      <Paper
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isUploaded ? colors.secondary : colors.border,
          backgroundColor: isUploaded ? alpha(colors.secondary, 0.06) : colors.surface, 
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: isUploaded ? colors.secondary : colors.primary,
            backgroundColor: isUploaded ? alpha(colors.secondary, 0.12) : alpha(colors.primary, 0.04),
          },
        }}
      >
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
    </>
  );
};