import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusNotAppliedError, changeProjectStatus } from '@/lib/project-data/actions';
import { projectsIndex } from '@/lib/project-data/projects-index';
import type { ProjectBase } from '@/api/types/projects';

const base: ProjectBase = {
  id: 'p-1', alias_id: 'P', description: null, customer: null, status: 'NEW',
  created_at: '2026-10-10T00:00:00Z', source_template_id: null, customer_id: null,
};

/** A backend whose status route answers 200, and whose project then reports `reportedStatus`. */
function stubBackend(reportedStatus: string) {
  const calls: { url: string; method: string; type: string | null; body: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', type: new Headers(init?.headers).get('content-type'), body: String(init?.body ?? '') });
    if (init?.method === 'POST') return new Response(JSON.stringify({ message: 'Project status updated successfully' }), { status: 200 });
    return new Response(JSON.stringify({ ...base, status: reportedStatus, documents: [], parameters: [] }), { status: 200 });
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  projectsIndex.reset();
});

describe('changeProjectStatus (proposed B22: the backend answers 200 without writing)', () => {
  it('posts a form-encoded body', async () => {
    const calls = stubBackend('IN_REVIEW');
    await changeProjectStatus('p-1', 'IN_REVIEW');
    expect(calls[0]).toMatchObject({ method: 'POST', type: 'application/x-www-form-urlencoded', body: 'project_id=p-1&new_status=IN_REVIEW' });
  });

  it('does not claim success when the project still has the old status', async () => {
    stubBackend('NEW');
    projectsIndex.set([base]);
    await expect(changeProjectStatus('p-1', 'IN_REVIEW')).rejects.toBeInstanceOf(StatusNotAppliedError);
    expect(projectsIndex.getSnapshot().projects[0].status).toBe('NEW');
  });

  it('updates the project list only with the status the backend reports', async () => {
    stubBackend('IN_REVIEW');
    projectsIndex.set([base]);
    await changeProjectStatus('p-1', 'IN_REVIEW');
    expect(projectsIndex.getSnapshot().projects[0].status).toBe('IN_REVIEW');
  });
});
