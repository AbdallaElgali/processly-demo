import type { Excluded, ProjectMetricsRow, Rate, ViewName } from '@/api/types/analytics';

export interface TableRow {
  projectId: string;
  alias: string;
  customer: string | null;
  status: string | null;
  notApproved: boolean;
  version: number | null;
  approvedAt: string | null;
  f1: Rate;
  precision: Rate;
  recall: Rate;
  foundF1: Rate;
  firstF1: Rate;
  acceptance: Rate;
  correct: number | null;
  wrong: number | null;
  missed: number | null;
  leftOut: number | null;
  leftOutTooltip: string;
}

export type SortKey = 'version' | 'approvedAt' | 'f1' | 'precision' | 'recall' | 'foundF1' | 'firstF1' | 'acceptance' | 'correct' | 'wrong' | 'missed' | 'leftOut';

export function leftOut(excluded: Excluded | null): { sum: number | null; tooltip: string } {
  if (!excluded) return { sum: null, tooltip: '' };
  const sum = excluded.coverage_gap + excluded.never_asked + excluded.unranked + excluded.parameter_removed;
  const tooltip = `Added later: ${excluded.coverage_gap} · Never sent to the AI: ${excluded.never_asked} · Too old to score: ${excluded.unranked} · Removed: ${excluded.parameter_removed}`;
  return { sum, tooltip };
}

/** All projects as the backend orders them (approved first); a not-approved row has no numbers. */
export function tableRows(projects: ProjectMetricsRow[], view: ViewName): TableRow[] {
  return projects.map((p) => {
    const v = p.views?.[view] ?? null;
    const l = leftOut(p.excluded);
    return {
      projectId: p.project_id,
      alias: p.alias,
      customer: p.customer,
      status: p.status,
      notApproved: p.approval_state !== 'approved' || p.views === null,
      version: p.approval_version,
      approvedAt: p.approved_at,
      f1: v?.f1 ?? null,
      precision: v?.precision ?? null,
      recall: v?.recall ?? null,
      foundF1: p.views?.final_any.f1 ?? null,
      firstF1: p.views?.blind_first.f1 ?? null,
      acceptance: p.acceptance_rate,
      correct: v?.tp ?? null,
      wrong: v?.fp ?? null,
      missed: v?.fn ?? null,
      leftOut: l.sum,
      leftOutTooltip: l.tooltip,
    };
  });
}

/** Sorts by a column; null sorts last in both directions, ties keep their order. */
export function sortRows(rows: TableRow[], key: SortKey, dir: 'asc' | 'desc'): TableRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  const value = (r: TableRow): number | string | null => r[key];
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = value(x.r);
      const b = value(y.r);
      if (a === null && b === null) return x.i - y.i;
      if (a === null) return 1;
      if (b === null) return -1;
      const c = typeof a === 'string' || typeof b === 'string' ? String(a).localeCompare(String(b)) : a - b;
      return c === 0 ? x.i - y.i : c * sign;
    })
    .map((x) => x.r);
}
