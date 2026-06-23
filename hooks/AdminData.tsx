import { useState, useMemo, useEffect } from 'react';
import { config } from '@/api/config';
import type { ProjectMetrics } from '@/types/audit';

// Re-exported for existing consumers that import these from this hook.
export type { AuditUser as User, ProjectMetrics } from '@/types/audit';

export function useAdminData() {
  // --- Data & Network States ---
  const [projects, setProjects] = useState<ProjectMetrics[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // --- Sidebar & Filter States ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${config.api}/audit/projects`);

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status}`);
        }

        const data = await response.json();
        setProjects(data.metrics);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // --- Dynamically Derive the Users List for the Dropdown ---
  const uniqueUsers = useMemo(() => {
    const userSet = new Set<string>();
    projects.forEach(p => {
      // Safely iterate through the users array if it exists
      if (p.users && p.users.length > 0) {
         p.users.forEach(u => userSet.add(u.username));
      }
    });
    return ['All', ...Array.from(userSet)].sort();
  }, [projects]);

  // --- 1. Filter Projects for the Sidebar ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      // NEW LOGIC: Check if the selected user exists anywhere in this project's users array
      const matchesUser = 
        selectedUser === 'All' || 
        (p.users && p.users.some(u => u.username === selectedUser));
        
      const matchesDate = !dateFilter || p.date === dateFilter;
      
      return matchesSearch && matchesUser && matchesDate;
    });
  }, [projects, searchQuery, selectedUser, dateFilter]);

  // --- 2. Compute Dashboard Data ---
  const dashboardData = useMemo(() => {
    const targetProjects = selectedProjectId 
      ? projects.filter(p => p.id === selectedProjectId)
      : projects;

    if (targetProjects.length === 0) return null;

    // Charts Data
    const recentProjects = [...targetProjects]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .reverse();
    
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
    
    const totalParams = targetProjects.reduce((acc, p) => acc + p.totalParams, 0);
    const avgAcceptanceRate = totalParams > 0 ? Number((totalAccepted / totalParams) * 100).toFixed(1) : 0;

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
    projects,
    filteredProjects,
    isLoading,         // Make sure your UI checks this!
    error,             // Make sure your UI checks this!
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
    users: uniqueUsers, // Now feeds from actual database reviewers
    dashboardData
  };
}