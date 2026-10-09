import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDataStore } from './store';
import type { InputField } from '@/types';

/**
 * The D11 regression.
 *
 * The bug: `fields` was a single array owned by the page. A run started on
 * project A kept writing through the page's setters, so after the user
 * switched to project B, A's candidates landed in B's rows --
 * `handlePopulateExtractedData` matched by parameter_key, so any two projects
 * sharing a template cross-contaminated silently, and `applyFlagChain` then
 * rewrote B's flag ids.
 *
 * These tests pin the property that makes that impossible: every write is
 * addressed by projectId.
 */

const field = (over: Partial<InputField> & { id: string }): InputField => ({
  dbId: `db-${over.id}`,
  label: over.id,
  specifications: [],
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
  ...over,
});

/** Shaped like one entry of the backend's streamed spec map. */
const candidate = (id: string, value: number, confidence: number) => ({
  id,
  value,
  unit: 'V',
  confidence,
  source: null,
});

let store: ProjectDataStore;
beforeEach(() => {
  store = new ProjectDataStore();
});

describe('results are addressed by project', () => {
  it("does not let project A's results touch project B", () => {
    // Both projects use the same template, so they share parameter keys --
    // precisely the case that used to cross-contaminate.
    store.setFields('A', [field({ id: 'U_MIN' })]);
    store.setFields('B', [field({ id: 'U_MIN' })]);

    store.applySpecs('A', { U_MIN: [candidate('cand-a', 2.5, 0.9)] });

    expect(store.get('A').fields[0].specifications).toHaveLength(1);
    expect(store.get('A').fields[0].specifications[0].value).toBe('2.5');
    // B must be untouched.
    expect(store.get('B').fields[0].specifications).toHaveLength(0);
    expect(store.get('B').fields[0].selectedSpecId).toBeUndefined();
  });

  it("does not let project A's flag chain rewrite project B's flag ids", () => {
    store.setFields('A', [field({ id: 'U_MIN', activeFlagId: 'flag-1' })]);
    store.setFields('B', [field({ id: 'U_MIN', activeFlagId: 'flag-1' })]);

    store.applyFlagChain('A', { 'flag-1': 'flag-2' });

    expect(store.get('A').fields[0].activeFlagId).toBe('flag-2');
    expect(store.get('B').fields[0].activeFlagId).toBe('flag-1');
  });

  it('writing to an unknown project cannot disturb a known one', () => {
    store.setFields('A', [field({ id: 'U_MIN' })]);
    store.applySpecs('C', { U_MIN: [candidate('cand-c', 9.9, 0.9)] });
    expect(store.get('A').fields[0].specifications).toHaveLength(0);
  });

  it('keeps per-project loading and error state separate', () => {
    store.setLoading('A', 'details', true);
    store.setError('B', 'boom');
    expect(store.get('A').loading.details).toBe(true);
    expect(store.get('B').loading.details).toBe(false);
    expect(store.get('A').error).toBeNull();
    expect(store.get('B').error).toBe('boom');
  });
});

