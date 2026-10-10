import type { FlagDetail, ParameterLineageEvent, ParameterLineageResponse, ProjectSummary } from '@/types/audit';
import type { ExtractionRun } from '@/api/types/projects';

/**
 * The backend's `flag_type` column is `AI_CORRETION` (sic) or `HUMAN_REVIEW`.
 * Shown as Auto and Human. CAUTION (proposed B23): the backend writes
 * `AI_CORRETION` for every flag it creates, including those a person raises
 * in the Workspace, and never writes `HUMAN_REVIEW`, so "Auto" here does not
 * prove a machine raised the flag.
 */
export function flagTypeLabel(type: string | null | undefined): string {
  if (type === 'AI_CORRETION') return 'Auto';
  if (type === 'HUMAN_REVIEW') return 'Human';
  return type ? type : 'Unknown';
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
    return {
      event,
      ordinal: i + 1,
      runNumber: run?.run_number ?? null,
      runType: run?.extraction_type ?? null,
      previous,
      valueChange: !previous ? 'first' : sameValue(previous.value, event.value) ? 'same' : 'changed',
      unitChanged: !!previous && (previous.unit ?? '') !== (event.unit ?? ''),
      resolvesFlag: resolver?.flag ? { flag: resolver.flag, fromOrdinal: ordinalOf.get(resolver.candidateId)! } : null,
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
