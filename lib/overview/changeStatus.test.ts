import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeProjectStatus } from '@/lib/project-data/actions';
import { errorMessage } from '@/lib/errors';
import { projectsIndex } from '@/lib/project-data/projects-index';
import type { ProjectBase } from '@/api/types/projects';

// The manual override (contract item 3). The wider flow (user_id, re-read, errors)
// is covered in lib/approvals/flow.test.ts; this file keeps the list-update and
// form-encoding checks that lived here before the status became automatic.

const base: ProjectBase = {
  id: 'p-1', alias_id: 'P', description: null, customer: null, status: 'NEW',
  created_at: '2026-10-10T00:00:00Z', source_template_id: null, customer_id: null,
};

function stubBackend(storedStatus: string) {
  const calls: { url: string; method: string; type: string | null; body: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', type: new Headers(init?.headers).get('content-type'), body: String(init?.body ?? '') });
    if (init?.method === 'POST') return new Response(JSON.stringify({ message: 'Project status updated successfully', status: storedStatus, previous_status: 'NEW' }), { status: 200 });
    return new Response(JSON.stringify({ ...base, status: storedStatus, documents: [], parameters: [] }), { status: 200 });
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  projectsIndex.reset();
});

describe('changeProjectStatus (manual override)', () => {
  it('posts a form-encoded body', async () => {
    const calls = stubBackend('IN_REVIEW');
    await changeProjectStatus('p-1', 'IN_REVIEW', 'u-1');
    expect(calls[0]).toMatchObject({ method: 'POST', type: 'application/x-www-form-urlencoded', body: 'project_id=p-1&new_status=IN_REVIEW&user_id=u-1' });
  });

  it('the project list shows the status of the re-read project', async () => {
    stubBackend('IN_REVIEW');
    projectsIndex.set([base]);
    await changeProjectStatus('p-1', 'IN_REVIEW', 'u-1');
    expect(projectsIndex.getSnapshot().projects[0].status).toBe('IN_REVIEW');
  });

  it('shows the backend text on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Project not found' }), { status: 404 })));
    await expect(changeProjectStatus('p-1', 'IN_REVIEW', 'u-1')).rejects.toSatisfy((e: unknown) => errorMessage(e) === 'Project not found');
  });
});
