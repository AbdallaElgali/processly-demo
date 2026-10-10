import type { Specification } from '@/types';
import { hasValue } from './rowState';
import { matchReasonCode, type ReasonCodeInfo } from './reasonCodes';

/**
 * "Why this value" (AM15, step 10) for one candidate.
 *
 * What the API returns is the rationale the model wrote into its answer, not
 * its internal chain of thought, and not a quote from the document (B13: the
 * stored `source_reason` is the Supervisor's narration, written without
 * seeing the source text). So the UI labels these texts as the model's
 * explanation and shows the recorded source text and location as the
 * evidence. Every empty text shows NO_REASONING, never a blank.
 */
export const NO_REASONING = 'No reasoning recorded';
export const NO_SOURCE_TEXT = 'No source text recorded';

export interface WhyThisValue {
  /** `extraction_logic` on a valued candidate (or unrecognised text on an empty one). */
  explanation: string | null;
  /** On an empty candidate: the backend's reason code, shown instead of an explanation. */
  reasonCode: ReasonCodeInfo | null;
  /** `source_reason`: the model's note on where the value came from. */
  sourceNote: string | null;
  /** True when the value was computed rather than read. */
  calculated: boolean;
  /** `calculation_logic`, shown only when `calculated`. */
  calculation: string | null;
  /** The recorded source text: the evidence. */
  snippet: string | null;
}

const clean = (s: string | null | undefined): string | null => {
  const t = typeof s === 'string' ? s.trim() : '';
  return t ? t : null;
};

export function whyThisValue(spec: Specification): WhyThisValue {
  const valued = hasValue(spec);
  const logic = clean(spec.extractionLogic);
  const reasonCode = valued ? null : matchReasonCode(logic);
  const calculation = clean(spec.calculationLogic);
  // The adapter falls back to calculation_logic for source.reason; do not show it twice.
  const note = clean(spec.source?.reason);
  return {
    explanation: reasonCode ? null : logic,
    reasonCode,
    sourceNote: note && note !== calculation ? note : null,
    calculated: !!spec.calculated,
    calculation: spec.calculated ? calculation : null,
    snippet: clean(spec.source?.textSnippet),
  };
}
