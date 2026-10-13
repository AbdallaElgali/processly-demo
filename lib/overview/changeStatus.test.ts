import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusNotAppliedError, changeProjectStatus } from '@/lib/project-data/actions';
import { errorMessage } from '@/lib/errors';
import { projectsIndex } from '@/lib/project-data/projects-index';
import type { ProjectBase } from '@/api/types/projects';

const base: ProjectBase = {
  id: 'p-1', alias_id: 'P', description: null, customer: null, status: 'NEW',
  created_at: '2026-10-10T00:00:00Z', source_template_id: null, customer_id: null,
};

/** A backend whose status route answers 200 with the status it stored (step 3.1). */
function stubBackend(storedStatus: string) {
  const calls: { url: string; method: string; type: string | null; body: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', type: new Headers(init?.headers).get('content-type'), body: String(init?.body ?? '') });
    if (init?.method === 'POST') return new Response(JSON.stringify({ message: 'Project status updated successfully', status: storedStatus }), { status: 200 });
    return new Response(JSON.stringify({ ...base, status: storedStatus, documents: [], parameters: [] }), { status: 200 });
  }));
  return calls;
}

/** A backend whose status route fails with FastAPI's error body. */
function stubFailure(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  projectsIndex.reset();
});

describe('changeProjectStatus (backend step 3.1: the route returns the stored status)', () => {
  it('posts a form-encoded body', async () => {
    const calls = stubBackend('IN_REVIEW');
    await changeProjectStatus('p-1', 'IN_REVIEW');
    expect(calls[0]).toMatchObject({ method: 'POST', type: 'application/x-www-form-urlencoded', body: 'project_id=p-1&new_status=IN_REVIEW' });
  });

  it('puts the status the route returned into the project list', async () => {
    stubBackend('IN_REVIEW');
    projectsIndex.set([base]);
    await changeProjectStatus('p-1', 'IN_REVIEW');
    expect(projectsIndex.getSnapshot().projects[0].status).toBe('IN_REVIEW');
  });

  it('does not claim success when the returned status is not the requested one', async () => {
    stubBackend('NEW');
    projectsIndex.set([base]);
    await expect(changeProjectStatus('p-1', 'IN_REVIEW')).rejects.toBeInstanceOf(StatusNotAppliedError);
    expect(projectsIndex.getSnapshot().projects[0].status).toBe('NEW');
  });

  it('shows the backend text on 404', async () => {
    stubFailure(404, { detail: 'Project not found' });
    await expect(changeProjectStatus('p-1', 'IN_REVIEW')).rejects.toSatisfy((e: unknown) => errorMessage(e) === 'Project not found');
  });

  it('shows the backend text on 422', async () => {
    stubFailure(422, { detail: [{ loc: ['body', 'new_status'], msg: "Input should be 'NEW', 'PENDING_REVIEW', 'IN_REVIEW' or 'APPROVED'", type: 'enum' }] });
    await expect(changeProjectStatus('p-1', 'IN_REVIEW')).rejects.toSatisfy((e: unknown) => errorMessage(e).startsWith('Input should be'));
  });
});
