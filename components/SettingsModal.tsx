import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, Button, Typography, CircularProgress, 
  Snackbar, Alert, Box, Divider 
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { colors } from '@/theme/colors';

// --- API Function ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const register_user = async (userData: { username: string; department: string; email?: string; password?: string }) => {
  const response = await fetch(`${API_URL}/auth/register-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to register user');
  }
  
  return await response.json();
};

// --- Component ---
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const [formData, setFormData] = useState({
    username: '',
    department: '',
    email: '',
    password: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.department) return;

    setIsLoading(true);
    try {
      // Clean up empty optional fields before sending
      const payload = {
        username: formData.username,
        department: formData.department,
        ...(formData.email && { email: formData.email }),
        ...(formData.password && { password: formData.password }),
      };

      await register_user(payload);
      
      setNotification({ type: 'success', message: `User ${formData.username} registered successfully!` });
      setFormData({ username: '', department: '', email: '', password: '' }); // Reset form
      
      // Auto-close after a short delay on success
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error registering user:', error);
      setNotification({ type: 'error', message: error.message || 'An error occurred during registration.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={!isLoading ? onClose : undefined} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ 
          sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}` } 
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon color="primary" />
          Settings: User Management
        </DialogTitle>
        
        <Divider sx={{ borderColor: colors.border }} />

        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
              Register a new user to the platform. Username and Department are required.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                required
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isLoading}
                sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
              />
              <TextField
                required
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isLoading}
                sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
              />
              <TextField
                label="Email (Optional)"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isLoading}
                sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
              />
              <TextField
                label="Password (Optional)"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isLoading}
                sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
              />
            </Box>
          </DialogContent>
          
          <DialogActions sx={{ p: 3, pt: 1 }}>
            <Button onClick={onClose} disabled={isLoading} sx={{ color: colors.textSecondary }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={isLoading || !formData.username || !formData.department}
              sx={{ bgcolor: colors.primary }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Register User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Notifications Toast */}
      <Snackbar 
        open={!!notification} 
        autoHideDuration={4000} 
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity={notification?.type || 'info'} 
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </>
  );
};