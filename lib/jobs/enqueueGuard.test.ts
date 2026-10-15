import { describe, expect, it } from 'vitest';
import { canEnqueue } from './ordering';
import type { Job } from './types';

const j = (id: string, kind: Job['kind'], status: Job['status'], projectId = 'p1'): Job => ({
  id, projectId, kind, status, createdAt: 1, phase: 'queued', events: [], warnings: [],
  progress: { categoriesDone: [], categoriesFailed: [] }, seen: false,
  payload:
    kind === 'upload'
      ? { kind: 'upload', fileRefs: [] }
      : kind === 'extraction'
        ? { kind: 'extraction', mode: 'BLIND', previousSpecs: null }
        : { kind: 'correction', parameterKey: 'U_MAX', previousMetrics: [], userHint: null },
});

describe('second extraction guard (checked where jobs are accepted, not only in the UI)', () => {
  it('refuses an extraction while one is queued or running for the project', () => {
    for (const status of ['queued', 'running'] as const) {
      const out = canEnqueue([j('a', 'extraction', status)], j('b', 'extraction', 'queued'));
      expect(out.allowed).toBe(false);
      expect('reason' in out && out.reason).toMatch(/already has an extraction/i);
    }
  });

  it('accepts one when the earlier extraction is finished, failed, cancelled or interrupted, or belongs to another project', () => {
    for (const status of ['completed', 'failed', 'cancelled', 'interrupted'] as const) {
      expect(canEnqueue([j('a', 'extraction', status)], j('b', 'extraction', 'queued')).allowed).toBe(true);
    }
    expect(canEnqueue([j('a', 'extraction', 'running', 'other')], j('b', 'extraction', 'queued')).allowed).toBe(true);
  });

  it('does not block uploads or corrections', () => {
    const busy = [j('a', 'extraction', 'running')];
    expect(canEnqueue(busy, j('u', 'upload', 'queued')).allowed).toBe(true);
    expect(canEnqueue(busy, j('c', 'correction', 'queued')).allowed).toBe(true);
  });

  it('a job already in the list is not refused because of itself', () => {
    const a = j('a', 'extraction', 'queued');
    expect(canEnqueue([a], a).allowed).toBe(true);
  });
});
