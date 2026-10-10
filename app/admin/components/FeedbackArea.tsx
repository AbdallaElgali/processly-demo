import React from 'react';
import { Box, Typography } from '@mui/material';
import { FeedbackItem as IFeedbackItem } from '@/api/audit/feedback';
import { FeedbackItem } from './FeedbackItem';

interface Props {
  feedbacks: IFeedbackItem[];
}

export default function FeedbackArea({ feedbacks }: Props) {
  return (
    <Box sx={{ p: 3, flex: 1, overflowY: 'auto', bgcolor: 'surface.canvas' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        User Feedback ({feedbacks.length})
      </Typography>
      
      {feedbacks.length === 0 ? (
        <Typography color="text.secondary">No feedback available.</Typography>
      ) : (
        feedbacks.map((feedback, index) => (
          <FeedbackItem key={feedback.id ?? index} feedback={feedback} />
        ))
      )}
    </Box>
  );
}