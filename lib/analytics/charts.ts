import type { ProjectMetricsRow, Rate, ViewName } from '@/api/types/analytics';

export type Scope = 'last5' | 'all';
export const LAST_N = 5;

/** One chart point. Keyed by `projectId`: aliases can share a prefix and are shown only through formatters. */
export interface ChartPoint {
  projectId: string;
  alias: string;
  version: number | null;
  approvedDate: string;
  f1: Rate;
  precision: Rate;
  recall: Rate;
  /** "Right first time" F1, for the comparison line; null when the comparison is off. */
  compareF1: Rate;
}

export type TooltipInfo = Omit<ChartPoint, 'projectId'>;

/** Approved projects in approved_at order, cut to the newest five for "Last 5". */
function approvedInOrder(projects: ProjectMetricsRow[], scope: Scope): ProjectMetricsRow[] {
  const approved = projects
    .filter((p) => p.approval_state === 'approved' && p.views !== null)
    .sort((a, b) => (a.approved_at ?? '').localeCompare(b.approved_at ?? ''));
  return scope === 'last5' ? approved.slice(-LAST_N) : approved;
}

export function chartPoints(projects: ProjectMetricsRow[], view: ViewName, scope: Scope, compare: boolean): ChartPoint[] {
  return approvedInOrder(projects, scope).map((p) => {
    const v = p.views![view];
    return {
      projectId: p.project_id,
      alias: p.alias,
      version: p.approval_version,
      approvedDate: (p.approved_at ?? '').slice(0, 10),
      f1: v.f1,
      precision: v.precision,
      recall: v.recall,
      compareF1: compare ? p.views!.blind_first.f1 : null,
    };
  });
}

/** The axis shows the alias for an id (the data itself is keyed by id). */
export function tickAlias(points: { projectId: string; alias: string }[], projectId: string): string {
  return points.find((p) => p.projectId === projectId)?.alias ?? '';
}

/** What the tooltip shows for the hovered project. */
export function tooltipInfo(points: ChartPoint[], projectId: string): TooltipInfo | null {
  const p = points.find((x) => x.projectId === projectId);
  if (!p) return null;
  const { projectId: _id, ...rest } = p;
  void _id;
  return rest;
}

export interface OriginPoint {
  projectId: string;
  alias: string;
  ai: number;
  aiCorrection: number;
  byHand: number;
}

export function originMixPoints(projects: ProjectMetricsRow[], scope: Scope): OriginPoint[] {
  return approvedInOrder(projects, scope).map((p) => ({
    projectId: p.project_id,
    alias: p.alias,
    ai: p.origin_mix?.AI_SELECTED ?? 0,
    aiCorrection: p.origin_mix?.AI_CORRECTED ?? 0,
    byHand: p.origin_mix?.HUMAN_ENTERED ?? 0,
  }));
}
