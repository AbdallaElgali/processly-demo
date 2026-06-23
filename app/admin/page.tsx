'use client';

import React, { useState } from 'react';
import { Box, ThemeProvider, CssBaseline, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { useAdminData } from '@/hooks/AdminData';
import { AdminSidebar } from '@/components/ProjectsSideBar/AdminSideBar';
import { LayoutHeader } from '@/components/Headers/LayoutHeader'; 
import { SettingsModal } from '@/components/SettingsModal';

import GlobalOverview from './components/GlobalOverview';
import ProjectSummary from './components/ProjectSummary';

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
    dashboardData
  } = adminData;

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', bgcolor: colors.background }}>
        
        <LayoutHeader 
          title="Admin" 
          settingsIcon={
            <IconButton edge="end" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          } 
        />

        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
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

          {!isExpanded && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflow: 'hidden' }}>
              {selectedProjectId ? (
                <ProjectSummary 
                  projectId={selectedProjectId} 
                  onBack={() => setSelectedProjectId(null)} 
                />
              ) : (
                <GlobalOverview dashboardData={dashboardData} />
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