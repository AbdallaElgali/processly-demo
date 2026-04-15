'use client';

import { Box, Chip, IconButton, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import Link from 'next/link';
import { colors } from '@/theme/colors';
import { useState } from 'react';

interface ProjectBarProps {
  projectName: string;
  username?: string;
  onLogout?: () => void;
  /** 'edit' shows a "Review Mode" link; 'review' shows a "Back to Editor" link */
  mode?: 'edit' | 'review';
}

export const ProjectBar = ({ projectName, username, onLogout, mode = 'edit' }: ProjectBarProps) => {
  const [reviewModeEnabled, setReviewModeEnabled] = useState(false);
  return (
    <Box sx={{
      p: 1.5,
      px: 3,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: `1px solid ${colors.border}`,
      bgcolor: colors.surface,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2">
          Active Project:{' '}
          <strong style={{ color: colors.primary }}>{projectName || 'Loading...'}</strong>
        </Typography>

        {mode === 'review' && (
          <Chip
            label="REVIEW MODE"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: 0.5,
              bgcolor: `${colors.warning}22`,
              color: colors.warning,
              border: `1px solid ${colors.warning}55`,
            }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {reviewModeEnabled && mode === 'edit' && (
          <Link href="/review" style={{ textDecoration: 'none' }}>
            <Chip
              icon={<VisibilityIcon sx={{ fontSize: '14px !important' }} />}
              label="Review Mode"
              size="small"
              clickable
              sx={{
                fontSize: '0.7rem',
                color: colors.textSecondary,
                borderColor: colors.border,
                '&:hover': { borderColor: colors.primary, color: colors.primary },
              }}
              variant="outlined"
            />
          </Link>
        )}

        {mode === 'review' && (
          <Link href="/bda" style={{ textDecoration: 'none' }}>
            <Chip
              icon={<EditIcon sx={{ fontSize: '14px !important' }} />}
              label="Back to Editor"
              size="small"
              clickable
              sx={{
                fontSize: '0.7rem',
                color: colors.textSecondary,
                borderColor: colors.border,
                '&:hover': { borderColor: colors.primary, color: colors.primary },
              }}
              variant="outlined"
            />
          </Link>
        )}

        {username && (
          <Typography variant="caption" fontWeight="bold">
            {username}
          </Typography>
        )}

        {onLogout && (
          <IconButton onClick={onLogout} color="error" size="small">
            <LogoutIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};
