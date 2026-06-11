'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { apiRegisterUser, RegisteredUser } from '@/api/analytics';
import { colors } from '@/theme/colors';

export const RegisterUserCard = () => {
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisteredUser | null>(null);

  const canSubmit = username.trim().length > 0 && department.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await apiRegisterUser({
        username: username.trim(),
        department: department.trim(),
      });
      setSuccess(result);
      setUsername('');
      setDepartment('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddIcon sx={{ color: colors.primary }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Register User
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
        Create a new engineer account so they can log in to the review tool.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
        <TextField
          label="Username"
          size="small"
          fullWidth
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isSubmitting}
        />
        <TextField
          label="Department"
          size="small"
          fullWidth
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          disabled={isSubmitting}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit}
          sx={{ bgcolor: colors.primary, '&:hover': { bgcolor: colors.primaryHover }, alignSelf: 'flex-start' }}
        >
          {isSubmitting ? 'Registering...' : 'Register User'}
        </Button>

        {error && <Alert severity="error">{error}</Alert>}
        {success && (
          <Alert severity="success">
            Registered <strong>{success.username}</strong> in {success.department}.
          </Alert>
        )}
      </Box>
    </Paper>
  );
};
