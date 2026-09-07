import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, IconButton, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, CircularProgress, FormControl, InputLabel,
  Select, MenuItem, Alert
} from '@mui/material';
import { InsertDriveFile as InsertDriveFileIcon, PersonAdd as PersonAddIcon, Add as AddIcon } from '@mui/icons-material';
import { colors } from '@/theme/colors';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectDocument } from '@/api/projects';
import { BaseSidebar } from './BaseSideBar';
import { useCustomers } from '@/hooks/Customers'; // Make sure this path matches your setup

interface BDASidebarProps {
  currentFileId: string | null;
  onSelectFile: (id: string) => void;
}

export const Sidebar = ({ currentFileId, onSelectFile }: BDASidebarProps) => {
  const { 
    projects, currentProject, loadProjectDetails, 
    addContributor, createNewProject, isLoading 
  } = useProject();

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  
  // Contributor State
  const [isContributorModalOpen, setContributorModalOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [contributorUsername, setContributorUsername] = useState('');
  const [addContributorEnabled, setAddContributorEnabled] = useState(false);

  // Customer Data Hook
  const { customers, loadCustomers, createNewCustomer } = useCustomers();

  // Create Project State
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  // Create Customer State
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerAlias, setNewCustomerAlias] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerModalError, setCustomerModalError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleToggleProject = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
    } else {
      setExpandedProjectId(projectId);
      if (currentProject?.id !== projectId) await loadProjectDetails(projectId);
    }
  };

  const handleOpenContributorModal = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setTargetProjectId(projectId);
    setContributorUsername('');
    setContributorModalOpen(true);
  };

  const handleAddContributor = async () => {
    if (!targetProjectId || !contributorUsername.trim()) return;
    try {
      await addContributor(targetProjectId, contributorUsername.trim());
      setContributorModalOpen(false);
    } catch (error) { console.error("Failed to add contributor:", error); }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim() || !selectedCustomerId) {
      setCreateProjectError('Project Title and Customer are required.');
      return;
    }
    setCreateProjectError(null);
    try {
      const newProject = await createNewProject({ 
        alias_id: newProjectTitle.trim(), 
        description: newProjectDesc.trim(),
        customer_id: selectedCustomerId,
        template_id: selectedTemplateId || null
      });
      
      setCreateModalOpen(false);
      setNewProjectTitle('');
      setNewProjectDesc('');
      setSelectedCustomerId('');
      setSelectedTemplateId('');
      
      if (newProject?.id) {
        setExpandedProjectId(newProject.id);
        await loadProjectDetails(newProject.id);
      }
    } catch (error: any) { 
      setCreateProjectError(error.message || 'Failed to create project.');
      console.error("Failed to create project:", error); 
    }
  };

  const handleCreateNewCustomer = async () => {
    if (!newCustomerAlias.trim()) return;
    setCustomerModalError(null);
    setIsCreatingCustomer(true);
    
    try {
      const newlyCreated = await createNewCustomer(newCustomerAlias.trim(), newCustomerName.trim());
      if (newlyCreated) setSelectedCustomerId(newlyCreated.id);
      
      setNewCustomerAlias('');
      setNewCustomerName('');
      setIsNewCustomerModalOpen(false);
    } catch (err: any) {
      setCustomerModalError(err.message || 'Failed to create customer.');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const activeFiles = currentProject?.documents || [];
  const formattedProjects = projects.map(p => ({
    id: p.id,
    primaryText: p.alias_id || p.name || 'Untitled Project'
  }));

  return (
    <>
      <BaseSidebar
        projects={formattedProjects}
        selectedProjectId={currentProject?.id}
        expandedProjectId={expandedProjectId}
        onProjectClick={handleToggleProject}
        isLoading={isLoading}
        emptyStateMessage="No projects yet. Create one to get started!"
        headerAction={
          <IconButton 
            size="small" onClick={() => setCreateModalOpen(true)}
            sx={{ color: colors.primary, bgcolor: 'rgba(0, 170, 185, 0.1)', '&:hover': { bgcolor: 'rgba(0, 170, 185, 0.2)' } }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        }
        renderProjectActions={(projectId) => 
          addContributorEnabled && (
            <IconButton 
              className="project-action-icon" size="small" 
              onClick={(e) => handleOpenContributorModal(e, projectId)}
              sx={{ opacity: 0, transition: 'opacity 0.2s', color: colors.textSecondary, '&:hover': { color: colors.primary } }}
            >
              <PersonAddIcon fontSize="small" sx={{ width: 16, height: 16 }} />
            </IconButton>
          )
        }
        renderNestedItems={(projectId) => {
          const isExpanded = expandedProjectId === projectId;
          const isLoadedProject = currentProject?.id === projectId;
          return (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding sx={{ pl: 4, pr: 1, pb: 1 }}>
                {isLoading && !isLoadedProject ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={20} sx={{ color: colors.primary }} />
                  </Box>
                ) : activeFiles.length === 0 ? (
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontStyle: 'italic', display: 'block', p: 1 }}>No documents found</Typography>
                ) : (
                  (activeFiles as ProjectDocument[]).map((file) => {
                    const isActive = currentFileId === file.id;
                    const displayName = file.name?.length > 25 ? `${file.name.substring(0, 15)}...${file.name.slice(-7)}` : file.name;
                    return (
                      <ListItemButton
                        key={file.id} onClick={() => onSelectFile(file.id)} selected={isActive}
                        sx={{ borderRadius: 1, mb: 0.5, py: 0.5, '&.Mui-selected': { bgcolor: 'rgba(0, 170, 185, 0.15)', borderLeft: `3px solid ${colors.primary}` } }}
                      >
                        <ListItemIcon sx={{ minWidth: 28, color: isActive ? colors.primary : colors.textSecondary }}><InsertDriveFileIcon sx={{ fontSize: 16 }} /></ListItemIcon>
                        <ListItemText primary={displayName} primaryTypographyProps={{ variant: 'caption', color: isActive ? 'white' : colors.textSecondary, fontWeight: isActive ? 600 : 400 }} />
                      </ListItemButton>
                    );
                  })
                )}
              </List>
            </Collapse>
          );
        }}
      />

      {/* 1. Create Project Modal */}
      <Dialog 
        open={isCreateModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        disableEnforceFocus // Allows the nested modal to take focus safely
        PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}`, minWidth: 400 } }}
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {createProjectError && <Alert severity="error">{createProjectError}</Alert>}

          <TextField 
            autoFocus 
            label="Project Title" 
            fullWidth 
            variant="outlined" 
            value={newProjectTitle} 
            onChange={(e) => setNewProjectTitle(e.target.value)} 
            sx={{ mt: 1, input: { color: 'white' }, label: { color: colors.textSecondary } }} 
          />

          {/* Customer Dropdown + Add Button side-by-side (bypasses MUI focus bugs) */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel id="customer-label" sx={{ color: colors.textSecondary }}>Customer</InputLabel>
              <Select
                labelId="customer-label"
                value={selectedCustomerId}
                label="Customer"
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                sx={{
                  color: 'white',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.primary },
                  '.MuiSvgIcon-root': { color: colors.textSecondary }
                }}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.alias_name} {customer.name ? `(${customer.name})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button 
              variant="outlined" 
              onClick={() => setIsNewCustomerModalOpen(true)}
              sx={{ 
                minWidth: 'auto', width: 56, height: 56,
                borderColor: colors.border, color: colors.primary,
                '&:hover': { borderColor: colors.primary, bgcolor: 'rgba(0, 170, 185, 0.1)' }
              }}
              title="Create New Customer"
            >
              <AddIcon />
            </Button>
          </Box>


          <TextField 
            label="Description (Optional)" 
            fullWidth 
            multiline 
            rows={3} 
            variant="outlined" 
            value={newProjectDesc} 
            onChange={(e) => setNewProjectDesc(e.target.value)} 
            sx={{ input: { color: 'white' }, textarea: { color: 'white' }, label: { color: colors.textSecondary } }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateModalOpen(false)} sx={{ color: colors.textSecondary }}>Cancel</Button>
          <Button onClick={handleCreateProject} disabled={isLoading || !newProjectTitle.trim() || !selectedCustomerId} variant="contained" sx={{ bgcolor: colors.primary }}>
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2. Create New Customer Modal */}
      <Dialog 
        open={isNewCustomerModalOpen} 
        onClose={() => !isCreatingCustomer && setIsNewCustomerModalOpen(false)}
        PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}`, minWidth: 350 } }}
      >
        <DialogTitle>Create New Customer</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {customerModalError && <Alert severity="error">{customerModalError}</Alert>}
          <TextField
            fullWidth label="Alias Name (Required)" value={newCustomerAlias} onChange={(e) => setNewCustomerAlias(e.target.value)}
            autoFocus sx={{ mt: 1, input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />
          <TextField
            fullWidth label="Full Name (Optional)" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
            sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsNewCustomerModalOpen(false)} disabled={isCreatingCustomer} sx={{ color: colors.textSecondary }}>Cancel</Button>
          <Button 
            onClick={handleCreateNewCustomer} disabled={!newCustomerAlias.trim() || isCreatingCustomer} 
            variant="contained" sx={{ bgcolor: colors.primary }}
          >
            {isCreatingCustomer ? <CircularProgress size={24} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Contributor Modal */}
      <Dialog open={isContributorModalOpen} onClose={() => setContributorModalOpen(false)} PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}` } }}>
        <DialogTitle>Add Contributor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>Enter the username or email of the person you want to add to this project.</Typography>
          <TextField autoFocus margin="dense" label="Username" fullWidth variant="outlined" value={contributorUsername} onChange={(e) => setContributorUsername(e.target.value)} sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setContributorModalOpen(false)} sx={{ color: colors.textSecondary }}>Cancel</Button>
          <Button onClick={handleAddContributor} disabled={isLoading || !contributorUsername.trim()} variant="contained" sx={{ bgcolor: colors.primary }}>
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export const MemoizedSidebar = React.memo(Sidebar);