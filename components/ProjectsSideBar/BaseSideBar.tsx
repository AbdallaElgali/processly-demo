import React from 'react';
import { 
  Box, Typography, List, ListItemButton, ListItemIcon, ListItemText, CircularProgress
} from '@mui/material';
import { Folder as FolderIcon, FolderOpen as FolderOpenIcon } from '@mui/icons-material';
import { colors } from '@/theme/colors';

export interface BaseSidebarProject {
  id: string;
  primaryText: string;
  secondaryText?: string;
}

interface BaseSidebarProps {
  title?: string;
  headerAction?: React.ReactNode;
  topContent?: React.ReactNode; // For filters, search bars, etc.
  projects: BaseSidebarProject[];
  selectedProjectId?: string | null;
  expandedProjectId?: string | null;
  onProjectClick: (id: string) => void;
  renderProjectActions?: (id: string) => React.ReactNode; // E.g., Add contributor button
  renderNestedItems?: (id: string) => React.ReactNode; // E.g., Document list
  emptyStateMessage?: React.ReactNode;
  isLoading?: boolean;
}

export const BaseSidebar = ({
  title = "Projects",
  headerAction,
  topContent,
  projects,
  selectedProjectId,
  expandedProjectId,
  onProjectClick,
  renderProjectActions,
  renderNestedItems,
  emptyStateMessage = "No projects found.",
  isLoading = false
}: BaseSidebarProps) => {
  return (
    <Box sx={{ height: '100%', width: '100%', bgcolor: colors.surface, display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: topContent ? 'none' : `1px solid ${colors.border}` }}>
        <Typography variant="overline" sx={{ color: colors.textSecondary, letterSpacing: 1 }}>
          {title}
        </Typography>
        {headerAction}
      </Box>

      {/* Top Content (Filters, Search, Clear Selection) */}
      {topContent && (
        <Box sx={{ px: 2, pb: 2, borderBottom: `1px solid ${colors.border}` }}>
          {topContent}
        </Box>
      )}

      {/* Projects List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        <List sx={{ px: 1 }}>
          {projects.map((project) => {
            const isExpanded = expandedProjectId === project.id;
            const isSelected = selectedProjectId === project.id;
            
            return (
              <React.Fragment key={project.id}>
                <ListItemButton
                  onClick={() => onProjectClick(project.id)}
                  selected={isSelected && !expandedProjectId} // Admin style selection
                  sx={{
                    borderRadius: 1, 
                    mb: 0.5,
                    bgcolor: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    '&:hover .project-action-icon': { opacity: 1 }, 
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isExpanded || isSelected ? colors.primary : colors.textSecondary }}>
                    {isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
                  </ListItemIcon>
                  
                  <ListItemText 
                    primary={project.primaryText} 
                    secondary={project.secondaryText}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      color: isSelected ? 'white' : colors.textSecondary,
                      fontWeight: isSelected ? 600 : 400,
                      noWrap: true
                    }} 
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  
                  {renderProjectActions && renderProjectActions(project.id)}
                </ListItemButton>

                {/* Nested Items (e.g. Documents) */}
                {renderNestedItems && renderNestedItems(project.id)}
              </React.Fragment>
            );
          })}
        </List>
        
        {projects.length === 0 && !isLoading && (
           <Box sx={{ p: 2, color: colors.textSecondary, fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
             {emptyStateMessage}
           </Box>
        )}
      </Box>
    </Box>
  );
};