/**
 * Editing prompts and models (create a version, set an assignment or a model
 * assignment at any scope) is not built, and stays off: the backend's write
 * routes have no authentication, so anyone who can reach it could change the
 * prompts of every project (CLAUDE.md section 4, RFC section 5 P1). Task B
 * adds the forms once there is a way to tell who is asking.
 */
export const PROMPT_EDITING_AVAILABLE = false;
export const PROMPT_EDITING_NOTE =
  'Editing is off. The backend can create prompt versions and change assignments, but it has no authentication: anyone who can reach it could change the prompts of every project. This screen only reads.';
