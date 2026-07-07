'use client';

import React, { useState } from 'react';
import { Box, ThemeProvider, CssBaseline, IconButton, ToggleButtonGroup, ToggleButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FeedbackIcon from '@mui/icons-material/Feedback';

import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { useAdminData } from '@/hooks/AdminData';
import { AdminSidebar } from '@/components/ProjectsSideBar/AdminSideBar';
import { LayoutHeader } from '@/components/Headers/LayoutHeader'; 
import { SettingsModal } from '@/components/SettingsModal';

import GlobalOverview from './components/GlobalOverview';
import ProjectSummary from './components/ProjectSummary';
import FeedbackArea from './components/FeedbackArea'; // Import the new component

export default function AdminPage() {
  const adminData = useAdminData();
  const {
    filteredProjects,
    selectedProjectId,
    setSelectedProjectId,
    isExpanded,
    setIsExpanded,
    searchQuery,
    setSearchQuery,
    selectedUser,
    setSelectedUser,
    dateFilter,
    setDateFilter,
    users,
    dashboardData,
    feedbacks // Pulling feedbacks from your hook
  } = adminData;

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // State to toggle between views
  const [activeTab, setActiveTab] = useState<'projects' | 'feedback'>('projects');

  const handleTabChange = (event: React.MouseEvent<HTMLElement>, newTab: 'projects' | 'feedback' | null) => {
    if (newTab !== null) {
      setActiveTab(newTab);
      // Optional: clear selected project when switching to feedback
      if (newTab === 'feedback') setSelectedProjectId(null); 
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', bgcolor: colors.background }}>
        
        <LayoutHeader 
          title="Admin" 
          settingsIcon={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Added a toggle to switch between views cleanly */}
              <ToggleButtonGroup
                value={activeTab}
                exclusive
                onChange={handleTabChange}
                size="small"
                sx={{ bgcolor: colors.surface }}
              >
                <ToggleButton value="projects" aria-label="projects view">
                  <AssignmentIcon fontSize="small" sx={{ mr: 1 }} />
                  Projects
                </ToggleButton>
                <ToggleButton value="feedback" aria-label="feedback view">
                  <FeedbackIcon fontSize="small" sx={{ mr: 1 }} />
                  Feedback
                </ToggleButton>
              </ToggleButtonGroup>

              <IconButton edge="end" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </Box>
          } 
        />

        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Only show the sidebar if we are in the 'projects' view */}
          {activeTab === 'projects' && (
            <Box sx={{ 
              width: isExpanded ? '100%' : 350, 
              flexShrink: 0,
              transition: 'width 0.3s ease', 
              borderRight: isExpanded ? 'none' : `1px solid ${colors.border}`, 
              bgcolor: colors.surface, 
              display: 'flex', flexDirection: 'column', zIndex: 10 
            }}>
              <AdminSidebar 
                projects={filteredProjects}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                isExpanded={isExpanded}
                setIsExpanded={setIsExpanded}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                users={users}
              />
            </Box>
          )}

          {!isExpanded && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflow: 'hidden' }}>
              {activeTab === 'feedback' ? (
                <FeedbackArea feedbacks={feedbacks} />
              ) : (
                selectedProjectId ? (
                  <ProjectSummary 
                    projectId={selectedProjectId} 
                    onBack={() => setSelectedProjectId(null)} 
                  />
                ) : (
                  <GlobalOverview dashboardData={dashboardData} />
                )
              )}
            </Box>
          )}

        </Box>
        <SettingsModal 
          open={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </Box>
    </ThemeProvider>
  );
}