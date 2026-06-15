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
  apiApproveProjectParameters,
} from '@/api/projects';

// --- Interfaces ---
interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchUserProjects: () => Promise<void>;
  loadProjectDetails: (projectId: string) => Promise<Project>;
  createNewProject: (data: Omit<ProjectCreateInput, 'user_id'>) => Promise<Project | undefined>;
  addContributor: (projectId: string, username: string) => Promise<void>;
  saveParameters: (projectId: string, parameters: ParameterInput[]) => Promise<Project | undefined>;
  saveParametersSilent: (projectId: string, parameters: ParameterInput[]) => Promise<Project | undefined>;
  clearError: () => void;
  approveDocument: (projectId: string) => Promise<void>;
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

  const loadProjectDetails = useCallback(async (projectId: string): Promise<Project> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetProjectDetails(projectId);
      setCurrentProject(data);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load project details');
      throw err;
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

      const newProject = response?.project;
      if (newProject) {
        // Optimistically add the new project to the list. The
        // GET /projects/user/{id} list endpoint is eventually consistent and
        // may not return a just-created project immediately, so relying on a
        // refetch here would leave `projects` empty and re-trigger the
        // "initialize project" screen. Merge directly instead.
        setProjects(prev => prev.some(p => p.id === newProject.id) ? prev : [...prev, newProject]);
        await loadProjectDetails(newProject.id);
      }

      return newProject;
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

  const approveDocument = useCallback(async (projectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiApproveProjectParameters(projectId);
      // Reload the project details so the UI updates to show everything as ACCEPTED
      if (currentProject?.id === projectId) {
        await loadProjectDetails(projectId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve document');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.id, loadProjectDetails]);

  const saveParameters = useCallback(async (projectId: string, parameters: ParameterInput[]): Promise<Project | undefined> => {
    setIsLoading(true);
    setError(null);
    try {
      await apiSaveProjectParameters(projectId, parameters);
      if (currentProject?.id === projectId) {
        return await loadProjectDetails(projectId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save parameters');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.id, loadProjectDetails]);

  // Silent save: does not set isLoading so the UI never flashes a loading spinner.
  // Used for auto-save triggered by user actions (e.g. flagging an unsaved parameter).
  const saveParametersSilent = useCallback(async (projectId: string, parameters: ParameterInput[]): Promise<Project | undefined> => {
    try {
      await apiSaveProjectParameters(projectId, parameters);
      const data = await apiGetProjectDetails(projectId);
      setCurrentProject(data);
      return data;
    } catch {
      return undefined;
    }
  }, []);

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
      saveParametersSilent,
      clearError,
      approveDocument
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
