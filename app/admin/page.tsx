'use client';

import React, { useState } from 'react';
import { Box, Chip, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FeedbackIcon from '@mui/icons-material/Feedback';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { useAdminData } from '@/hooks/AdminData';
import { AdminSidebar } from '@/components/ProjectsSideBar/AdminSideBar';
import { AppHeader } from '@/components/shell/AppHeader';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', bgcolor: 'surface.canvas' }}>
        
        {/* The shell header, with the admin view switcher in the breadcrumb
            slot. Labelled unauthenticated per A2: /auth has no password or
            token, so the UI must not imply permissions are enforced. */}
        <AppHeader
          breadcrumb={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Admin &middot; no authentication
              </Typography>
              <Chip size="small" icon={<LockOutlinedIcon />} label="Anyone can open this page" sx={{ bgcolor: 'status.warningBg', color: 'status.warning', '& .MuiChip-icon': { color: 'inherit' } }} />
              <ToggleButtonGroup
                value={activeTab}
                exclusive
                onChange={handleTabChange}
                size="small"
                sx={{ bgcolor: 'surface.panel' }}
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
              borderRight: isExpanded ? 'none' : '1px solid',
              borderColor: 'border.subtle', 
              bgcolor: 'surface.panel',
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
    </Box>
  );
}