'use client';

import React, { useState } from 'react';
import { 
  Box, ThemeProvider, CssBaseline, Typography, IconButton, Card, CardContent 
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';

import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { useAdminData } from '@/hooks/AdminData';
import { AdminSidebar } from '@/components/ProjectsSideBar/AdminSideBar';
import { LayoutHeader } from '@/components/Headers/LayoutHeader'; // adjust path as needed
import { SettingsModal } from '@/components/SettingsModal';

export default function AdminPage() {
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
  } = useAdminData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', bgcolor: colors.background }}>
        
        {/* HEADER */}
        <LayoutHeader 
          title="Admin" 
          settingsIcon={
            <IconButton edge="end" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          } 
        />

        {/* MAIN CONTENT AREA */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* SIDEBAR (Projects Area) */}
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

          {/* DASHBOARD AREA (Strict fit-to-screen flexbox) */}
          {!isExpanded && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflow: 'hidden' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, flexShrink: 0 }}>
                {selectedProjectId ? 'Project Details' : 'Global Overview'}
              </Typography>

              {dashboardData && (
                <Box sx={{ flex: 1, display: 'flex', gap: 3, minHeight: 0 }}>
                  
                  {/* LEFT COLUMN: CHARTS */}
                  <Box sx={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    
                    {/* Line Chart */}
                    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', elevation: 0, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ flexShrink: 0 }}>
                          Historical F1 Score
                        </Typography>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
                              <XAxis dataKey="name" fontSize={12} tickMargin={10} tick={{ fill: colors.textSecondary }} />
                              <YAxis domain={[0, 1]} fontSize={12} tick={{ fill: colors.textSecondary }} />
                              <RechartsTooltip contentStyle={{ borderRadius: 8, borderColor: colors.border }} />
                              <Line type="monotone" dataKey="f1Score" stroke={colors.primary} strokeWidth={3} dot={{ r: 4, fill: colors.primary }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Bar Chart */}
                    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', elevation: 0, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ flexShrink: 0 }}>
                          Total vs AI Extracted Parameters
                        </Typography>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
                              <XAxis dataKey="name" fontSize={12} tickMargin={10} tick={{ fill: colors.textSecondary }} />
                              <YAxis fontSize={12} tick={{ fill: colors.textSecondary }} />
                              <RechartsTooltip contentStyle={{ borderRadius: 8, borderColor: colors.border }} />
                              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                              <Bar dataKey="totalParams" name="Total Parameters" fill="#2196f3" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="aiParams" name="AI Extracted" fill="#ff9800" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </CardContent>
                    </Card>

                  </Box>

                  {/* RIGHT COLUMN: VERTICAL INSIGHTS */}
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 260 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: -1 }}>Key Insights</Typography>
                    
                    <Card sx={{ bgcolor: colors.surface, elevation: 0, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
                      <CardContent>
                        <Typography color="text.secondary" variant="subtitle2" gutterBottom>Average F1 Score</Typography>
                        <Typography variant="h4" fontWeight="bold" color="primary">{dashboardData.insights.avgF1}</Typography>
                      </CardContent>
                    </Card>

                    <Card sx={{ bgcolor: colors.surface, elevation: 0, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
                      <CardContent>
                        <Typography color="text.secondary" variant="subtitle2" gutterBottom>Average Acceptance Rate</Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: '#4caf50' }}>{dashboardData.insights.avgAcceptanceRate}%</Typography>
                      </CardContent>
                    </Card>

                    <Card sx={{ bgcolor: colors.surface, elevation: 0, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
                      <CardContent>
                        <Typography color="text.secondary" variant="subtitle2" gutterBottom>AI Assisted Workload</Typography>
                        <Typography variant="h4" fontWeight="bold">
                          {dashboardData.insights.totalAssistedProjects} <Typography component="span" variant="body2" color="text.secondary">Projects</Typography>
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {dashboardData.insights.totalAiParams} total parameters extracted
                        </Typography>
                      </CardContent>
                    </Card>

                  </Box>

                </Box>
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