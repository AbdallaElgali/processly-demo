import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Fade,
  CircularProgress
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { colors } from '@/theme/colors';
import { InputField } from '@/types';

interface SubmitModalProps {
  open: boolean;
  onClose: () => void;
  fields: InputField[];
}

export const SubmitModal = ({ open, onClose, fields }: SubmitModalProps) => {
  const [step, setStep] = useState<'review' | 'submitting' | 'success'>('review');

  // Reset state when modal opens
  useEffect(() => {
    if (open) setStep('review');
  }, [open]);

  // Identify problematic fields
  const emptyFields = fields.filter(f => !f.value || String(f.value).trim() === '');
  const lowConfidenceFields = fields.filter(f => f.value && f.confidence !== null && f.confidence < 0.8);
  
  const hasIssues = emptyFields.length > 0 || lowConfidenceFields.length > 0;

  const handleSubmit = () => {
    setStep('submitting');
    
    // Simulate API call delay
    setTimeout(() => {
      setStep('success');
      
      // Close modal automatically after showing success state
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 2000);
  };

  return (
    <Dialog 
      open={open} 
      onClose={step === 'review' ? onClose : undefined} // Prevent closing during submission
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, p: 1 }
      }}
    >
      {/* --- STEP 1: REVIEW WARNINGS --- */}
      {step === 'review' && (
        <>
          <DialogTitle sx={{ fontWeight: 'bold', color: hasIssues ? colors.error : colors.primary }}>
            {hasIssues ? 'Validation Warnings' : 'Confirm Submission'}
          </DialogTitle>
          
          <DialogContent>
            {hasIssues ? (
              <>
                <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
                  The following parameters are missing or have low confidence. Are you sure you want to proceed?
                </Typography>

                <List dense sx={{ 
                  bgcolor: '#fff4f4', 
                  borderRadius: 1, 
                  border: '1px solid #ffcdd2',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {emptyFields.map(field => (
                    <ListItem key={field.id}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ErrorOutlineIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={field.label} 
                        secondary="Value is missing"
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption', color: 'error.main' }}
                      />
                    </ListItem>
                  ))}
                  
                  {lowConfidenceFields.map(field => (
                    <ListItem key={field.id}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <WarningAmberIcon color="warning" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={field.label} 
                        secondary={`Low confidence (${Math.round((field.confidence || 0) * 100)}%)`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption', color: 'warning.main' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            ) : (
              <Typography variant="body1">
                All fields look good. Ready to submit validation results?
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={onClose} sx={{ color: colors.textSecondary }}>
              Go Back
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSubmit}
              color={hasIssues ? "error" : "primary"}
              sx={{ px: 3 }}
            >
              {hasIssues ? 'Submit Anyway' : 'Submit'}
            </Button>
          </DialogActions>
        </>
      )}

      {/* --- STEP 2 & 3: ANIMATION STATES --- */}
      {step !== 'review' && (
        <Box sx={{ 
          height: 300, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          {step === 'submitting' && (
             <Fade in={true}>
                <Box>
                    <CircularProgress size={60} thickness={4} sx={{ color: colors.primary, mb: 3 }} />
                    <Typography variant="h6" color="text.secondary">Processing Submission...</Typography>
                </Box>
             </Fade>
          )}

          {step === 'success' && (
            <Fade in={true} timeout={500}>
                <Box>
                    <CheckCircleIcon sx={{ fontSize: 80, color: colors.success, mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold">Success!</Typography>
                    <Typography variant="body2" color="text.secondary">Data validated and exported.</Typography>
                </Box>
            </Fade>
          )}
        </Box>
      )}
    </Dialog>
  );
};