/**
 * Editing the GLOBAL registry (creating a global version, setting an assignment
 * or a model assignment) is not built, and stays off: the backend's write
 * routes have no authentication, so anyone who can reach it could change the
 * prompts of every project (CLAUDE.md section 4, RFC section 5 P1).
 *
 * Since S4 the screens do write two narrower things, both limited to the
 * category slots: a customer's own prompt version (Library > Customers) and a
 * project's own pin before its first extraction. Agent prompts and model
 * settings stay global and read-only.
 */
export const PROMPT_EDITING_AVAILABLE = false;
export const PROMPT_EDITING_NOTE =
  'The shared prompt library is read-only here: there is no sign-in check, so anyone who can reach it could change the prompts of every project. What you can change is this project’s own category prompts, before its first extraction.';
