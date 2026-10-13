import React from 'react';
import { Box, Typography, Card, CardContent, useTheme } from '@mui/material';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardData } from '@/types/audit'; // Adjust path as needed

interface GlobalOverviewProps {
  dashboardData: DashboardData | null | undefined;
}

const GlobalOverview: React.FC<GlobalOverviewProps> = ({ dashboardData }) => {
  const theme = useTheme();
  if (!dashboardData) return null;
  const v = theme.vars.palette;
  const grid = v.border.subtle;
  const axis = v.text.secondary;

  // Placeholder for feedback state (currently empty as requested)
  const feedback = "";

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, flexShrink: 0 }}>
        Global Overview
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        
        {/* 1. HORIZONTAL GRAPHS SECTION */}
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, flex: 1, minHeight: 300 }}>
          
          {/* Line Chart */}
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'surface.panel', border: '1px solid', borderColor: 'border.subtle', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ flexShrink: 0 }}>
                Historical F1 Score
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 260 }}>
                  <LineChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                    <XAxis dataKey="name" fontSize={12} tickMargin={10} tick={{ fill: axis }} />
                    <YAxis domain={[0, 1]} fontSize={12} tick={{ fill: axis }} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, borderColor: grid, background: v.surface.raised, color: v.text.primary }} />
                    <Line type="monotone" dataKey="f1Score" stroke={v.accent.text} strokeWidth={3} dot={{ r: 4, fill: v.accent.text }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'surface.panel', border: '1px solid', borderColor: 'border.subtle', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ flexShrink: 0 }}>
                Total vs AI Extracted Parameters
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 260 }}>
                  <BarChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                    <XAxis dataKey="name" fontSize={12} tickMargin={10} tick={{ fill: axis }} />
                    <YAxis fontSize={12} tick={{ fill: axis }} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, borderColor: grid, background: v.surface.raised, color: v.text.primary }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                    <Bar dataKey="totalParams" name="Total Parameters" fill={v.status.info} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="aiParams" name="AI Extracted" fill={v.status.warning} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

        </Box>

        {/* 2. HORIZONTAL INSIGHTS SECTION (Under the graphs) */}
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, flexShrink: 0 }}>
          
          <Card sx={{ flex: 1, bgcolor: 'status.infoBg', border: '1px solid', borderColor: 'border.subtle', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: 'status.info' }} fontWeight="bold" textTransform="uppercase">Average F1 Score</Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'text.primary' }}>{dashboardData.insights.avgF1}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, bgcolor: 'status.successBg', border: '1px solid', borderColor: 'border.subtle', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: 'status.success' }} fontWeight="bold" textTransform="uppercase">Average Acceptance Rate</Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'text.primary' }}>{dashboardData.insights.avgAcceptanceRate}%</Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, bgcolor: 'status.warningBg', border: '1px solid', borderColor: 'border.subtle', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: 'status.warning' }} fontWeight="bold" textTransform="uppercase">AI Assisted Workload</Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'text.primary' }}>
                {dashboardData.insights.totalAssistedProjects} <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>Projects</Typography>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {dashboardData.insights.totalAiParams} total parameters extracted
              </Typography>
            </CardContent>
          </Card>

        </Box>

        {/* 3. FEEDBACK SECTION (Underneath everything) */}
        <Box sx={{ mt: 2, pt: 3, borderTop: '1px solid', borderColor: 'border.subtle', flexShrink: 0 }}>
          <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ mb: 1 }}>
            Global Administrator Feedback
          </Typography>
          {feedback ? (
            <Typography variant="body2" color="text.primary">{feedback}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No feedback provided for the global overview.
            </Typography>
          )}
        </Box>

      </Box>
    </Box>
  );
};

export default GlobalOverview;