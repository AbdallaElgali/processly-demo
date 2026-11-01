/**
 * Hand-written types for the approval routes (decision D10), read off the
 * backend contract of the status/approvals change:
 *
 *   POST /projects/{id}/approve              -> ApproveResult (409: OpenFlagsError)
 *   POST /projects/{id}/flags/resolve-all    -> { message, resolved_count }
 *   GET  /projects/{id}/approvals            -> { approvals: Approval[] }  (newest first)
 *   GET  /projects/{id}/approvals/{version}  -> ApprovalDetail
 */

/** One immutable approval version. */
export interface Approval {
  id: string;
  version: number;
  approved_by: string;
  approved_by_username: string;
  approved_at: string;
  note: string | null;
  flags_resolved_count: number;
  item_count: number;
}

export interface ApproveResult {
  message?: string;
  approval: Approval;
  /** False: nothing differed from the latest version, which is returned unchanged. */
  created: boolean;
  flags_resolved: number;
  parameters_approved: number;
  status?: string;
}

/** One open flag in the 409 body of Approve. */
export interface OpenFlag {
  flag_id: string;
  project_parameter_id: string;
  parameter_alias: string;
  flagger_id: string;
  flagger_username: string;
  flag_reason: string | null;
  created_at: string;
}

export type ApprovalOrigin = 'AI_SELECTED' | 'AI_CORRECTED' | 'HUMAN_ENTERED';

export interface ApprovalItem {
  id: string;
  /** Null once the parameter was removed from the project. */
  project_parameter_id: string | null;
  parameter_id: string;
  parameter_name: string;
  parameter_alias: string;
  final_value: string | null;
  final_unit: string | null;
  selected_candidate_id: string | null;
  source_document_id: string | null;
  source_anchor: string | null;
  origin: ApprovalOrigin | string;
  review_action: string;
}

export interface ApprovalDetail {
  approval: Approval;
  items: ApprovalItem[];
}
