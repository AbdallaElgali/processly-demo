'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  apiCreateProject,
  apiGetUserProjects,
  apiGetProjectDetails,
  apiAddContributor,
  apiSaveProjectParameters,
  apiApproveProjectParameters,
  apiUpdateProjectParameter, // <-- Import the new API function
  ProjectCreateInput,
  ParameterInput,
  updateProjectParameter, // <-- Import the new interface
  Project,
} from '@/api/projects';
import { getUserTemplates } from '@/api/templates'; 

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
  updateParameterMetadata: (project_parameter_id: string, data: updateProjectParameter) => Promise<void>; // <-- Add to context interface
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

  // ... (keep fetchUserProjects, loadProjectDetails, createNewProject, addContributor, approveDocument, saveParameters, saveParametersSilent EXACTLY as they are) ...
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
      console.log('Loaded project details:', data);
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
      
      let targetTemplateId = user.template_id;
      
      if (!targetTemplateId) {
        try {
          const templates = await getUserTemplates(user.id);
          const systemDefault = templates.find((t: any) => t.is_system_default);
          if (systemDefault) {
            targetTemplateId = systemDefault.id;
          }
        } catch (e) {
          console.error("Failed to fetch system default template for new project", e);
        }
      }

      const newProjectData: ProjectCreateInput = { 
        ...data, 
        user_id: user.id, 
        template_id: targetTemplateId || null 
      };
      
      const response = await apiCreateProject(newProjectData);
      const newProject = response?.project;
      
      if (newProject) {
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
  }, [user?.id, user?.template_id, fetchUserProjects, loadProjectDetails]);

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

  // --- NEW: Add the metadata update method ---
  const updateParameterMetadata = useCallback(async (project_parameter_id: string, data: updateProjectParameter) => {
    try {
      await apiUpdateProjectParameter(project_parameter_id, data);
      // We don't need to force a full project reload here because we update the UI optimistically.
    } catch (err: unknown) {
      console.error("Failed to update parameter metadata:", err);
      throw err;
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
      updateParameterMetadata, // <-- Pass it down
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