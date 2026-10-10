import type { FlagDetail, ParameterLineageEvent, ParameterLineageResponse, ProjectSummary } from '@/types/audit';
import type { ExtractionRun } from '@/api/types/projects';
import { matchReasonCode } from '@/lib/review/reasonCodes';

/**
 * Every stored flag was raised by a reviewer (`POST /flagging/ai-flag-parameter`).
 * The backend's `flag_type` `AI_CORRETION` (sic) means "flag on an AI value",
 * not "raised by the AI", and it is written for every flag (B23), so the type
 * is not shown as a who. Out-of-bounds warnings are never stored as flags
 * (they live in `rule_violations`).
 */
export const REVIEWER_FLAG_LABEL = 'Reviewer flag';
export const CARRIED_OVER_LABEL = 'carried over after re-extraction';

/**
 * A flag opened on a correction's new candidate with the same reason as the
 * flag that candidate resolved: the backend re-raises the flag on the new value.
 */
export function isCarriedOver(flag: FlagDetail | null, resolvesFlag: FlagDetail | null): boolean {
  if (!flag || !resolvesFlag) return false;
  const a = (flag.flagReason ?? '').trim();
  return a !== '' && a === (resolvesFlag.flagReason ?? '').trim();
}

/**
 * What an empty candidate shows instead of a value: its reason code's short
 * label (CLAUDE.md 7: never a blank), or "no value" when the explanation is
 * not one of the four codes.
 */
export function emptyValueLabel(extractionLogic: string | null): string {
  return matchReasonCode(extractionLogic)?.label ?? 'no value';
}

/** Equal as numbers when both parse (2.30 equals 2.3), otherwise as text; null only equals null. */
export function sameValue(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const na = Number(a);
  const nb = Number(b);
  if (a.trim() !== '' && b.trim() !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return a.trim() === b.trim();
}

export interface LineageRow {
  event: ParameterLineageEvent;
  /** 1-based position among the candidates, oldest first. */
  ordinal: number;
  runNumber: number | null;
  runType: string | null;
  /** The candidate before this one, if any. */
  previous: ParameterLineageEvent | null;
  valueChange: 'first' | 'same' | 'changed';
  unitChanged: boolean;
  /** This candidate is the one that resolved an earlier flag (a flag chain). */
  resolvesFlag: { flag: FlagDetail; fromOrdinal: number } | null;
  /** This candidate's own flag repeats the reason of the flag it resolved (see `isCarriedOver`). */
  flagCarriedOver: boolean;
  /** The flag on this candidate was resolved by another candidate. */
  resolvedBy: { ordinal: number; runNumber: number | null } | null;
}

export interface LineageView {
  parameterKey: string;
  finalValue: string | null;
  reviewAction: string | null;
  isAiAccepted: boolean;
  rows: LineageRow[];
  /** Number of distinct runs that produced a candidate. */
  runCount: number;
}

/**
 * Oldest first. Run numbers come from the runs list because the lineage
 * response carries only the run id. Flags are attached to the candidate they
 * were raised on; the route returns only the NEWEST flag per candidate.
 */
export function buildLineage(lineage: ParameterLineageResponse, runs: ExtractionRun[] | null): LineageView {
  const runById = new Map((runs ?? []).map((r) => [r.id, r]));
  const events = [...(lineage.events ?? [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const ordinalOf = new Map(events.map((e, i) => [e.candidateId, i + 1]));
  const runNumberOf = (e: ParameterLineageEvent) => runById.get(e.extractionRunId)?.run_number ?? null;

  const rows: LineageRow[] = events.map((event, i) => {
    const previous = i > 0 ? events[i - 1] : null;
    const run = runById.get(event.extractionRunId);
    const resolver = events.find((e) => e.flag?.resolvedByCandidateId === event.candidateId);
    const target = event.flag?.resolvedByCandidateId ? events.find((e) => e.candidateId === event.flag!.resolvedByCandidateId) : undefined;
    const resolvesFlag = resolver?.flag ? { flag: resolver.flag, fromOrdinal: ordinalOf.get(resolver.candidateId)! } : null;
    return {
      event,
      ordinal: i + 1,
      runNumber: run?.run_number ?? null,
      runType: run?.extraction_type ?? null,
      previous,
      valueChange: !previous ? 'first' : sameValue(previous.value, event.value) ? 'same' : 'changed',
      unitChanged: !!previous && (previous.unit ?? '') !== (event.unit ?? ''),
      resolvesFlag,
      flagCarriedOver: isCarriedOver(event.flag, resolvesFlag?.flag ?? null),
      resolvedBy: target ? { ordinal: ordinalOf.get(target.candidateId)!, runNumber: runNumberOf(target) } : null,
    };
  });

  return {
    parameterKey: lineage.parameterKey,
    finalValue: lineage.finalValue,
    reviewAction: lineage.reviewAction,
    isAiAccepted: lineage.isAiAccepted,
    rows,
    runCount: new Set(events.map((e) => e.extractionRunId)).size,
  };
}

export interface SummaryTotals {
  parameters: number;
  withFlags: number;
  totalFlags: number;
  /** More than one candidate: extracted again at least once. */
  reExtracted: number;
  humanModified: number;
  aiAccepted: number;
}

export function summaryTotals(rows: ProjectSummary[]): SummaryTotals {
  return {
    parameters: rows.length,
    withFlags: rows.filter((r) => r.totalFlags > 0).length,
    totalFlags: rows.reduce((n, r) => n + r.totalFlags, 0),
    reExtracted: rows.filter((r) => r.totalCandidates > 1).length,
    humanModified: rows.filter((r) => r.isHumanModified).length,
    aiAccepted: rows.filter((r) => r.isAiAccepted).length,
  };
}

export function filterSummary(
  rows: ProjectSummary[],
  { query = '', flaggedOnly = false, reExtractedOnly = false }: { query?: string; flaggedOnly?: boolean; reExtractedOnly?: boolean },
): ProjectSummary[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.parameterKey.toLowerCase().includes(q)) &&
      (!flaggedOnly || r.totalFlags > 0) &&
      (!reExtractedOnly || r.totalCandidates > 1),
  );
}
