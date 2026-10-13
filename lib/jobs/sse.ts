import type { SseEvent } from './sse-types';

/**
 * Reads a `text/event-stream` body and yields one decoded event per `data:`
 * frame.
 *
 * Replaces the two near-identical parsing loops that lived in
 * api/analyze-document.ts and api/analyze-parameter.ts. Differences from those:
 *
 * - it takes an AbortSignal, so a job can actually be stopped. Neither old
 *   loop could be cancelled, which is why navigating away left a stream
 *   running (explore-A 3.1 #17);
 * - it does not interpret statuses. Callers decide what each event means, so
 *   an unrecognised status is forwarded rather than silently dropped;
 * - a malformed frame is reported through `onParseError` instead of only
 *   reaching console.warn.
 */
export interface SseReadOptions {
  signal?: AbortSignal;
  onParseError?: (raw: string, error: unknown) => void;
}

export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
  options: SseReadOptions = {},
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // Aborting mid-read leaves the reader parked on a pending read(), so cancel
  // it explicitly rather than waiting for the response to end on its own.
  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      if (options.signal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. The trailing fragment is kept
      // for the next chunk: a multi-byte character or a long payload can be
      // split across reads.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed.startsWith('data:')) continue;

        const json = trimmed.slice(trimmed.indexOf(':') + 1).trim();
        if (!json) continue;

        try {
          yield JSON.parse(json) as SseEvent;
        } catch (error) {
          options.onParseError?.(json, error);
        }
      }
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

/** Opens a POST stream and returns its body, or throws with the backend's message. */
export async function openSseStream(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    // A 400 (no flagged metric, unknown parameter) carries a JSON body.
    let detail = `Stream failed to start (${response.status})`;
    try {
      const parsed = await response.json();
      detail = parsed?.error ?? parsed?.detail ?? detail;
    } catch {
      /* not JSON; keep the status-based message */
    }
    throw new Error(detail);
  }

  return response.body;
}
