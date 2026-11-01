'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import type { FeedbackParameter } from '@/lib/feedback/payload';
import { FeedbackDialog } from './FeedbackDialog';

/** Review screen entry: opens the feedback form already filled with this parameter. */
export function SendFeedbackButton({ parameter }: { parameter: FeedbackParameter }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="small"
        startIcon={<FeedbackOutlinedIcon fontSize="small" />}
        aria-label={`Send feedback about ${parameter.alias || parameter.key}`}
        onClick={() => setOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Send feedback
      </Button>
      {open && <FeedbackDialog parameter={parameter} onClose={() => setOpen(false)} />}
    </>
  );
}
