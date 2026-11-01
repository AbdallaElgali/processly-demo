/**
 * Response types for GET /analytics/projects and GET /analytics/projects/{id}
 * (BDA/src/api_routes/analytics.py). Hand-written (D10): openapi.json declares
 * these responses as `{}`.
 *
 * NOTE: written from the four-view contract in the fe/analytics brief. The
 * backend merged so far (BDA 33c3159) still has the older single-view shape;
 * see the history note.
 */
export type Rate = number | null; // 0..1, unrounded; null = denominator 0

export type ViewName = 'blind_first' | 'blind_any' | 'final_first' | 'final_any';
export type Origin = 'AI_SELECTED' | 'AI_CORRECTED' | 'HUMAN_ENTERED';

export interface ViewMetrics {
  tp: number;
  fp: number;
  fn: number;
  ignored: number;
  scored: number;
  precision: Rate;
  recall: Rate;
  f1: Rate;
  avg_candidates: number | null;
}

export interface Excluded {
  coverage_gap: number;
  never_asked: number;
  unranked: number;
  parameter_removed: number;
}

export type OriginMix = Record<Origin, number>;

export interface ProjectMetricsRow {
  project_id: string;
  alias: string;
  customer: string | null;
  status: string | null;
  approval_state: 'approved' | 'not_approved';
  approval_version: number | null;
  approved_at: string | null;
  parameter_count: number | null;
  views: Record<ViewName, ViewMetrics> | null;
  acceptance_rate: Rate;
  origin_mix: OriginMix | null;
  excluded: Excluded | null;
}

export interface MetricsSummary {
  project_count: number;
  approved_project_count: number;
  not_approved_project_count: number;
  pooled: {
    views: Record<ViewName, ViewMetrics>;
    acceptance_rate: Rate;
    origin_mix: OriginMix;
    excluded: Excluded;
    parameter_count: number;
  };
  per_project_average: {
    views: Record<ViewName, { precision: Rate; recall: Rate; f1: Rate }>;
    acceptance_rate: Rate;
  };
}

export interface ProjectMetricsResponse {
  summary: MetricsSummary;
  projects: ProjectMetricsRow[];
}

export type Outcome =
  | 'TP' | 'FP' | 'FN' | 'ignored'
  | 'excluded_coverage_gap' | 'excluded_never_asked' | 'excluded_unranked' | 'excluded_removed';

export interface ValueUnit { value: string | null; unit: string | null }

export interface ParameterDetail {
  project_parameter_id: string | null;
  alias: string;
  canonical_name: string;
  truth_value: string | null;
  truth_unit: string | null;
  origin: Origin;
  blind_first: ValueUnit;
  final_first: ValueUnit;
  blind_candidate_count: number;
  final_candidate_count: number;
  matched_candidate: { value: string; unit: string | null; run_type: 'BLIND' | 'ITERATIVE' | 'SINGLE_PARAM'; rank: number | null } | null;
  outcomes: Record<ViewName, Outcome>;
}

export type ProjectMetricsDetail = ProjectMetricsRow & { parameters: ParameterDetail[] };
