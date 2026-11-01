import type { MetricsSummary, Rate, ViewName } from '@/api/types/analytics';
import { showsCandidates, VIEW_HELP, VIEW_LABEL } from './views';

export { formatRate } from './views';

export interface HeadlineTile {
  view: ViewName;
  label: string;
  help: string;
  /** Per-project average: the main number. */
  average: Rate;
  /** All parameters pooled: shown underneath. */
  pooled: Rate;
  avgCandidates: number | null;
}

const HEADLINE_VIEWS: ViewName[] = ['final_any', 'blind_first'];

export function headlineTiles(summary: MetricsSummary): HeadlineTile[] {
  return HEADLINE_VIEWS.map((view) => ({
    view,
    label: VIEW_LABEL[view],
    help: VIEW_HELP[view],
    average: summary.per_project_average.views[view].f1,
    pooled: summary.pooled.views[view].f1,
    avgCandidates: showsCandidates(view) ? summary.pooled.views[view].avg_candidates : null,
  }));
}

export function acceptanceTile(summary: MetricsSummary): { average: Rate; pooled: Rate } {
  return { average: summary.per_project_average.acceptance_rate, pooled: summary.pooled.acceptance_rate };
}

export function projectCounts(summary: MetricsSummary) {
  return { approved: summary.approved_project_count, notApproved: summary.not_approved_project_count, total: summary.project_count };
}

export interface RatePair { average: Rate; pooled: Rate }

/** The detailed tiles of the selected view: precision, recall, F1 (both labelled), correct / wrong / missed, avg. candidates. */
export function detailTiles(summary: MetricsSummary, view: ViewName) {
  const pooled = summary.pooled.views[view];
  const average = summary.per_project_average.views[view];
  return {
    precision: { average: average.precision, pooled: pooled.precision } as RatePair,
    recall: { average: average.recall, pooled: pooled.recall } as RatePair,
    f1: { average: average.f1, pooled: pooled.f1 } as RatePair,
    correct: pooled.tp,
    wrong: pooled.fp,
    missed: pooled.fn,
    avgCandidates: pooled.avg_candidates,
  };
}
