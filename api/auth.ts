import { config } from './config';

const AUTH_URL = `${config.api}/auth`;

/**
 * `department_enum` in the database, and `DepartmentEnum` in the request
 * schema. These three values are the whole set — the previous registration
 * form took free text, so anything else was rejected with a 422 the user
 * never saw explained.
 */
export const DEPARTMENTS = ['Zelle', 'Module', 'Pack'] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** POST /auth/register-user — UserRegistration declares exactly these two fields. */
export interface UserRegistration {
  username: string;
  department: Department;
}

/** GET /auth/user — UserWithSettingsOutput in BDA/src/db/types/users.py. */
export interface UserWithSettings {
  id: string;
  username: string;
  department: string;
  created_at: string;
  template_id: string | null;
  theme: string | null;
  lang: string | null;
  settings_last_updated_at: string | null;
}

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`The username "${username}" is already taken.`);
    this.name = 'UsernameTakenError';
  }
}

export async function registerUser(input: UserRegistration): Promise<void> {
  const response = await fetch(`${AUTH_URL}/register-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Only the two declared fields. The old form also sent `email` and
    // `password`, which the schema has no place for.
    body: JSON.stringify({ username: input.username, department: input.department }),
  });

  if (response.status === 409) throw new UsernameTakenError(input.username);

  if (!response.ok) {
    let detail = `Registration failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      /* not JSON; keep the status-based message */
    }
    throw new Error(detail);
  }
}