describe('candidate selection', () => {
  it('selects the highest-confidence candidate', () => {
    store.setFields('A', [field({ id: 'U_MIN' })]);
    store.applySpecs('A', {
      U_MIN: [candidate('low', 1, 0.2), candidate('high', 2, 0.95)],
    });
    const f = store.get('A').fields[0];
    expect(f.specifications[0].candidateId).toBe('high');
    expect(f.selectedSpecId).toBe(f.specifications[0].id);
  });

  it('preserves an existing selection by candidateId across a re-run', () => {
    store.setFields('A', [field({ id: 'U_MIN' })]);
    store.applySpecs('A', {
      U_MIN: [candidate('low', 1, 0.2), candidate('high', 2, 0.95)],
    });
    // The engineer picks the lower-confidence candidate.
    const low = store.get('A').fields[0].specifications.find((s) => s.candidateId === 'low')!;
    store.setFields('A', [{ ...store.get('A').fields[0], selectedSpecId: low.id }]);

    // A second run returns the same candidates; spec ids may be re-minted.
    store.applySpecs('A', {
      U_MIN: [candidate('high', 2, 0.95), candidate('low', 1, 0.2)],
    });

    const after = store.get('A').fields[0];
    const selected = after.specifications.find((s) => s.id === after.selectedSpecId);
    expect(selected?.candidateId).toBe('low');
  });

  it('lets a correction re-pick for a flagged field', () => {
    store.setFields('A', [field({ id: 'U_MIN', isFlagged: true })]);
    store.applySpecs('A', { U_MIN: [candidate('first', 1, 0.3)] });
    const first = store.get('A').fields[0];
    store.setFields('A', [{ ...first, selectedSpecId: first.specifications[0].id }]);

    store.applySpecs('A', {
      U_MIN: [candidate('first', 1, 0.3), candidate('corrected', 4, 0.99)],
    });

    const after = store.get('A').fields[0];
    const selected = after.specifications.find((s) => s.id === after.selectedSpecId);
    expect(selected?.candidateId).toBe('corrected');
  });

  it('leaves fields the response did not mention alone', () => {
    store.setFields('A', [field({ id: 'U_MIN' }), field({ id: 'U_MAX' })]);
    store.applySpecs('A', { U_MIN: [candidate('c', 1, 0.5)] });
    expect(store.get('A').fields[1].specifications).toHaveLength(0);
  });
});

describe('snapshot stability (useSyncExternalStore contract)', () => {
  it('returns the same object for a project with no state yet', () => {
    // A fresh object per call makes useSyncExternalStore throw
    // "getSnapshot should be cached to avoid an infinite loop" and spin the
    // render loop. This is the normal first-render case.
    expect(store.get('never-seen')).toBe(store.get('never-seen'));
  });

  it('returns the same object for an unchanged project', () => {
    store.setFields('A', [field({ id: 'U_MIN' })]);
    expect(store.get('A')).toBe(store.get('A'));
  });

  it('returns a new object only when that project actually changed', () => {
    store.setFields('A', [field({ id: 'U_MIN' })]);
    const before = store.get('A');
    store.setFields('B', [field({ id: 'U_MAX' })]);
    expect(store.get('A')).toBe(before); // B's change must not churn A
    store.setError('A', 'boom');
    expect(store.get('A')).not.toBe(before);
  });
});

describe('subscriptions', () => {
  it('notifies subscribers and bumps the version on a change', () => {
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    const before = store.getVersion();
    store.setFields('A', [field({ id: 'U_MIN' })]);
    expect(calls).toBe(1);
    expect(store.getVersion()).toBeGreaterThan(before);
  });

  it('reset clears every project, so another user sees nothing', () => {
    store.setFields('A', [field({ id: 'U_MIN' })]);
    store.reset();
    expect(store.get('A').fields).toHaveLength(0);
  });
});

describe('per-document view state (AM12)', () => {
  it('is kept per project and per document, merged on write, and silent', () => {
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.setDocumentView('A', 'doc1', { scale: 1.4, page: 3 });
    store.setDocumentView('A', 'doc1', { pageOffset: 0.5 });
    store.setDocumentView('B', 'doc1', { page: 9 });
    expect(store.getDocumentView('A', 'doc1')).toEqual({ scale: 1.4, page: 3, pageOffset: 0.5 });
    expect(store.getDocumentView('B', 'doc1')).toEqual({ page: 9 });
    expect(store.getDocumentView('A', 'doc2')).toBeUndefined();
    expect(calls).toBe(0);
  });

  it('remembers the open document per project and forgets everything on reset', () => {
    store.setActiveDocument('A', 'doc2');
    store.setDocumentView('A', 'doc2', { page: 2 });
    expect(store.getActiveDocument('A')).toBe('doc2');
    expect(store.getActiveDocument('B')).toBeUndefined();
    store.reset();
    expect(store.getActiveDocument('A')).toBeUndefined();
    expect(store.getDocumentView('A', 'doc2')).toBeUndefined();
  });
});
