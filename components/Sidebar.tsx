import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  Collapse,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  InsertDriveFile as InsertDriveFileIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  PersonAdd as PersonAddIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { colors } from '@/theme/colors';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectDocument } from '@/api/projects';
import { useCustomers } from '@/hooks/Customers';

interface SidebarProps {
  currentFileId: string | null;
  onSelectFile: (id: string) => void;
}

export const Sidebar = ({ currentFileId, onSelectFile }: SidebarProps) => {
  const { 
    projects, 
    currentProject, 
    loadProjectDetails, 
    addContributor, 
    createNewProject,
    isLoading 
  } = useProject();

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  
  const [isContributorModalOpen, setContributorModalOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [contributorUsername, setContributorUsername] = useState('');

  const { customers, loadCustomers, createNewCustomer } = useCustomers();

  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerAlias, setNewCustomerAlias] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerModalError, setCustomerModalError] = useState<string | null>(null);

  const [addContributorEnabled, setAddContributorEnabled] = useState(false);
  
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleToggleProject = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
    } else {
      setExpandedProjectId(projectId);
      if (currentProject?.id !== projectId) {
        await loadProjectDetails(projectId);
      }
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
    } catch (error: unknown) {
      console.error("Failed to add contributor:", error);
    }
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
        template_id: selectedTemplateId || null, 
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
    } catch (error: unknown) {
      setCreateProjectError(error instanceof Error ? error.message : 'Failed to create project.');
      console.error("Failed to create project:", error);
    }
  };

  const handleCreateNewCustomer = async () => {
    if (!newCustomerAlias.trim()) return;
    setCustomerModalError(null);
    setIsCreatingCustomer(true);
    
    try {
      const newlyCreated = await createNewCustomer(newCustomerAlias.trim(), newCustomerName.trim());
      
      if (newlyCreated) {
        setSelectedCustomerId(newlyCreated.id);
      }
      
      setNewCustomerAlias('');
      setNewCustomerName('');
      setIsNewCustomerModalOpen(false);
    } catch (err: unknown) {
      setCustomerModalError(err instanceof Error ? err.message : 'Failed to create customer.');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const activeFiles = currentProject?.documents || [];

  return (
    <Box sx={{ height: '100%', width: '100%', bgcolor: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
      
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="overline" sx={{ color: colors.textSecondary, letterSpacing: 1 }}>
          Projects
        </Typography>
        <IconButton 
          size="small" 
          onClick={() => setCreateModalOpen(true)}
          sx={{ color: colors.primary, bgcolor: 'rgba(0, 170, 185, 0.1)', '&:hover': { bgcolor: 'rgba(0, 170, 185, 0.2)' } }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        {/* ... (Projects List map remains exactly the same) ... */}
        <List sx={{ px: 1 }}>
          {projects.map((project) => {
            const isExpanded = expandedProjectId === project.id;
            const isLoadedProject = currentProject?.id === project.id;
            
            return (
              <React.Fragment key={project.id}>
                <ListItemButton
                  onClick={() => handleToggleProject(project.id)}
                  sx={{
                    borderRadius: 1, 
                    mb: 0.5,
                    bgcolor: isLoadedProject ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    '&:hover .add-icon': { opacity: 1 },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isExpanded ? colors.primary : colors.textSecondary }}>
                    {isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
                  </ListItemIcon>
                  
                  <ListItemText 
                    primary={project.alias_id || project.name || 'Untitled Project'} 
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      color: isLoadedProject ? 'white' : colors.textSecondary,
                      fontWeight: isLoadedProject ? 600 : 400,
                      noWrap: true
                    }} 
                  />
                  
                  {addContributorEnabled && (<IconButton 
                    title='Add Auditor'
                    className="add-icon"
                    size="small" 
                    onClick={(e) => handleOpenContributorModal(e, project.id)}
                    sx={{ 
                      opacity: 0, 
                      transition: 'opacity 0.2s',
                      color: colors.textSecondary,
                      '&:hover': { color: colors.primary } 
                    }}
                  >
                    <PersonAddIcon fontSize="small" sx={{ width: 16, height: 16 }} />
                  </IconButton>)}
                </ListItemButton>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 4, pr: 1, pb: 1 }}>
                    {isLoading && !isLoadedProject ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress size={20} sx={{ color: colors.primary }} />
                      </Box>
                    ) : activeFiles.length === 0 ? (
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontStyle: 'italic', display: 'block', p: 1 }}>
                        No documents found
                      </Typography>
                    ) : (
                      (activeFiles as ProjectDocument[]).map((file) => {
                        const isActive = currentFileId === file.id;
                        const displayName = file.name?.length > 25 
                          ? `${file.name.substring(0, 15)}...${file.name.slice(-7)}` 
                          : file.name;

                        return (
                          <ListItemButton
                            key={file.id}
                            onClick={() => onSelectFile(file.id)}
                            selected={isActive}
                            sx={{
                              borderRadius: 1, 
                              mb: 0.5,
                              py: 0.5,
                              '&.Mui-selected': {
                                bgcolor: 'rgba(0, 170, 185, 0.15)',
                                borderLeft: `3px solid ${colors.primary}`,
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 28, color: isActive ? colors.primary : colors.textSecondary }}>
                              <InsertDriveFileIcon sx={{ fontSize: 16 }} />
                            </ListItemIcon>
                            <ListItemText 
                              primary={displayName} 
                              primaryTypographyProps={{ 
                                variant: 'caption', 
                                color: isActive ? 'white' : colors.textSecondary,
                                fontWeight: isActive ? 600 : 400
                              }} 
                            />
                          </ListItemButton>
                        );
                      })
                    )}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          })}
        </List>
        
        {projects.length === 0 && !isLoading && (
           <Box sx={{ p: 2, color: colors.textSecondary, fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
             No projects yet. Create one to get started!
           </Box>
        )}
      </Box>

      {/* --- Modals --- */}
      
      {/* 1. PRIMARY DIALOG: Create Project */}
      <Dialog 
        open={isCreateModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        disableEnforceFocus // Stops it from stealing focus back from the customer modal
        disableRestoreFocus // Prevents focus bounce
        style={{ zIndex: 1300 }}
        PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}`, minWidth: '400px' } }}
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          
          {createProjectError && (
            <Alert severity="error" sx={{ mb: 1 }}>{createProjectError}</Alert>
          )}

          <TextField
            autoFocus
            label="Project Title"
            fullWidth
            variant="outlined"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />

          {/* FIX: We grouped the Select and a dedicated '+' button side-by-side */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel id="customer-select-label" sx={{ color: colors.textSecondary }}>Customer</InputLabel>
              <Select
                labelId="customer-select-label"
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
            
            {/* This button handles the modal opening safely without MUI Select interference */}
            <Button 
              variant="outlined" 
              onClick={() => setIsNewCustomerModalOpen(true)}
              sx={{ 
                minWidth: 'auto', 
                width: 56, 
                height: 56, // Matches the height of the Select input
                borderColor: colors.border, 
                color: colors.primary,
                '&:hover': { borderColor: colors.primary, bgcolor: 'rgba(0, 170, 185, 0.1)' }
              }}
              title="Create New Customer"
            >
              <AddIcon />
            </Button>
          </Box>

          <FormControl fullWidth>
            <InputLabel id="template-select-label" sx={{ color: colors.textSecondary }}>Template (Optional)</InputLabel>
            <Select
              labelId="template-select-label"
              value={selectedTemplateId}
              label="Template (Optional)"
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              sx={{
                color: 'white',
                '.MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.primary },
                '.MuiSvgIcon-root': { color: colors.textSecondary }
              }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              <MenuItem value="template_1">Standard Audit Template</MenuItem>
              <MenuItem value="template_2">Deep Dive Template</MenuItem>
            </Select>
          </FormControl>
          
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
          <Button 
            onClick={handleCreateProject} 
            disabled={isLoading || !newProjectTitle.trim() || !selectedCustomerId} 
            variant="contained" 
            sx={{ bgcolor: colors.primary, '&.Mui-disabled': { bgcolor: 'rgba(0,170,185,0.3)' } }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2. NESTED DIALOG: Create New Customer */}
      <Dialog 
        open={isNewCustomerModalOpen} 
        onClose={() => !isCreatingCustomer && setIsNewCustomerModalOpen(false)}
        disableEnforceFocus
        // Brute-force the Z-index so it renders on top of the first dialog's backdrop
        style={{ zIndex: 99999 }} 
        PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}`, minWidth: '350px' } }}
      >
        <DialogTitle>Create New Customer</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {customerModalError && (
            <Alert severity="error" sx={{ mb: 1 }}>{customerModalError}</Alert>
          )}
          <TextField
            fullWidth
            label="Alias Name (Required)"
            value={newCustomerAlias}
            onChange={(e) => setNewCustomerAlias(e.target.value)}
            autoFocus
            sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />
          <TextField
            fullWidth
            label="Full Name (Optional)"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setIsNewCustomerModalOpen(false)} 
            disabled={isCreatingCustomer}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateNewCustomer} 
            disabled={!newCustomerAlias.trim() || isCreatingCustomer}
            variant="contained" 
            sx={{ bgcolor: colors.primary, '&.Mui-disabled': { bgcolor: 'rgba(0,170,185,0.3)' } }}
          >
            {isCreatingCustomer ? <CircularProgress size={24} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Contributor Modal */}
      <Dialog open={isContributorModalOpen} onClose={() => setContributorModalOpen(false)} PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}` } }}>
        <DialogTitle>Add Contributor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
            Enter the username or email of the person you want to add to this project.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            variant="outlined"
            value={contributorUsername}
            onChange={(e) => setContributorUsername(e.target.value)}
            sx={{ input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setContributorModalOpen(false)} sx={{ color: colors.textSecondary }}>Cancel</Button>
          <Button onClick={handleAddContributor} disabled={isLoading || !contributorUsername.trim()} variant="contained" sx={{ bgcolor: colors.primary }}>
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export const MemoizedSidebar = React.memo(Sidebar);