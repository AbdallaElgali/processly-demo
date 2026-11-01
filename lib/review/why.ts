import type { InputField, Specification } from '@/types';
import { supersededCandidateId } from './corrections';
import { formatDisplayValue } from './format';
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
 * evidence. When the AI gave no text, nothing is shown: no placeholder, and
 * nothing is invented.
 */
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
  /** R2: the source document could not be settled; the backend's `source_reason`, shown under "Source". */
  sourceUnknown: string | null;
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
  const sourceUnknown = spec.candidateId && spec.source && !spec.source.documentId && note && note !== calculation ? note : null;
  return {
    explanation: reasonCode ? null : logic,
    reasonCode,
    sourceNote: note && note !== calculation && note !== sourceUnknown ? note : null,
    calculated: !!spec.calculated,
    calculation: spec.calculated ? calculation : null,
    snippet: clean(spec.source?.textSnippet),
    sourceUnknown,
  };
}

export interface CandidateFacts {
  /** "4200 mV" when the stored value was converted from a different value or unit; null otherwise. */
  convertedFrom: string | null;
  /** "77% after checks (92% before)", "90%", or null. */
  confidence: string | null;
  /** The backend's rule checks in its own words, by severity. */
  rules: Array<{ severity: 'hard' | 'soft' | 'info'; label: string; text: string }>;
  markers: Array<'selected' | 'superseded'>;
}

const RULE_LABEL = { hard: 'Failed check', soft: 'Warning', info: 'Note' } as const;
const sameNumber = (a: string, b: string) => {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) ? x === y : a.trim() === b.trim();
};
const percent = (n: number) => `${Math.round(n)}%`;

/** What "Why this value" adds for one candidate: conversion, confidence, rule checks and its place in the row. */
export function candidateFacts(spec: Specification, field: InputField): CandidateFacts {
  const ov = spec.originalValue;
  const ou = spec.originalUnit;
  const hasOriginal = (ov !== null && ov !== undefined && ov !== '') || !!ou;
  const differs = hasOriginal && (
    (ov !== null && ov !== undefined && ov !== '' && !sameNumber(ov, spec.value)) ||
    (!!ou && (spec.unit ?? '').trim().toLowerCase() !== ou.trim().toLowerCase())
  );
  const convertedFrom = differs ? [ov ? formatDisplayValue(ov) : '', ou ?? ''].filter(Boolean).join(' ') : null;

  const after = spec.confidence;
  const raw = spec.confidenceRaw;
  let confidence: string | null = null;
  if (after !== null && after !== undefined) {
    confidence =
      raw !== null && raw !== undefined && Math.round(raw) !== Math.round(after)
        ? `${percent(after)} after checks (${percent(raw)} before)`
        : percent(after);
  }

  const markers: CandidateFacts['markers'] = [];
  if (spec.id === field.selectedSpecId) markers.push('selected');
  const superseded = supersededCandidateId(field);
  if (superseded && spec.candidateId === superseded && !markers.includes('selected')) markers.push('superseded');

  return {
    convertedFrom,
    confidence,
    rules: (spec.ruleResults ?? []).map((r) => ({ severity: r.severity, label: RULE_LABEL[r.severity] ?? 'Note', text: r.text })),
    markers,
  };
}
