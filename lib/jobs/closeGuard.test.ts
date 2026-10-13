import { describe, expect, it, vi } from 'vitest';
import { KEEP_TAB_OPEN_TEXT, closeWarningHandler, hasRunningAnalysis } from './closeGuard';
import type { Job } from './types';

const job = (kind: Job['kind'], status: Job['status']) => ({ id: `${kind}-${status}`, kind, status }) as Job;

describe('hasRunningAnalysis (backend X3: closing the tab cancels a running analysis)', () => {
  it('is false with no jobs', () => {
    expect(hasRunningAnalysis([])).toBe(false);
  });
  it('is true while an extraction or a correction runs', () => {
    expect(hasRunningAnalysis([job('extraction', 'running')])).toBe(true);
    expect(hasRunningAnalysis([job('upload', 'completed'), job('correction', 'running')])).toBe(true);
  });
  it('ignores queued, finished, failed, interrupted and cancelled jobs', () => {
    for (const status of ['queued', 'completed', 'failed', 'interrupted', 'cancelled'] as const) {
      expect(hasRunningAnalysis([job('extraction', status), job('correction', status)])).toBe(false);
    }
  });
  it('ignores a running upload: the upload request is not an analysis stream', () => {
    expect(hasRunningAnalysis([job('upload', 'running')])).toBe(false);
  });
});

describe('closeWarningHandler', () => {
  const event = () => ({ preventDefault: vi.fn(), returnValue: undefined as unknown }) as unknown as BeforeUnloadEvent;

  it('asks before the tab closes while an analysis runs', () => {
    const e = event();
    closeWarningHandler(() => [job('extraction', 'running')])(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.returnValue).toBe('');
  });
  it('stays silent when nothing runs', () => {
    const e = event();
    closeWarningHandler(() => [job('extraction', 'completed')])(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(e.returnValue).toBeUndefined();
  });
  it('reads the jobs when the event fires, not when the handler was made', () => {
    let jobs: Job[] = [];
    const handler = closeWarningHandler(() => jobs);
    jobs = [job('correction', 'running')];
    const e = event();
    handler(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });
});

it('has the short line the indicator shows', () => {
  expect(KEEP_TAB_OPEN_TEXT).toBe('Keep this tab open until the analysis finishes');
});
