import React from 'react';
import { Card, CardContent, Typography, Chip, Box } from '@mui/material';
import { FeedbackItem as IFeedbackItem } from '@/api/audit/feedback';
import { colors } from '@/theme/colors';

interface Props {
  feedback: IFeedbackItem;
}

export const FeedbackItem: React.FC<Props> = ({ feedback }) => {
  // Determine chip color based on status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card sx={{ mb: 2, border: `1px solid ${colors.border}`, boxShadow: 'none', borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6">{feedback.title}</Typography>
          <Chip 
            label={feedback.status} 
            color={getStatusColor(feedback.status)} 
            size="small" 
            sx={{ textTransform: 'capitalize' }}
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {feedback.description}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 3, typography: 'caption', color: 'text.secondary' }}>
          <Typography variant="caption"><strong>Type:</strong> {feedback.feedback_type}</Typography>
          <Typography variant="caption"><strong>User ID:</strong> {feedback.user_id}</Typography>
          <Typography variant="caption">
            <strong>Date:</strong> {new Date(feedback.created_at).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};