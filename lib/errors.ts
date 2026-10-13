/**
 * Turns whatever an `api/` wrapper threw into one readable sentence.
 *
 * Most wrappers throw `new Error(await response.text())`, so the message is
 * the backend's raw JSON body, e.g. `{"detail":"Failed to ...: duplicate key"}`.
 * Show the `detail` rather than the braces.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed?.detail)) {
      const first = parsed.detail[0];
      if (typeof first?.msg === 'string') return first.msg;
    }
  } catch {
    /* not JSON: use it as written */
  }
  return raw;
}
