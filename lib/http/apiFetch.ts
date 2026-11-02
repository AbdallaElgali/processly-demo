/**
 * The one way to call the backend. It adds `X-User-Id` (the backend identifies
 * the caller by that header and, once roles are enforced, refuses every
 * request without it), and reports 401 and 403 to whoever configured the app.
 *
 * A test scans the source for a direct `fetch(` that bypasses this file.
 */

export const USER_STORAGE_KEY = 'bda_user';
const USER_HEADER = 'X-User-Id';
/** The two routes a caller may use before it has an identity. */
const SIGNED_OUT_PATHS = ['/auth/user', '/auth/register-user'];

export interface HttpHandlers {
  /** 401: the stored user is not valid any more. */
  onUnauthorized?: () => void;
  /** 403: the backend's own reason, ready to show. */
  onForbidden?: (detail: string) => void;
}

export interface ApiFetchInit extends RequestInit {
  /** The caller shows a 403 itself (e.g. "am I a member?"), so no toast. */
  quiet403?: boolean;
}

let memoryUserId: string | null | undefined; // undefined: not set, ask storage
let handlers: HttpHandlers = {};

/** Set by the auth context at sign-in and sign-out. */
export function setRequestUser(id: string | null): void {
  memoryUserId = id;
}

export function configureHttp(next: HttpHandlers): void {
  handlers = next;
}

function storedUserId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    const id = raw ? (JSON.parse(raw) as { id?: unknown }).id : null;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

export function currentUserId(): string | null {
  return memoryUserId === undefined ? storedUserId() : memoryUserId;
}

function pathOf(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return raw;
  }
}

async function detailOf(response: Response): Promise<string> {
  try {
    const body = JSON.parse(await response.clone().text());
    if (typeof body?.detail === 'string' && body.detail) return body.detail;
    if (typeof body?.error === 'string' && body.error) return body.error;
  } catch {
    /* not JSON */
  }
  return 'You are not allowed to do that.';
}

export async function apiFetch(input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> {
  const { quiet403, ...rest } = init;
  const signedOutRoute = SIGNED_OUT_PATHS.some((p) => pathOf(input).endsWith(p));
  const userId = currentUserId();
  const headers = new Headers(rest.headers);
  if (userId && !signedOutRoute && !headers.has(USER_HEADER)) headers.set(USER_HEADER, userId);

  const response = await fetch(input, { ...rest, headers });

  if (!signedOutRoute) {
    if (response.status === 401) handlers.onUnauthorized?.();
    else if (response.status === 403 && !quiet403) handlers.onForbidden?.(await detailOf(response));
  }
  return response;
}
