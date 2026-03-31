import React, { useState } from 'react';
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
  CircularProgress
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

  // --- UI State ---
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  
  // Add Contributor Modal State
  const [isContributorModalOpen, setContributorModalOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [contributorUsername, setContributorUsername] = useState('');

  // Create Project Modal State
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // --- Handlers ---
  const handleToggleProject = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null); // Close if already open
    } else {
      setExpandedProjectId(projectId);
      // Load details to fetch the nested documents if not already loaded
      if (currentProject?.id !== projectId) {
        await loadProjectDetails(projectId);
      }
    }
  };

  const handleOpenContributorModal = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent accordion from toggling
    setTargetProjectId(projectId);
    setContributorUsername('');
    setContributorModalOpen(true);
  };

  const handleAddContributor = async () => {
    if (!targetProjectId || !contributorUsername.trim()) return;
    try {
      await addContributor(targetProjectId, contributorUsername.trim());
      setContributorModalOpen(false);
    } catch (error) {
      console.error("Failed to add contributor:", error);
      // You could map this to a toast/snackbar in the future
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    try {
      const newProject = await createNewProject({
        alias_id: newProjectTitle.trim(),
        description: newProjectDesc.trim()
      });
      setCreateModalOpen(false);
      setNewProjectTitle('');
      setNewProjectDesc('');
      
      // Optionally auto-expand the newly created project
      if (newProject?.id) {
        setExpandedProjectId(newProject.id);
        await loadProjectDetails(newProject.id);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  // Assume the API returns an array of files/documents on the detailed project object. 
  // Adjust 'files' to 'documents' if your backend schema uses a different key.
  const activeFiles = currentProject?.files || currentProject?.documents || [];

  return (
    <Box sx={{ height: '100%', width: '100%', bgcolor: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
      
      {/* Sidebar Header & Create Action */}
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

      {/* Projects List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
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
                    bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    '&:hover .add-icon': { opacity: 1 }, // Show add icon on hover
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isExpanded ? colors.primary : colors.textSecondary }}>
                    {isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
                  </ListItemIcon>
                  
                  <ListItemText 
                    primary={project.alias_id || project.name || 'Untitled Project'} 
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      color: isExpanded ? 'white' : colors.textSecondary,
                      fontWeight: isExpanded ? 600 : 400,
                      noWrap: true
                    }} 
                  />
                  
                  {/* Add Contributor Button */}
                  <IconButton 
                    title='Add Auditor'
                    className="add-icon"
                    size="small" 
                    onClick={(e) => handleOpenContributorModal(e, project.id)}
                    sx={{ 
                      opacity: 0, // Hidden by default, shown on hover via CSS above
                      transition: 'opacity 0.2s',
                      color: colors.textSecondary,
                      '&:hover': { color: colors.primary } 
                    }}
                  >
                    <PersonAddIcon fontSize="small" sx={{ width: 16, height: 16 }} />
                  </IconButton>
                </ListItemButton>

                {/* Nested Documents List */}
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
                      activeFiles.map((file: any) => {
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
      
      {/* Create Project Modal */}
      <Dialog open={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} PaperProps={{ sx: { bgcolor: colors.surface, color: 'white', border: `1px solid ${colors.border}` } }}>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Title"
            fullWidth
            variant="outlined"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            sx={{ mb: 2, input: { color: 'white' }, label: { color: colors.textSecondary } }}
          />
          <TextField
            margin="dense"
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
          <Button onClick={handleCreateProject} disabled={isLoading || !newProjectTitle.trim()} variant="contained" sx={{ bgcolor: colors.primary }}>
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create'}
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