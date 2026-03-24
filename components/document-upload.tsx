'use client';

import React, { useRef, DragEvent } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { colors } from '@/theme/colors';

interface DocumentUploadProps {
  onUpload: (files: File[]) => void; 
  isUploaded: boolean;
  isLoading?: boolean;
}

export const DocumentUpload = ({ 
  onUpload, 
  isUploaded, 
  isLoading = false 
}: DocumentUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isLoading) return; 
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return; 
    
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onUpload(filesArray);
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
    
    if (isLoading) return; 
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onUpload(filesArray);
    }
  };

  return (
    <>
      <input
        type="file"
        hidden
        multiple 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.png,.xlsx,.xlsm"
        disabled={isLoading} 
      />
      
      <Paper
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        variant="outlined"
        sx={{
          p: 1.5, // Reduced padding
          display: 'flex', // Switched to horizontal layout
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          cursor: isLoading ? 'default' : 'pointer',
          pointerEvents: isLoading ? 'none' : 'auto', 
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isLoading ? alpha(colors.primary, 0.5) : isUploaded ? colors.secondary : colors.border,
          backgroundColor: isLoading ? alpha(colors.primary, 0.02) : isUploaded ? alpha(colors.secondary, 0.06) : colors.surface, 
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: isUploaded ? colors.secondary : colors.primary,
            backgroundColor: isUploaded ? alpha(colors.secondary, 0.12) : alpha(colors.primary, 0.04),
          },
        }}
      >
        {isLoading ? (
          <CircularProgress size={24} thickness={4} sx={{ color: colors.primary }} />
        ) : isUploaded ? (
          <CheckCircleIcon sx={{ fontSize: 28, color: colors.secondary }} />
        ) : (
          <CloudUploadIcon sx={{ fontSize: 28, color: colors.primary }} />
        )}
        
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {isLoading 
              ? 'Uploading...' 
              : isUploaded 
                ? 'Documents Uploaded' 
                : 'Click or drag documents to upload'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.25 }}>
            {isLoading
              ? 'Processing files'
              : isUploaded 
                ? 'Click to replace' 
                : 'Supports PDF, DOCX, XLSX, JPG, PNG'}
          </Typography>
        </Box>
      </Paper>
    </>
  );
};