// Shared audit/admin dashboard types. Single home for these so the admin hook
// and the audit API client cannot drift (they previously defined them twice with
// differing `permission_type` nullability).

export interface AuditUser {
  user_id: string;
  username: string;
  department: string;
  permission_type: string | null;
}

export interface ProjectMetrics {
  id: string;
  name: string;
  date: string;
  users: AuditUser[];
  f1Score: number;
  totalParams: number;
  aiParams: number;
  acceptedParams: number;
}
