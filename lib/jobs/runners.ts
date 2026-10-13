import { config } from '@/api/config';
import { uploadDocuments } from '@/api/upload-doc';
import { projectDataStore } from '@/lib/project-data/store';
import { PARTIAL_FLUSH_MS } from './config';
import { openSseStream, readSseStream } from './sse';
import { isTerminal, type SseEvent } from './sse-types';
import type { Job } from './types';

const API = config.api;

export interface RunContext {
  signal: AbortSignal;
  emit: (event: SseEvent) => void;
}

export interface RunOutcome {
  ok: boolean;
  error?: string;
  /** Per-file upload failures: the job completes, but with warnings. */
  warnings?: string[];
}

/**
 * Coalesces partial results so a fast stream cannot thrash React. The previous
 * implementation did this with a 120ms timeout; the behaviour is preserved,
 * but the target is now the owning project rather than the page.
 */
class PartialFlusher {
  private pending: Record<string, unknown> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly projectId: string) {}

  queue(specs: Record<string, unknown>) {
    this.pending = specs;
    if (this.timer !== null) return;
    this.timer = setTimeout(() => this.flush(), PARTIAL_FLUSH_MS);
  }

  flush() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;
    projectDataStore.applySpecs(this.projectId, this.pending);
    this.pending = null;
  }

  dispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}

/**
 * Drives one SSE run to its terminal event.
 *
 * Every result is written to `job.projectId`, never to a "current" project.
 * That is the D11 fix in practice.
 */
async function runStream(
  job: Job,
  url: string,
  body: unknown,
  ctx: RunContext,
): Promise<RunOutcome> {
  const flusher = new PartialFlusher(job.projectId);
  let lastError: string | null = null;
  let sawComplete = false;

  try {
    const stream = await openSseStream(url, body, ctx.signal);

    for await (const event of readSseStream(stream, { signal: ctx.signal })) {
      ctx.emit(event);

      if ((event.status === 'partial' || event.status === 'partial_correction') && event.specs) {
        flusher.queue(event.specs);
      } else if (event.status === 'complete' && event.final_specs) {
        // Land any queued partial first so the final result is not overwritten
        // by a stale flush, then apply the final specs and only then the flag
        // chain -- that order is required, see ProjectDataStore.applyFlagChain.
        flusher.flush();
        projectDataStore.applySpecs(job.projectId, event.final_specs);
        if (event.flag_chain) projectDataStore.applyFlagChain(job.projectId, event.flag_chain);
        sawComplete = true;
      } else if (event.status === 'error') {
        lastError = event.message ?? 'Unknown backend error';
      }

      if (isTerminal(event.status)) break;
    }
  } catch (error) {
    if (ctx.signal.aborted) return { ok: false, error: 'Cancelled.' };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    flusher.dispose();
    projectDataStore.clearLiveSpecs(job.projectId);
  }

  if (!sawComplete) {
    // The backend's terminal errors arrive INSTEAD of `complete`. Without
    // this the caller would see an empty success and show no failure.
    return { ok: false, error: lastError ?? 'The run ended without a result.' };
  }
  return { ok: true };
}

export async function runExtraction(job: Job, ctx: RunContext, userId: string): Promise<RunOutcome> {
  if (job.payload.kind !== 'extraction') throw new Error('runExtraction: wrong payload');

  const body: Record<string, unknown> = { current_user: { id: userId } };
  if (job.payload.previousSpecs) body.previous_specs = job.payload.previousSpecs;

  return runStream(
    job,
    `${API}/specs/stream-specs?project_id=${encodeURIComponent(job.projectId)}`,
    body,
    ctx,
  );
}

export async function runCorrection(job: Job, ctx: RunContext, userId: string): Promise<RunOutcome> {
  if (job.payload.kind !== 'correction') throw new Error('runCorrection: wrong payload');

  return runStream(
    job,
    `${API}/specs/stream-parameter?project_id=${encodeURIComponent(job.projectId)}`,
    {
      current_user: { id: userId },
      parameter: job.payload.parameterKey,
      previous_metrics: job.payload.previousMetrics,
      user_hint: job.payload.userHint,
    },
    ctx,
  );
}

/**
 * Uploads the job's files.
 *
 * Partial failures are warnings, not a failed job: if three of four files
 * landed, the project genuinely has three new documents. Only a total failure
 * fails the job. The old code dropped `errors` entirely, so a rejected file
 * was invisible.
 */
export async function runUpload(
  job: Job,
  ctx: RunContext,
  files: File[],
): Promise<RunOutcome> {
  if (job.payload.kind !== 'upload') throw new Error('runUpload: wrong payload');

  try {
    const response = await uploadDocuments(files, job.projectId, ctx.signal);
    const warnings = (response.errors ?? []).map((e) => `${e.filename}: ${e.error}`);

    if ((response.successful_uploads ?? []).length === 0) {
      return {
        ok: false,
        error: warnings.length > 0 ? warnings.join('; ') : 'No documents were accepted.',
      };
    }
    return { ok: true, warnings };
  } catch (error) {
    if (ctx.signal.aborted) return { ok: false, error: 'Cancelled.' };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
