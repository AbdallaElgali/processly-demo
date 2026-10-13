import React from 'react';
import { 
  Box, Tooltip, IconButton, TextField, 
  FormControl, InputLabel, Select, MenuItem, Button
} from '@mui/material';
import { 
  Search as SearchIcon, OpenInFull as OpenInFullIcon, 
  CloseFullscreen as CloseFullscreenIcon, Clear as ClearIcon, FactCheckOutlined as AuditIcon 
} from '@mui/icons-material';
import Link from 'next/link';
import { BaseSidebar } from './BaseSideBar';
import type { ProjectMetrics } from '@/types/audit';

// Props passed down from the AdminPage's useAdminData hook
interface AdminSidebarProps {
  projects: ProjectMetrics[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedUser: string;
  setSelectedUser: (user: string) => void;
  dateFilter: string;
  setDateFilter: (date: string) => void;
  users: string[];
}

export const AdminSidebar = ({
  projects, selectedProjectId, setSelectedProjectId,
  isExpanded, setIsExpanded, searchQuery, setSearchQuery,
  selectedUser, setSelectedUser, dateFilter, setDateFilter, users
}: AdminSidebarProps) => {

  // `p.users` is the real field on ProjectMetrics; the previous code read a
  // non-existent `p.user`, which rendered the literal string "undefined".
  const formattedProjects = projects.map(p => ({
    id: p.id,
    primaryText: p.name,
    secondaryText: [p.users?.map(u => u?.username).filter(Boolean).join(', '), p.date]
      .filter(Boolean)
      .join(' | ')
  }));

  const handleProjectClick = (id: string) => {
    setSelectedProjectId(id);
    if (isExpanded) setIsExpanded(false); // Auto-collapse on selection
  };

  return (
    <BaseSidebar
      title="Projects"
      projects={formattedProjects}
      selectedProjectId={selectedProjectId}
      onProjectClick={handleProjectClick}
      emptyStateMessage="No projects match your filters."
      renderProjectActions={(id) => (
        <Tooltip title="Open this project's Audit">
          <IconButton component={Link} href={`/projects/${id}/audit`} size="small" aria-label="Open this project's Audit">
            <AuditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      headerAction={
        <Tooltip title={isExpanded ? "Collapse" : "Expand Fullscreen"}>
          <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      }
      topContent={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField 
            size="small" fullWidth placeholder="Search projects..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} /> } }}
          />

          {isExpanded && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>User</InputLabel>
                <Select 
                  value={selectedUser} label="User" 
                  onChange={(e) => setSelectedUser(e.target.value)}
                  MenuProps={{ PaperProps: { style: { maxHeight: 200 } } }}
                >
                  {users.map(user => (
                    <MenuItem key={user} value={user}>{user}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField 
                sx={{ flex: 1 }} type="date" size="small" 
                value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}

          {selectedProjectId && !isExpanded && (
             <Button 
               size="small" color="error" startIcon={<ClearIcon />}
               onClick={() => setSelectedProjectId(null)}
               sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
             >
               Clear Selection (View All)
             </Button>
          )}
        </Box>
      }
    />
  );
};