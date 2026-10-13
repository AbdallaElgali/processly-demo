import {
  apiAddAuditor,
  apiAddContributor,
  apiAddProjectParameter,
  apiUpdateProjectStatus,
  apiApproveProjectParameters,
  apiCreateProject,
  apiGetProjectDetails,
  apiGetUserProjects,
  apiSaveProjectParameters,
  apiUpdateProjectParameter,
  apiRemoveProjectParameter,
  type ParameterInput,
  type ProjectCreateInput,
  type updateProjectParameter,
} from '@/api/projects';
import type { FullProjectDetails, ProjectBase, ProjectStatus } from '@/api/types/projects';
import type { InputField } from '@/types';
import { dbParamToInputField, inputFieldToParameterInput } from '@/lib/parameter-adapter';
import type { ProjectParameter } from '@/api/projects';
import { buildAddParameterBody } from '@/lib/parameters/meta';
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
 * Each row goes with its real review state (lib/parameter-adapter.ts) and
 * `userId` as `reviewer_id`. An unknown reviewer is a 422 whose text the caller
 * shows; nothing here retries.
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
    await apiSaveProjectParameters(projectId, parameters, userId);
    projectDataStore.markSaved(projectId, fields);
    await loadProjectDetails(projectId, { background: true });
  } finally {
    if (!options.silent) projectDataStore.setLoading(projectId, 'save', false);
  }
}

/**
 * `POST /projects/{id}/approve`: every PENDING parameter becomes ACCEPTED (a
 * MODIFIED or REJECTED row is left alone). Returns how many. The project is
 * read back at once, so the next save starts from what the backend now holds.
 */
export async function approveProject(projectId: string, userId: string | null = null): Promise<number> {
  const result = await apiApproveProjectParameters(projectId, userId);
  await loadProjectDetails(projectId, { background: true });
  return typeof result?.parameters_approved === 'number' ? result.parameters_approved : 0;
}

/**
 * Reads the project back when an extraction or correction run has ended, however
 * it ended. A stream applies partial results to the rows in memory before the
 * backend has saved anything (D9), and a re-extraction leaves human-touched
 * rows as they were: only the stored state is a safe base for the next save.
 * Unsaved edits survive the reload (`mergeLocalEdits`).
 */
export function reloadAfterRun(projectId: string): Promise<FullProjectDetails | null> {
  return loadProjectDetails(projectId, { background: true });
}

/**
 * Adds one canonical parameter to a project (`POST /projects/{id}/parameters`,
 * backend 3.10). The 201 row goes through the same adapter as a loaded
 * parameter and is appended in place, with no reload, so unsaved edits on other
 * rows are untouched. Errors (404, 409, 422) throw with the backend's body.
 */
export async function addParameterToProject(
  projectId: string,
  parameterId: string,
  userId: string | null,
): Promise<InputField> {
  const row = await apiAddProjectParameter(projectId, buildAddParameterBody(parameterId, userId));
  const field = dbParamToInputField(row);
  projectDataStore.appendField(projectId, field);
  return field;
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

export async function addAuditor(projectId: string, username: string): Promise<void> {
  await apiAddAuditor(projectId, username);
}

/** The route answered 200 but stored a different status than the one requested. */
export class StatusNotAppliedError extends Error {
  constructor(requested: ProjectStatus, actual: ProjectStatus | undefined) {
    super(`The backend stored ${actual ?? 'no status'} instead of ${requested}. Nothing was changed.`);
    this.name = 'StatusNotAppliedError';
  }
}

/**
 * Sets the project's status and uses the `status` the route returns (the value
 * now in the database, backend step 3.1) for the project list; the project is
 * refreshed in the background. A 404 or 422 throws with the backend's text
 * (`errorMessage` unwraps it). Does NOT touch review state: Approve and the
 * status are separate (B10).
 */
export async function changeProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  const stored = await apiUpdateProjectStatus(projectId, status);
  projectsIndex.updateStatus(projectId, stored);
  void loadProjectDetails(projectId, { background: true });
  if (stored !== status) throw new StatusNotAppliedError(status, stored);
}

export async function updateParameterMetadata(
  projectParameterId: string,
  data: updateProjectParameter,
): Promise<void> {
  await apiUpdateProjectParameter(projectParameterId, data);
}

/** Edits one parameter's alias, description or AI instructions, then refreshes the project in the background. */
export async function editParameterMetadata(
  projectId: string,
  projectParameterId: string,
  data: updateProjectParameter,
): Promise<void> {
  await apiUpdateProjectParameter(projectParameterId, data);
  await loadProjectDetails(projectId, { background: true });
}

/**
 * Removes one parameter from a project. The backend deletes the row for good,
 * with its candidates and flag history, so any unsaved edit on it is dropped
 * too.
 */
export async function removeParameter(projectId: string, key: string, projectParameterId: string): Promise<void> {
  await apiRemoveProjectParameter(projectParameterId);
  projectDataStore.dropDirty(projectId, key);
  await loadProjectDetails(projectId, { background: true });
}
