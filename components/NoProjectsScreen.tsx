'use client';

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Paper,
  TextField,
  ThemeProvider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Modal,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { LayoutHeader } from '@/components/Headers/LayoutHeader';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/Customers'; // Adjust the import path as needed

interface NoProjectsScreenProps {
  onCreateProject: (alias: string, customerId: string, templateId: string | null) => Promise<void>;
}

const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

export const NoProjectsScreen = ({ onCreateProject }: NoProjectsScreenProps) => {
  const { user } = useAuth();
  
  // Project State
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Customer Data Hook
  const { customers, loadCustomers, createNewCustomer } = useCustomers();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // New Customer Modal UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomerAlias, setNewCustomerAlias] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSubmit = async () => {
    if (!alias.trim() || !selectedCustomerId) return;
    setError(null);
    try {
      const templateId = user && 'template_id' in user ? (user as any).template_id : null;
      await onCreateProject(alias.trim(), selectedCustomerId, templateId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project. Please try again.');
    }
  };

  const handleCreateNewCustomer = async () => {
    if (!newCustomerAlias.trim()) return;
    setModalError(null);
    setIsCreatingCustomer(true);
    
    try {
      // Use the hook to create the customer and get the resulting object
      const newlyCreated = await createNewCustomer(newCustomerAlias.trim(), newCustomerName.trim());
      
      if (newlyCreated) {
        setSelectedCustomerId(newlyCreated.id);
      }
      
      // Reset and close modal
      setNewCustomerAlias('');
      setNewCustomerName('');
      setIsModalOpen(false);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to create customer.');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.background }}>
        <LayoutHeader />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 450, width: '100%', textAlign: 'center' }}>
            <AddCircleOutlineIcon sx={{ fontSize: 60, color: colors.primary, mb: 2 }} />
            <Typography variant="h5" fontWeight="bold">Initialize BDA Project</Typography>

            {error && (
              <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Project Alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              sx={{ mt: 3, mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 3, textAlign: 'left' }}>
              <InputLabel id="customer-select-label">Customer</InputLabel>
              <Select
                labelId="customer-select-label"
                value={selectedCustomerId}
                label="Customer"
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    setIsModalOpen(true);
                  } else {
                    setSelectedCustomerId(e.target.value);
                  }
                }}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.alias_name} {customer.name ? `(${customer.name})` : ''}
                  </MenuItem>
                ))}
                <MenuItem value="ADD_NEW" sx={{ fontWeight: 'bold', color: colors.primary, borderTop: '1px solid #eee' }}>
                  + Add New Customer
                </MenuItem>
              </Select>
            </FormControl>

            <Button
              fullWidth
              variant="contained"
              disabled={!alias.trim() || !selectedCustomerId}
              onClick={handleSubmit}
            >
              Start Project
            </Button>
          </Paper>
        </Box>
      </Box>

      {/* New Customer Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => !isCreatingCustomer && setIsModalOpen(false)}
        aria-labelledby="modal-add-customer-title"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-add-customer-title" variant="h6" fontWeight="bold" mb={2}>
            Create New Customer
          </Typography>

          {modalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {modalError}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Alias Name (Required)"
            value={newCustomerAlias}
            onChange={(e) => setNewCustomerAlias(e.target.value)}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            fullWidth
            label="Full Name (Optional)"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            sx={{ mb: 3 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => setIsModalOpen(false)}
              disabled={isCreatingCustomer}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCreateNewCustomer}
              disabled={!newCustomerAlias.trim() || isCreatingCustomer}
            >
              {isCreatingCustomer ? 'Creating...' : 'Create'}
            </Button>
          </Box>
        </Box>
      </Modal>
    </ThemeProvider>
  );
};