'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  SelectChangeEvent,
  Alert,
  Box,
  Typography,
  FormHelperText
} from '@mui/material';
import { colors } from '@/theme/colors';

import { submitFeedbackApi, UserFeedbackPayload } from '@/api/feedback'; 

export interface DocumentItem {
  id: string;
  name: string;
}

export interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  projectId: string;
  documents?: DocumentItem[];
}

export function FeedbackModal({
  open,
  onClose,
  userId,
  projectId,
  documents = []
}: FeedbackModalProps) {
  const [type, setType] = useState<string>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<string>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTypeChange = (event: SelectChangeEvent) => {
    setType(event.target.value);
  };

  const handleDocumentChange = (event: SelectChangeEvent) => {
    setSelectedDocument(event.target.value);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTimeout(() => {
        setType('general');
        setTitle('');
        setDescription('');
        setSelectedDocument('none');
        setError(null);
        setSuccess(false);
      }, 200);
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Construct payload matching the UserFeedback Pydantic model
    const payload: UserFeedbackPayload = {
      user_id: userId,
      project_id: projectId,
      document_id: selectedDocument !== 'none' ? selectedDocument : null,
      feedback_type: type,
      title: title.trim(), // Now guaranteed to be a string
      description: description.trim(),
      status: 'new',
      metadata: {
        submittedAt: new Date().toISOString(),
        url: window.location.href,
      }
    };

    try {
      // Call the API function
      await submitFeedbackApi(payload);

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('Feedback submission error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { bgcolor: colors.surface || '#fff', borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight="bold">
          Submit Feedback
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {success ? (
          <Alert severity="success">
            Thank you for your feedback! It has been submitted successfully.
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error">{error}</Alert>}
            
            <Box sx={{ mt: 1, display: 'flex', gap: 2, flexDirection: 'column' }}>
              <FormControl fullWidth size="small">
                <InputLabel id="feedback-type-label">Feedback Type</InputLabel>
                <Select
                  labelId="feedback-type-label"
                  value={type}
                  label="Feedback Type"
                  onChange={handleTypeChange}
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="bug">Bug Report</MenuItem>
                  <MenuItem value="feature">Feature Request</MenuItem>
                  <MenuItem value="document-specific">Document Specific</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="document-select-label">Related Document</InputLabel>
                <Select
                  labelId="document-select-label"
                  value={selectedDocument}
                  label="Related Document"
                  onChange={handleDocumentChange}
                >
                  <MenuItem value="none">
                    <em>None</em>
                  </MenuItem>
                  {documents.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Hint: if the issue is related to a document, please select it.
                </FormHelperText>
              </FormControl>
            </Box>

            <TextField
              label="Title"
              variant="outlined"
              size="small"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your feedback"
            />

            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              multiline
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details here..."
            />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        {!success && (
          <>
            <Button onClick={handleClose} disabled={isSubmitting} color="inherit">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !title.trim() || !description.trim()} 
              variant="contained"
              sx={{ bgcolor: colors.primary, '&:hover': { bgcolor: colors.primaryHover } }}
            >
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}