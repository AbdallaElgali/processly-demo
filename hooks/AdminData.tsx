import { useState, useMemo, useEffect } from 'react';

// --- Dummy Data ---
const DUMMY_USERS = ['Alice Smith', 'Bob Jones', 'Charlie Davis', 'Diana Prince'];

const generateDummyProjects = () => {
  return Array.from({ length: 20 }).map((_, i) => {
    const totalParams = Math.floor(Math.random() * 50) + 50; // 50 to 100
    const aiParams = Math.floor(totalParams * (Math.random() * 0.4 + 0.6)); // 60% to 100% of total
    const acceptedParams = Math.floor(aiParams * (Math.random() * 0.3 + 0.7)); // 70% to 100% of AI
    
    return {
      id: `proj-${i + 1}`,
      name: `Battery Cell Batch ${2000 + i}`,
      date: new Date(2026, 5, i + 1).toISOString().split('T')[0],
      user: DUMMY_USERS[Math.floor(Math.random() * DUMMY_USERS.length)],
      f1Score: Number((Math.random() * 0.3 + 0.7).toFixed(2)), // 0.70 to 1.00
      totalParams,
      aiParams,
      acceptedParams,
    };
  });
};

const ALL_PROJECTS = generateDummyProjects();

export function useAdminData() {
  const [projects, setProjects] = useState(ALL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Sidebar states
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');

  // 1. Filter Projects for the Sidebar
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUser = selectedUser === 'All' || p.user === selectedUser;
      const matchesDate = !dateFilter || p.date === dateFilter;
      return matchesSearch && matchesUser && matchesDate;
    });
  }, [projects, searchQuery, selectedUser, dateFilter]);

  // 2. Compute Dashboard Data (either global or selected project)
  const dashboardData = useMemo(() => {
    const targetProjects = selectedProjectId 
      ? projects.filter(p => p.id === selectedProjectId)
      : projects;

    if (targetProjects.length === 0) return null;

    // Charts Data
    const recentProjects = [...targetProjects].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).reverse();
    
    const chartData = recentProjects.map(p => ({
      name: p.name.substring(0, 10) + '...',
      f1Score: p.f1Score,
      totalParams: p.totalParams,
      aiParams: p.aiParams
    }));

    // Key Insights Data
    const totalF1 = targetProjects.reduce((acc, p) => acc + p.f1Score, 0);
    const avgF1 = (totalF1 / targetProjects.length).toFixed(2);

    const totalAi = targetProjects.reduce((acc, p) => acc + p.aiParams, 0);
    const totalAccepted = targetProjects.reduce((acc, p) => acc + p.acceptedParams, 0);
    const avgAcceptanceRate = totalAi > 0 ? ((totalAccepted / totalAi) * 100).toFixed(1) : 0;

    const totalAssistedProjects = targetProjects.filter(p => p.aiParams > 0).length;

    return {
      chartData,
      insights: {
        avgF1,
        avgAcceptanceRate,
        totalAssistedProjects,
        totalAiParams: totalAi
      }
    };
  }, [projects, selectedProjectId]);

  return {
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
    users: ['All', ...DUMMY_USERS],
    dashboardData
  };
}