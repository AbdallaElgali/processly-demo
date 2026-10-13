/**
 * The text to show for a failed `POST /files/upload-documents/`.
 *
 * The backend (U1) sends `{detail, message}` with the same text, naming the
 * step and the exception ("grouping failed: TimeoutError: ..."). Other bodies
 * (a FastAPI validation list, a plain-text 500) are read too, so the generic
 * "Failed to upload batch" never hides a reason that was sent.
 */
export function uploadErrorText(status: number, body: string): string {
  const fallback = `Upload failed (HTTP ${status}).`;
  const trimmed = body.trim();
  if (!trimmed) return fallback;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const o = parsed as { detail?: unknown; message?: unknown; error?: unknown };
      for (const candidate of [o.detail, o.message, o.error]) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
      }
      if (Array.isArray(o.detail)) {
        const msg = (o.detail[0] as { msg?: unknown } | undefined)?.msg;
        if (typeof msg === 'string') return msg;
      }
      return fallback;
    }
  } catch {
    /* not JSON: show it as written */
  }
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
}
