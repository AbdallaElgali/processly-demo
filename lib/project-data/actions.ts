import {
  apiAddContributor,
  apiApproveProjectParameters,
  apiCreateProject,
  apiGetProjectDetails,
  apiGetUserProjects,
  apiSaveProjectParameters,
  apiUpdateProjectParameter,
  type ParameterInput,
  type ProjectCreateInput,
  type updateProjectParameter,
} from '@/api/projects';
import type { FullProjectDetails, ProjectBase } from '@/api/types/projects';
import type { InputField } from '@/types';
import { dbParamToInputField, inputFieldToParameterInput } from '@/lib/parameter-adapter';
import type { ProjectParameter } from '@/api/projects';
import { projectDataStore } from './store';
import { projectsIndex } from './projects-index';

/**
 * Operations on project data.
 *
 * These replace ProjectContext's methods. The important difference: none of
 * them touches a single app-wide `isLoading`. Loading is recorded per project
 * and per operation, so one project's save can never blank another project's
 * screen (CLAUDE.md 8.1).
 */

export async function fetchProjects(userId: string): Promise<ProjectBase[]> {
  projectsIndex.setLoading(true);
  try {
    const data = await apiGetUserProjects(userId);
    const projects = (data.projects ?? []) as unknown as ProjectBase[];
    projectsIndex.set(projects);
    return projects;
  } catch (error) {
    projectsIndex.setError(error instanceof Error ? error.message : 'Failed to fetch projects');
    return [];
  } finally {
    projectsIndex.setLoading(false);
  }
}

/**
 * Loads one project's details into its own slot.
 *
 * `background` suppresses the loading flag, for the refresh that follows a job
 * completing: results must appear without the screen flickering, and
 * completion must never navigate or interrupt (CLAUDE.md 8.1).
 */
export async function loadProjectDetails(
  projectId: string,
  options: { background?: boolean } = {},
): Promise<FullProjectDetails | null> {
  if (!options.background) projectDataStore.setLoading(projectId, 'details', true);
  try {
    const details = (await apiGetProjectDetails(projectId)) as unknown as FullProjectDetails;
    const fields = (details.parameters ?? []).map((p) =>
      dbParamToInputField(p as unknown as ProjectParameter),
    );
    projectDataStore.setDetails(projectId, details, fields);
    return details;
  } catch (error) {
    projectDataStore.setError(
      projectId,
      error instanceof Error ? error.message : 'Failed to load project',
    );
    return null;
  } finally {
    if (!options.background) projectDataStore.setLoading(projectId, 'details', false);
  }
}

/**
 * Saves the given rows through `PUT /projects/{id}/parameters` (which updates
 * only the rows it is sent), marks them clean, then refreshes the project in
 * the background. `silent` keeps the toolbar's Save spinner out of a
 * row-level save (Accept).
 *
 * Backend behaviour to know (B15): the batch save ignores `review_action`
 * and writes PENDING on every row it touches, so saving a row that was
 * approved returns it to pending.
 */
export async function saveFields(
  projectId: string,
  fields: readonly InputField[],
  userId: string | null,
  options: { silent?: boolean } = {},
): Promise<void> {
  if (fields.length === 0) return;
  const parameters: ParameterInput[] = fields.map((f) => inputFieldToParameterInput(f, userId));
  if (!options.silent) projectDataStore.setLoading(projectId, 'save', true);
  try {
    await apiSaveProjectParameters(projectId, parameters);
    projectDataStore.markSaved(projectId, fields);
    await loadProjectDetails(projectId, { background: true });
  } finally {
    if (!options.silent) projectDataStore.setLoading(projectId, 'save', false);
  }
}

/** `POST /projects/{id}/approve`: every PENDING parameter becomes ACCEPTED. Returns how many. */
export async function approveProject(projectId: string): Promise<number> {
  const result = await apiApproveProjectParameters(projectId);
  await loadProjectDetails(projectId, { background: true });
  return typeof result?.parameters_approved === 'number' ? result.parameters_approved : 0;
}

export async function createProject(input: ProjectCreateInput): Promise<ProjectBase | undefined> {
  const response = await apiCreateProject(input);
  const project = response?.project as unknown as ProjectBase | undefined;
  if (project) {
    projectsIndex.add(project);
    await loadProjectDetails(project.id);
  }
  return project;
}

export async function addContributor(projectId: string, username: string): Promise<void> {
  await apiAddContributor(projectId, username);
  await loadProjectDetails(projectId, { background: true });
}

export async function updateParameterMetadata(
  projectParameterId: string,
  data: updateProjectParameter,
): Promise<void> {
  await apiUpdateProjectParameter(projectParameterId, data);
}
