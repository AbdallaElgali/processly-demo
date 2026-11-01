import type { Excluded, ParameterDetail, ProjectMetricsRow, ProjectMetricsResponse, ViewMetrics, ViewName } from '@/api/types/analytics';

export const VIEWS: ViewName[] = ['blind_first', 'blind_any', 'final_first', 'final_any'];

export const vm = (over: Partial<ViewMetrics> = {}): ViewMetrics => ({
  tp: 0, fp: 0, fn: 0, ignored: 0, scored: 0, precision: null, recall: null, f1: null, avg_candidates: null, ...over,
});

export const noExcluded: Excluded = { coverage_gap: 0, never_asked: 0, unranked: 0, parameter_removed: 0 };

/** f1 per view; the counts differ per view too, so a view switch changes every field. */
export const views = (f1: Partial<Record<ViewName, number | null>>) =>
  Object.fromEntries(VIEWS.map((v, i) => {
    const x = f1[v] ?? null;
    return [v, vm({ tp: i + 1, fp: i, fn: 10 - i, scored: 11, precision: x, recall: x, f1: x, avg_candidates: 1 + i / 2 })];
  })) as Record<ViewName, ViewMetrics>;

export const row = (over: Partial<ProjectMetricsRow> & { project_id: string }): ProjectMetricsRow => ({
  alias: over.project_id, customer: 'zelle', status: 'APPROVED', approval_state: 'approved',
  approval_version: 1, approved_at: '2026-10-20T09:12:00+00:00', parameter_count: 10,
  views: views({ blind_first: 0.5, blind_any: 0.6, final_first: 0.7, final_any: 0.9 }),
  acceptance_rate: 0.5, origin_mix: { AI_SELECTED: 5, AI_CORRECTED: 2, HUMAN_ENTERED: 3 },
  excluded: { coverage_gap: 1, never_asked: 2, unranked: 3, parameter_removed: 4 }, ...over,
});

export const notApproved = (id: string): ProjectMetricsRow => row({
  project_id: id, status: 'PENDING_REVIEW', approval_state: 'not_approved', approval_version: null,
  approved_at: null, parameter_count: null, views: null, acceptance_rate: null, origin_mix: null, excluded: null, customer: null,
});

export const response = (projects: ProjectMetricsRow[]): ProjectMetricsResponse => ({
  summary: {
    project_count: projects.length,
    approved_project_count: projects.filter((p) => p.approval_state === 'approved').length,
    not_approved_project_count: projects.filter((p) => p.approval_state !== 'approved').length,
    pooled: {
      views: views({ blind_first: 0.4, blind_any: 0.5, final_first: 0.6, final_any: 0.8 }),
      acceptance_rate: 0.45, origin_mix: { AI_SELECTED: 9, AI_CORRECTED: 3, HUMAN_ENTERED: 6 },
      excluded: { coverage_gap: 1, never_asked: 2, unranked: 3, parameter_removed: 4 }, parameter_count: 18,
    },
    per_project_average: {
      views: Object.fromEntries(VIEWS.map((v, i) => [v, { precision: 0.1 * i, recall: 0.2, f1: [0.45, 0.55, 0.65, 0.85][i] }])) as never,
      acceptance_rate: 0.55,
    },
  },
  projects,
});

export const detailParam = (over: Partial<ParameterDetail> = {}): ParameterDetail => ({
  project_parameter_id: 'pp1', alias: 'Max voltage', canonical_name: 'U_MAX', truth_value: '4.2', truth_unit: 'V', origin: 'AI_SELECTED',
  blind_first: { value: '4.2', unit: 'V' }, final_first: { value: '4.2', unit: 'V' }, blind_candidate_count: 2, final_candidate_count: 3,
  matched_candidate: { value: '4.2', unit: 'V', run_type: 'BLIND', rank: 1 },
  outcomes: { blind_first: 'TP', blind_any: 'TP', final_first: 'TP', final_any: 'TP' }, ...over,
});
