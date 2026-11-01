import { apiGetApproval, apiGetApprovals } from '@/api/approvals';
import type { Approval, ApprovalDetail } from '@/api/types/approvals';

/** The project's approval versions, newest first. */
export function loadApprovals(projectId: string): Promise<Approval[]> {
  return apiGetApprovals(projectId);
}

/** One version with its items (read-only). */
export function loadApproval(projectId: string, version: number): Promise<ApprovalDetail> {
  return apiGetApproval(projectId, version);
}
