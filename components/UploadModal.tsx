'use client';

import { Box, Button, Modal, Paper, Typography } from '@mui/material';
import { DocumentUpload } from '@/components/document-upload';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  isUploaded: boolean;
  isLoading: boolean;
}

export const UploadModal = ({
  open,
  onClose,
  onUpload,
  isUploaded,
  isLoading,
}: UploadModalProps) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
      }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Project Documents
          </Typography>
          <DocumentUpload onUpload={onUpload} isUploaded={isUploaded} isLoading={isLoading} />
          <Button fullWidth variant="outlined" onClick={onClose} sx={{ mt: 3 }}>
            Back to Workspace
          </Button>
        </Paper>
      </Box>
    </Modal>
  );
};
