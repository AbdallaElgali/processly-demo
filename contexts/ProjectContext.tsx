'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  apiCreateProject,
  apiGetUserProjects,
  apiGetProjectDetails,
  apiAddContributor,
  apiSaveProjectParameters,
  ProjectCreateInput,
  ParameterInput,
  Project,
} from '@/api/projects';

// --- Interfaces ---
interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchUserProjects: () => Promise<void>;
  loadProjectDetails: (projectId: string) => Promise<void>;
  createNewProject: (data: Omit<ProjectCreateInput, 'user_id'>) => Promise<Project | undefined>;
  addContributor: (projectId: string, username: string) => Promise<void>;
  saveParameters: (projectId: string, parameters: ParameterInput[]) => Promise<void>;
  clearError: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const fetchUserProjects = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetUserProjects(user.id);
      setProjects(data.projects || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchUserProjects();
    } else {
      setProjects([]);
      setCurrentProject(null);
    }
  }, [user?.id, fetchUserProjects]);

  const loadProjectDetails = useCallback(async (projectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetProjectDetails(projectId);
      setCurrentProject(data);
      console.log('CURRENT PROJECT:', data);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewProject = useCallback(async (data: Omit<ProjectCreateInput, 'user_id'>) => {
    if (!user?.id) throw new Error("Must be logged in to create a project.");
    setIsLoading(true);
    setError(null);
    try {
      const newProjectData: ProjectCreateInput = { ...data, user_id: user.id };
      const response = await apiCreateProject(newProjectData);

      await fetchUserProjects();

      const newProjectId = response?.project?.id;
      if (newProjectId) {
        await loadProjectDetails(newProjectId);
      }

      return response?.project;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, fetchUserProjects, loadProjectDetails]);

  const addContributor = useCallback(async (projectId: string, username: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiAddContributor(projectId, username);
      if (currentProject?.id === projectId) {
        await loadProjectDetails(projectId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contributor');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.id, loadProjectDetails]);

  const saveParameters = useCallback(async (projectId: string, parameters: ParameterInput[]) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiSaveProjectParameters(projectId, parameters);
      if (currentProject?.id === projectId) {
        await loadProjectDetails(projectId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save parameters');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.id, loadProjectDetails]);

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      isLoading,
      error,
      fetchUserProjects,
      loadProjectDetails,
      createNewProject,
      addContributor,
      saveParameters,
      clearError
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
