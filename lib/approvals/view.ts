import type { ProjectStatus } from '@/api/types/projects';
import type { ApprovalItem, ApproveResult, OpenFlag } from '@/api/types/approvals';
import type { InputField } from '@/types';
import { selectedSpec } from '@/lib/review/rowState';
import { formatDisplayValue } from '@/lib/review/format';

/** Pure display logic for status, approvals and open flags. */

/** What a person may set by hand. APPROVED is never offered: use Approve. */
export const OVERRIDE_STATUSES: readonly ProjectStatus[] = ['NEW', 'PENDING_REVIEW', 'IN_REVIEW'];

const LABEL: Record<ProjectStatus, string> = {
  NEW: 'New',
  PENDING_REVIEW: 'Pending review',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
};

export const statusLabel = (status: ProjectStatus): string => LABEL[status] ?? status;

/** The project fields the status line reads. All optional: an older backend sends none of the new ones. */
export interface StatusInfo {
  status: ProjectStatus;
  approval_version?: number | null;
  approved_at?: string | null;
  approved_by_username?: string | null;
  changed_since_approval?: boolean;
  status_overridden?: boolean;
}

export type DateFormatter = (iso: string) => string;
const defaultDate: DateFormatter = (iso) => new Date(iso).toLocaleDateString();

export interface StatusDisplay {
  /** The plain status word. */
  label: string;
  /** The full line: "Approved · v2 · mia · 30.10.2026", "In review · changed since approval v2", or the label. */
  line: string;
  /** The status was set by hand and is still that override. */
  manual: boolean;
  manualTooltip: string;
}

export function statusDisplay(p: StatusInfo, formatDate: DateFormatter = defaultDate): StatusDisplay {
  const label = statusLabel(p.status);
  const version = p.approval_version ?? null;
  let line = label;
  if (version !== null && p.changed_since_approval) {
    line = `${label} · changed since approval v${version}`;
  } else if (version !== null && p.status === 'APPROVED') {
    const parts = [label, `v${version}`];
    if (p.approved_by_username) parts.push(p.approved_by_username);
    if (p.approved_at) parts.push(formatDate(p.approved_at));
    line = parts.join(' · ');
  }
  return {
    label,
    line,
    manual: !!p.status_overridden,
    manualTooltip: 'This status was set by hand. It changes by itself again at the next review action.',
  };
}

/** "Approved as version N", or the no-change text when the backend returned the existing version. */
export function approveToastText(result: Pick<ApproveResult, 'created' | 'approval'>): string {
  return result.created
    ? `Approved as version ${result.approval.version}`
    : `Nothing changed since version ${result.approval.version} — approval confirmed`;
}

/** The banner shown when the project changed after its latest approval, else null. */
export function reapproveBanner(p: Pick<StatusInfo, 'approval_version' | 'changed_since_approval'>): string | null {
  const version = p.approval_version ?? null;
  if (version === null || !p.changed_since_approval) return null;
  return `Values changed since approval v${version}. Re-approve to save the current state as version ${version + 1}.`;
}

/** "Resolve all flags (N)", or null when there is nothing to resolve. */
export function resolveAllLabel(openFlagCount: number | undefined): string | null {
  return openFlagCount && openFlagCount > 0 ? `Resolve all flags (${openFlagCount})` : null;
}

export const openFlagWho = (f: OpenFlag): string => f.flagger_username || 'Unknown user';
export const openFlagWhy = (f: OpenFlag): string => (f.flag_reason?.trim() ? f.flag_reason.trim() : 'no reason given');
export const flagWhen = (f: OpenFlag, formatDate: DateFormatter = defaultDate): string => formatDate(f.created_at);

const ORIGIN: Record<string, string> = {
  AI_SELECTED: 'AI',
  AI_CORRECTED: 'AI correction',
  HUMAN_ENTERED: 'Entered by hand',
};
export const originLabel = (origin: string): string => ORIGIN[origin] ?? origin;

/** A removed parameter has `project_parameter_id: null`; its alias is still recorded. */
export function approvalItemName(item: ApprovalItem): { name: string; removed: boolean } {
  return { name: item.parameter_alias || item.parameter_name, removed: item.project_parameter_id === null };
}

export function approvalValue(item: Pick<ApprovalItem, 'final_value' | 'final_unit'>): string {
  if (item.final_value === null || item.final_value === '') return 'No value';
  const value = formatDisplayValue(item.final_value);
  return item.final_unit ? `${value} ${item.final_unit}` : value;
}

export interface ApprovalRow {
  id: string;
  name: string;
  removed: boolean;
  value: string;
  origin: string;
}

export function approvalRows(items: ApprovalItem[]): ApprovalRow[] {
  return items.map((item) => ({ id: item.id, ...approvalItemName(item), value: approvalValue(item), origin: originLabel(item.origin) }));
}

export const analyzeConfirmText =
  'Run a full extraction again? Values you edited, accepted or rejected are kept; other AI values may change.';

/** True when the project already has extracted or entered values, so a full Analyze deserves a confirmation. */
export function needsAnalyzeConfirm(fields: readonly InputField[]): boolean {
  return fields.some((f) => {
    if (f.isHumanModified) return true;
    const value = selectedSpec(f)?.value;
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}
