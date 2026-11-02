import type { AddMemberResult } from '@/lib/members/members';
import {
  apiAddAuditor,
  apiAddContributor,
  apiAddProjectParameter,
  apiUpdateProjectStatus,
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
import { apiApprove, apiResolveAllFlags, type ApproveOptions } from '@/api/approvals';
import type { ApproveResult } from '@/api/types/approvals';
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
    projectsIndex.mergeProject(details);
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
 * `POST /projects/{id}/approve`: stores an immutable approval version (or
 * confirms the latest when nothing changed, `created: false`). The backend
 * decides about open flags: with some and `resolveOpenFlags` false it answers
 * 409 and this throws `OpenFlagsError` (nothing changed, so no re-read). On
 * success the project is read back, so status, approval fields and the flag
 * count are what the backend now holds.
 */
export async function approveProject(
  projectId: string,
  userId: string | null = null,
  options: ApproveOptions = {},
): Promise<ApproveResult> {
  const result = await apiApprove(projectId, userId, options);
  await loadProjectDetails(projectId, { background: true });
  return result;
}

/** `POST /projects/{id}/flags/resolve-all`, then re-reads the project. Returns how many flags were resolved. */
export async function resolveAllFlags(projectId: string, userId: string | null): Promise<number> {
  const count = await apiResolveAllFlags(projectId, userId);
  await loadProjectDetails(projectId, { background: true });
  return count;
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
  // The status can move with a new parameter: read the project instead of setting anything.
  void loadProjectDetails(projectId, { background: true });
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

export async function addContributor(projectId: string, username: string): Promise<AddMemberResult> {
  const result = await apiAddContributor(projectId, username);
  await loadProjectDetails(projectId, { background: true });
  return result;
}

export async function addAuditor(projectId: string, username: string): Promise<AddMemberResult> {
  return apiAddAuditor(projectId, username);
}

/**
 * The manual override (`POST /projects/update-project-status`; NEW,
 * PENDING_REVIEW or IN_REVIEW only, APPROVED is a 409). Sends `user_id`, then
 * re-reads the project: the list and the header show what the backend stored
 * (and `status_overridden`), never what was requested. A failure throws with
 * the backend's body (`errorMessage` unwraps it).
 */
export async function changeProjectStatus(projectId: string, status: ProjectStatus, userId: string | null = null): Promise<void> {
  await apiUpdateProjectStatus(projectId, status, userId);
  await loadProjectDetails(projectId, { background: true });
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
