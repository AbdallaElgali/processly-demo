import type { Rate, ViewName } from '@/api/types/analytics';

/** Order of the View switch. */
export const VIEW_ORDER: ViewName[] = ['final_any', 'blind_first', 'blind_any', 'final_first'];
export const DEFAULT_VIEW: ViewName = 'final_any';

export const VIEW_LABEL: Record<ViewName, string> = {
  final_any: 'Found by the AI',
  blind_first: 'Right first time',
  blind_any: 'Found on first extraction',
  final_first: "AI's final pick right",
};

export const VIEW_HELP: Record<ViewName, string> = {
  final_any: "The right value was among the AI's candidates in any run before approval, including correction runs.",
  blind_first: 'The value the AI selected on the first full extraction was right.',
  blind_any: "The right value was among the candidates of the first full extraction, even if the AI selected another one.",
  final_first: 'The value the AI selected in its last run before approval was right.',
};

/** "Found" views get easier with more candidates, so they show the average next to the score. */
export const showsCandidates = (view: ViewName): boolean => view === 'final_any' || view === 'blind_any';

export const HELP = {
  truth: "The values in the project's latest approval.",
  outcomes:
    "Correct: a value in the AI's answer equals the approved value (2000 mA = 2 A counts as equal). Wrong: the AI answered, but no value matches, or the approved value is empty. Missed: an approved value exists, but the AI found nothing.",
  precision: "Of the AI's answers, the share that were right.",
  recall: 'Of the approved values, the share the AI got right.',
  f1: 'One score balancing both; 1.0 = all right, nothing missed. "—" when there is nothing to compute.',
  avgCandidates: 'How many values the AI offered per parameter on average. "Found" views get easier with more candidates; read them together.',
  acceptance: 'The share of approved values the engineers kept exactly as the AI first extracted them.',
  leftOut:
    'Parameters added after the first extraction, not covered by any AI run before approval, from runs too old to show the AI\'s pick, or deleted after approval. Not scored in the views they don\'t apply to.',
  pooledVsAverage:
    'Pooled adds up all parameters of all approved projects, so large projects weigh more. Average scores each project, then averages, so each project weighs the same; projects with no score ("—") are left out of the average.',
} as const;

/** A rate (0..1) for display; null is "—", never 0. */
export function formatRate(rate: Rate): string {
  return rate === null || rate === undefined ? '—' : rate.toFixed(2);
}
