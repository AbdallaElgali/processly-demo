import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, configureHttp, setRequestUser } from './apiFetch';
import { openSseStream } from '@/lib/jobs/sse';
import { uploadDocuments } from '@/api/upload-doc';
import { fetchDocumentFile } from '@/api/documents';

const USER = '11111111-1111-4111-8111-111111111111';

let calls: { url: string; init?: RequestInit }[];
let respond: (url: string) => Response;

beforeEach(() => {
  calls = [];
  respond = () => new Response('{}', { status: 200 });
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond(String(input));
  }));
  configureHttp({});
  setRequestUser(null);
});
afterEach(() => vi.unstubAllGlobals());

const header = (i: number) => new Headers(calls[i].init?.headers).get('X-User-Id');

describe('X-User-Id', () => {
  it('is sent on every request when a user is logged in', async () => {
    setRequestUser(USER);
    await apiFetch('http://api/projects/1');
    await apiFetch('http://api/projects/1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(header(0)).toBe(USER);
    expect(header(1)).toBe(USER);
    expect(new Headers(calls[1].init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('is not sent when logged out', async () => {
    await apiFetch('http://api/projects/1');
    expect(header(0)).toBeNull();
  });

  it('is not sent to login or register', async () => {
    setRequestUser(USER);
    await apiFetch('http://api/auth/user?username=a');
    await apiFetch('http://api/auth/register-user', { method: 'POST' });
    expect(header(0)).toBeNull();
    expect(header(1)).toBeNull();
  });

  it('is sent on streaming extraction requests', async () => {
    setRequestUser(USER);
    respond = () => new Response(new ReadableStream(), { status: 200 });
    await openSseStream('http://api/specs/stream-specs', { project_id: 'p' });
    expect(header(0)).toBe(USER);
    expect(new Headers(calls[0].init?.headers).get('Accept')).toBe('text/event-stream');
  });

  it('is sent on uploads, without touching the multipart content type', async () => {
    setRequestUser(USER);
    respond = () => new Response(JSON.stringify({ message: 'ok', results: [] }), { status: 200 });
    await uploadDocuments([new File(['x'], 'a.pdf')], 'p').catch(() => undefined);
    expect(calls[0].url).toContain('/files/upload-documents/');
    expect(header(0)).toBe(USER);
    expect(new Headers(calls[0].init?.headers).get('Content-Type')).toBeNull();
  });

  it('is sent when a document file is fetched for the viewer', async () => {
    setRequestUser(USER);
    respond = () => new Response(new Blob(['pdf']), { status: 200 });
    const result = await fetchDocumentFile('doc-1');
    expect(result.kind).toBe('ok');
    expect(header(0)).toBe(USER);
  });
});

describe('401 and 403', () => {
  it('401 tells the handler once per response and still returns the response', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ onUnauthorized });
    setRequestUser(USER);
    respond = () => new Response('{"detail":"X-User-Id names no known user"}', { status: 401 });
    const res = await apiFetch('http://api/projects/1');
    expect(res.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401 from login is not a session problem', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ onUnauthorized });
    respond = () => new Response('{}', { status: 401 });
    await apiFetch('http://api/auth/user?username=a');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('403 passes the backend detail text on, and the body stays readable', async () => {
    const onForbidden = vi.fn();
    configureHttp({ onForbidden });
    setRequestUser(USER);
    respond = () => new Response('{"detail":"Auditors can\'t change values"}', { status: 403 });
    const res = await apiFetch('http://api/projects/1/parameters', { method: 'PUT' });
    expect(onForbidden).toHaveBeenCalledWith("Auditors can't change values");
    expect((await res.json()).detail).toBe("Auditors can't change values");
  });

  it('403 without a detail still gives a sentence', async () => {
    const onForbidden = vi.fn();
    configureHttp({ onForbidden });
    respond = () => new Response('nope', { status: 403 });
    await apiFetch('http://api/x');
    expect(onForbidden).toHaveBeenCalledWith('You are not allowed to do that.');
  });

  it('a caller can ask for no 403 toast', async () => {
    const onForbidden = vi.fn();
    configureHttp({ onForbidden });
    respond = () => new Response('{"detail":"You are not a member of this project"}', { status: 403 });
    await apiFetch('http://api/x', { quiet403: true });
    expect(onForbidden).not.toHaveBeenCalled();
  });
});
