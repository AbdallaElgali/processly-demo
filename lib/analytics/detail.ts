import type { Outcome, ParameterDetail, ValueUnit, ViewName } from '@/api/types/analytics';
import { VIEW_ORDER } from './views';

const OUTCOME_WORD: Record<Outcome, string> = {
  TP: 'Correct',
  FP: 'Wrong',
  FN: 'Missed',
  ignored: 'Both empty',
  excluded_coverage_gap: 'Added later',
  excluded_never_asked: 'Never sent to the AI',
  excluded_unranked: 'Too old to score',
  excluded_removed: 'Removed',
};

export const outcomeWord = (o: Outcome): string => OUTCOME_WORD[o] ?? o;

const RUN_LABEL = { BLIND: 'first extraction', ITERATIVE: 'correction', SINGLE_PARAM: 'single retry' } as const;
export const matchedLabel = (run: keyof typeof RUN_LABEL): string => RUN_LABEL[run] ?? run;

const valueText = (v: ValueUnit | null): string => (v?.value ? [v.value, v.unit].filter(Boolean).join(' ') : '—');

export function matchedText(m: ParameterDetail['matched_candidate']): string {
  if (!m) return '—';
  const parts = [[m.value, m.unit].filter(Boolean).join(' '), matchedLabel(m.run_type)];
  if (m.rank !== null) parts.push(`rank ${m.rank}`);
  return parts.join(' · ');
}

export interface ParameterRowView {
  key: string;
  alias: string;
  canonicalName: string;
  truth: string;
  blindFirst: string;
  finalFirst: string;
  matched: string;
  counts: string; // first extraction / all runs
  outcomes: Record<ViewName, string>;
}

export function parameterRows(params: ParameterDetail[]): ParameterRowView[] {
  return params.map((p, i) => ({
    key: p.project_parameter_id ?? `removed-${i}`,
    alias: p.alias,
    canonicalName: p.canonical_name,
    truth: valueText({ value: p.truth_value, unit: p.truth_unit }),
    blindFirst: valueText(p.blind_first),
    finalFirst: valueText(p.final_first),
    matched: matchedText(p.matched_candidate),
    counts: `${p.blind_candidate_count} / ${p.final_candidate_count}`,
    outcomes: Object.fromEntries(VIEW_ORDER.map((v) => [v, outcomeWord(p.outcomes[v])])) as Record<ViewName, string>,
  }));
}

export function filterByOutcome(params: ParameterDetail[], view: ViewName, outcome: Outcome | 'all'): ParameterDetail[] {
  return outcome === 'all' ? params : params.filter((p) => p.outcomes[view] === outcome);
}

/** Only the outcomes that occur in the selected view, so the filter never offers an empty choice. */
export function outcomeOptions(params: ParameterDetail[], view: ViewName): { value: Outcome; label: string }[] {
  const seen = new Set(params.map((p) => p.outcomes[view]));
  return (Object.keys(OUTCOME_WORD) as Outcome[]).filter((o) => seen.has(o)).map((o) => ({ value: o, label: OUTCOME_WORD[o] }));
}

export function analyticsErrorMessage(status: number): string {
  if (status === 404) return 'This project was not found.';
  if (status === 422) return 'This is not a valid project id.';
  return `The metrics could not be loaded (error ${status}).`;
}
