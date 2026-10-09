/**
 * SSE event shapes for /specs/stream-specs and /specs/stream-parameter.
 *
 * These are HAND-WRITTEN and must stay that way for now: streaming responses
 * are invisible to OpenAPI, so `openapi.json` says nothing about them
 * (RFC 5.1). They were read off the backend's own emitters in
 * `BDA/src/engine/orchestrator.py` and `BDA/src/api_routes/extract_specs.py`
 * rather than guessed. RFC 5 P0 proposes Pydantic models for these; when that
 * lands in Task B, generated types replace this file.
 *
 * Only `error` and `complete` are terminal (CLAUDE.md 4).
 */

/** Statuses the blind-extraction and iterative-correction stream can emit. */
export type SpecsStreamStatus =
  | 'error'
  | 'routing_truncated'
  | 'routing_complete'
  | 'no_frames_tagged'
  | 'category_extraction_fallback'
  | 'workers_complete'
  | 'category_workers_failed'
  | 'partial'
  | 'partial_correction'
  | 'complete';

/** Additional statuses only the single-parameter correction stream emits. */
export type ParameterStreamStatus =
  | SpecsStreamStatus
  | 'targeting'
  | 'ready_to_save';

export type SseStatus = SpecsStreamStatus | ParameterStreamStatus;

/**
 * One decoded `data:` frame.
 *
 * Every field beyond `status` is optional on purpose: the backend forwards
 * statuses verbatim and may add more, and a frontend that throws on an
 * unrecognised shape would turn a new backend status into a broken run. The
 * reader keeps unknown statuses as-is and the reducer ignores them.
 */
export interface SseEvent {
  status: SseStatus | (string & {});

  /** error */
  message?: string;

  /** routing_truncated */
  total_tagged?: number;
  cap?: number;
  kept?: number;

  /** routing_complete */
  assignments?: unknown;

  /** category_extraction_fallback */
  planned_calls?: number;
  limit?: number;

  /** workers_complete */
  worker_count?: number;
  results_with_specs?: number;

  /** category_workers_failed */
  categories?: string[];

  /** partial */
  category?: string;
  specs?: Record<string, unknown>;

  /** partial_correction, targeting, ready_to_save, single-parameter complete/error */
  parameter?: string;
  frame_count?: number;

  /** complete, ready_to_save */
  final_specs?: Record<string, unknown>;

  /** complete. Maps the flag id we SENT to the successor the backend opened. */
  flag_chain?: Record<string, string>;

  /** complete, single-parameter path only */
  scope?: string;

  /** ready_to_save */
  model_name?: string | null;
  reasoning_effort?: string | null;
  temperature?: number | null;

  /**
   * Not emitted today. RFC 5 P0 adds a run id to the first event so a refresh
   * can reconnect; the store already reads it so Task B needs no change here.
   */
  run_id?: string;
}

export const isTerminal = (status: string): boolean =>
  status === 'complete' || status === 'error';

/**
 * The visible pipeline (RFC 3). Warnings are flags on the job, not phases:
 * `routing_truncated`, `no_frames_tagged`, `category_extraction_fallback` and
 * `category_workers_failed` are all non-terminal and must not look like errors.
 */
export type TimelinePhase =
  | 'queued'
  | 'uploading'
  | 'analyzing'
  | 'routing'
  | 'routed'
  | 'extracting'
  | 'supervising'
  | 'done'
  | 'failed';

/** Statuses that are warnings rather than progress. */
export const WARNING_STATUSES: ReadonlySet<string> = new Set([
  'routing_truncated',
  'no_frames_tagged',
  'category_extraction_fallback',
  'category_workers_failed',
]);

/**
 * Advance the phase for one event. Returns null when the event carries no
 * phase change (a warning, or an unknown future status).
 *
 * Deliberately total: any unrecognised status maps to null rather than
 * throwing, so a backend that grows a new status degrades to "no visible
 * phase change" instead of a failed run.
 */
export function phaseForEvent(status: string, current: TimelinePhase): TimelinePhase | null {
  switch (status) {
    case 'routing_complete':
      return 'routed';
    case 'workers_complete':
      return 'supervising';
    case 'partial':
    case 'partial_correction':
      // A category landed. During a correction there is no routing phase, so
      // this is also the first sign of progress.
      return current === 'supervising' ? 'supervising' : 'extracting';
    case 'targeting':
      return 'extracting';
    case 'complete':
      return 'done';
    case 'error':
      return 'failed';
    default:
      return null;
  }
}
