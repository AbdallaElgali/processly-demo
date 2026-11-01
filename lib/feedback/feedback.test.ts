import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildFeedbackBody, projectIdFromPath, validateFeedback } from './payload';
import { submitFeedback } from '@/api/feedback';
import { SendFeedbackButton } from '@/components/feedback/SendFeedbackButton';

const PROJECT = '8b1f3c52-2f1e-4d6a-9d6e-0f3d1d2f9a11';
const USER = '1c0c5f58-6f5e-4a39-9a77-5d0e4b8f2b22';

describe('projectIdFromPath', () => {
  it('reads the project from a project route', () => {
    expect(projectIdFromPath(`/projects/${PROJECT}/workspace`)).toBe(PROJECT);
  });
  it('is null on pages outside a project', () => {
    expect(projectIdFromPath('/projects')).toBeNull();
    expect(projectIdFromPath('/admin')).toBeNull();
    expect(projectIdFromPath(null)).toBeNull();
  });
});

describe('buildFeedbackBody (the shape of POST /feedback/submit)', () => {
  it('sends general feedback with the user and project', () => {
    expect(buildFeedbackBody({ userId: USER, projectId: PROJECT, title: ' Slow ', description: ' It is slow. ' })).toEqual({
      user_id: USER,
      project_id: PROJECT,
      feedback_type: 'general',
      title: 'Slow',
      description: 'It is slow.',
      status: 'new',
    });
  });
  it('sends no title when it is empty', () => {
    expect(buildFeedbackBody({ userId: USER, projectId: PROJECT, title: '  ', description: 'x' }).title).toBeNull();
  });
  it('names the parameter in the type and metadata when opened from the review screen', () => {
    const body = buildFeedbackBody({ userId: USER, projectId: PROJECT, description: 'Wrong unit', parameter: { key: 'U_MIN', alias: 'Min voltage' } });
    expect(body.feedback_type).toBe('parameter');
    expect(body.metadata).toEqual({ parameter_key: 'U_MIN', parameter_alias: 'Min voltage' });
  });
});

describe('validateFeedback', () => {
  it('needs a project and some text', () => {
    expect(validateFeedback({ projectId: null, description: 'x' })).toMatch(/project/i);
    expect(validateFeedback({ projectId: PROJECT, description: '   ' })).toMatch(/write/i);
    expect(validateFeedback({ projectId: PROJECT, description: 'x' })).toBeNull();
  });
});

describe('submitFeedback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the body to /feedback/submit', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'ok', feedback_id: '7' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = buildFeedbackBody({ userId: USER, projectId: PROJECT, description: 'Hello' });
    await submitFeedback(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/feedback\/submit$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('throws the backend text when the server refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"nope"}', { status: 500 })));
    await expect(submitFeedback(buildFeedbackBody({ userId: USER, projectId: PROJECT, description: 'x' }))).rejects.toThrow('nope');
  });
});

describe('entry points', () => {
  it('the review screen button renders with its label', () => {
    const html = renderToStaticMarkup(createElement(SendFeedbackButton, { parameter: { key: 'U_MIN', alias: 'Min voltage' } }));
    expect(html).toContain('Send feedback');
    expect(html).toContain('aria-label="Send feedback about Min voltage"');
  });
});
