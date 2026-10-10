import React from 'react';
import { 
  Box, Typography, List, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';
import { Folder as FolderIcon, FolderOpen as FolderOpenIcon } from '@mui/icons-material';

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
    <Box sx={{ height: '100%', width: '100%', bgcolor: 'surface.panel', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: topContent ? 'none' : '1px solid', borderColor: 'border.subtle' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          {title}
        </Typography>
        {headerAction}
      </Box>

      {/* Top Content (Filters, Search, Clear Selection) */}
      {topContent && (
        <Box sx={{ px: 2, pb: 2, borderBottom: '1px solid', borderColor: 'border.subtle' }}>
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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 0.5 }}>
                <ListItemButton
                  onClick={() => onProjectClick(project.id)}
                  selected={isSelected && !expandedProjectId} // Admin style selection
                  sx={{
                    borderRadius: 1, 
                    flex: 1,
                    minWidth: 0,
                    bgcolor: isSelected ? 'accent.tint' : 'transparent',
                    '&:hover .project-action-icon': { opacity: 1 }, 
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isExpanded || isSelected ? 'accent.text' : 'text.secondary' }}>
                    {isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
                  </ListItemIcon>
                  
                  <ListItemText 
                    primary={project.primaryText} 
                    secondary={project.secondaryText}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      color: isSelected ? 'text.primary' : 'text.secondary',
                      fontWeight: isSelected ? 600 : 400,
                      noWrap: true
                    }} 
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  
                </ListItemButton>
                {renderProjectActions && renderProjectActions(project.id)}
                </Box>

                {/* Nested Items (e.g. Documents) */}
                {renderNestedItems && renderNestedItems(project.id)}
              </React.Fragment>
            );
          })}
        </List>
        
        {projects.length === 0 && !isLoading && (
           <Box sx={{ p: 2, color: 'text.secondary', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
             {emptyStateMessage}
           </Box>
        )}
      </Box>
    </Box>
  );
};