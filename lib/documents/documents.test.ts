import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '@/api/types/projects';
import type { InputField, Specification, SpecificationSource } from '@/types';
import { bboxToPageRect } from './pdfGeometry';
import { adjacentId, mayPrefetch, touchRecent } from './prefetch';
import { DocumentFileStore, documentMime } from './fileStore';
import { fieldAnchors } from '@/lib/review/anchors';

const A4: [number, number, number, number] = [0, 0, 595, 842];

describe('bboxToPageRect (PDF calibration, plan-A §8)', () => {
  // OpenDataLoader box [x0, y0, x1, y1] = [100, 700, 300, 742], bottom-left origin,
  // arrives from the adapter as {x: 100, y: 700, width: 200, height: 42}.
  const box = { x: 100, y: 700, width: 200, height: 42 };

  it('flips the y axis like the backend debug drawer (page_height - y1)', () => {
    const r = bboxToPageRect(box, A4)!;
    expect(r.left).toBeCloseTo(100 / 595);
    expect(r.top).toBeCloseTo((842 - 742) / 842);
    expect(r.width).toBeCloseTo(200 / 595);
    expect(r.height).toBeCloseTo(42 / 842);
  });

  it('honours a MediaBox whose origin is not (0, 0)', () => {
    const shifted = { x: 110, y: 720, width: 200, height: 42 };
    const r = bboxToPageRect(shifted, [10, 20, 605, 862])!;
    const plain = bboxToPageRect(box, A4)!;
    expect(r.left).toBeCloseTo(plain.left);
    expect(r.top).toBeCloseTo(plain.top);
  });

  it('rotates with the page (/Rotate 90, 180, 270)', () => {
    const r90 = bboxToPageRect(box, A4, 90)!;
    // Display is 842 wide; the box's top edge (100 pt from the top) becomes its right offset.
    expect(r90.left).toBeCloseTo((842 - 100 - 42) / 842);
    expect(r90.top).toBeCloseTo(100 / 595);
    expect(r90.width).toBeCloseTo(42 / 842);
    const r180 = bboxToPageRect(box, A4, 180)!;
    expect(r180.left).toBeCloseTo((595 - 300) / 595);
    expect(r180.top).toBeCloseTo((842 - 100 - 42) / 842);
    const r270 = bboxToPageRect(box, A4, 270)!;
    expect(r270.left).toBeCloseTo(100 / 842);
    expect(r270.top).toBeCloseTo((595 - 300) / 595);
  });

  it('accepts an inverted box and treats small numbers as points, not fractions', () => {
    const inverted = bboxToPageRect({ x: 300, y: 742, width: -200, height: -42 }, A4)!;
    expect(inverted.left).toBeCloseTo(100 / 595);
    const tiny = bboxToPageRect({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, A4)!;
    expect(tiny.width).toBeCloseTo(0.5 / 595);
  });

  it('returns null for a box off the page or with no numbers, so the page-level fallback shows', () => {
    expect(bboxToPageRect({ x: 700, y: 900, width: 10, height: 10 }, A4)).toBeNull();
    expect(bboxToPageRect({ x: Number.NaN, y: 0, width: 1, height: 1 }, A4)).toBeNull();
    expect(bboxToPageRect(null, A4)).toBeNull();
  });

  it('clips a box that overhangs the page edge', () => {
    const r = bboxToPageRect({ x: 500, y: 800, width: 200, height: 100 }, A4)!;
    expect(r.left + r.width).toBeCloseTo(1);
    expect(r.top).toBe(0);
  });
});

describe('prefetch budget and recents (AM12)', () => {
  it('always allows the first documents, then only while under budget', () => {
    expect(mayPrefetch(0, 999, { budget: 10, minDocs: 2 })).toBe(true);
    expect(mayPrefetch(1, 999, { budget: 10, minDocs: 2 })).toBe(true);
    expect(mayPrefetch(2, 9, { budget: 10, minDocs: 2 })).toBe(true);
    expect(mayPrefetch(2, 10, { budget: 10, minDocs: 2 })).toBe(false);
  });

  it('keeps the most recent first, capped, and returns the same array when unchanged', () => {
    const a = touchRecent([], 'x', 3);
    const b = touchRecent(a, 'y', 3);
    const c = touchRecent(touchRecent(b, 'z', 3), 'w', 3);
    expect(c).toEqual(['w', 'z', 'y']);
    expect(touchRecent(c, 'w', 3)).toBe(c);
    expect(touchRecent(c, 'y', 3)).toEqual(['y', 'w', 'z']);
  });

  it('moves to the next and previous document, wrapping', () => {
    const ids = ['a', 'b', 'c'];
    expect(adjacentId(ids, 'a', 1)).toBe('b');
    expect(adjacentId(ids, 'c', 1)).toBe('a');
    expect(adjacentId(ids, 'a', -1)).toBe('c');
    expect(adjacentId(ids, null, -1)).toBe('c');
    expect(adjacentId(['a'], 'a', 1)).toBeNull();
    expect(adjacentId([], null, 1)).toBeNull();
  });
});

const doc = (id: string, name = `${id}.pdf`, type = 'pdf'): ProjectDocument => ({
  id, name, type, path: '', analyzed: true, file_url: `/documents/${id}/file`,
});

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeStore(opts: { sizes?: Record<string, number>; missing?: string[]; failing?: string[]; budget?: number; minDocs?: number; concurrency?: number } = {}) {
  const fetched: string[] = [];
  const revoked: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const store = new DocumentFileStore({
    concurrency: opts.concurrency ?? 2,
    budget: opts.budget ?? 1000,
    minDocs: opts.minDocs ?? 1,
    maxProjects: 2,
    createUrl: (b) => `blob:${(b as Blob & { tag?: string }).tag ?? 'x'}`,
    revokeUrl: (u) => revoked.push(u),
    fetchFile: async (id) => {
      fetched.push(id);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await flush();
      inFlight -= 1;
      if (opts.failing?.includes(id)) throw new Error('HTTP 500');
      if (opts.missing?.includes(id)) return { kind: 'unavailable', status: 404 };
      const blob = new Blob([new Uint8Array(opts.sizes?.[id] ?? 10)]) as Blob & { tag?: string };
      blob.tag = id;
      return { kind: 'ok', blob };
    },
  });
  return { store, fetched, revoked, maxInFlight: () => maxInFlight };
}

async function settle() {
  for (let i = 0; i < 10; i += 1) await flush();
}

describe('DocumentFileStore (D7, AM12)', () => {
  it('a missing file is "unavailable" and does not stop the other documents (no more all-or-nothing)', async () => {
    const { store } = makeStore({ missing: ['b'], failing: ['c'] });
    store.focusProject('P');
    store.prefetch('P', [doc('a'), doc('b'), doc('c')]);
    await settle();
    expect(store.get('a').status).toBe('ready');
    expect(store.get('a').url).toBe('blob:a');
    expect(store.get('b').status).toBe('unavailable');
    expect(store.get('c').status).toBe('error');
  });

  it('never runs more than the concurrency limit in the background', async () => {
    const { store, maxInFlight } = makeStore({ concurrency: 2 });
    store.focusProject('P');
    store.prefetch('P', ['a', 'b', 'c', 'd', 'e'].map((id) => doc(id)));
    await settle();
    expect(maxInFlight()).toBe(2);
  });

  it('stops prefetching once the budget is spent, but opening a document still fetches it', async () => {
    const { store, fetched } = makeStore({ sizes: { a: 600, b: 600, c: 10 }, budget: 1000, minDocs: 1, concurrency: 1 });
    store.focusProject('P');
    store.prefetch('P', [doc('a'), doc('b'), doc('c')]);
    await settle();
    expect(fetched).toEqual(['a', 'b']);
    expect(store.get('c').status).toBe('idle');
    store.ensure('P', doc('c'));
    await settle();
    expect(store.get('c').status).toBe('ready');
  });

  it('releases the files of projects beyond the cache limit and revokes their URLs', async () => {
    const { store, revoked } = makeStore();
    store.focusProject('P1');
    store.ensure('P1', doc('a'));
    await settle();
    store.focusProject('P2');
    store.focusProject('P3');
    expect(store.get('a').status).toBe('idle');
    expect(revoked).toEqual(['blob:a']);
  });

  it('reset drops every file', async () => {
    const { store, revoked } = makeStore();
    store.focusProject('P');
    store.ensure('P', doc('a'));
    await settle();
    const before = store.getSnapshot();
    store.reset();
    expect(store.get('a').status).toBe('idle');
    expect(revoked).toEqual(['blob:a']);
    expect(store.getSnapshot()).not.toBe(before);
  });

  it('routes by the backend type first, then by file name', () => {
    expect(documentMime({ name: 'x.bin', type: 'pdf' })).toBe('application/pdf');
    expect(documentMime({ name: 'Operating Window.xlsm', type: '' })).toContain('spreadsheetml');
    expect(documentMime({ name: 'a.xlsx', type: 'excel' })).toContain('spreadsheetml');
  });
});

const src = (p: Partial<SpecificationSource>): SpecificationSource => ({
  documentId: 'd1', textSnippet: null, reason: null, pageNumber: null, boundingBox: null, tableName: null, cellCoordinates: null, ...p,
});
const spec = (id: string, source: SpecificationSource | null): Specification => ({
  id, candidateId: id, value: '1', confidence: 90, unit: 'V', source, calculated: false, rule_passed: true, rule_violations: [], requires_review: false,
});
const fieldWith = (specs: Specification[], selected?: string): InputField => ({
  id: 'U_MIN', dbId: 'x', label: 'U_MIN', specifications: specs, selectedSpecId: selected, isFlagged: false, flagReason: null, activeFlagId: null, reviewAction: 'PENDING',
});

describe('fieldAnchors (anchor 1 of N, CFC)', () => {
  it('lists distinct locations across candidates, the selected one first', () => {
    const f = fieldWith(
      [
        spec('s1', src({ pageNumber: 2, boundingBox: { x: 1, y: 2, width: 3, height: 4 } })),
        spec('s2', src({ pageNumber: 3, boundingBox: { x: 1, y: 2, width: 3, height: 4 } })),
        spec('s3', src({ pageNumber: 2, boundingBox: { x: 1, y: 2, width: 3, height: 4 } })),
      ],
      's2',
    );
    const anchors = fieldAnchors(f);
    expect(anchors.map((a) => a.specId)).toEqual(['s2', 's1']);
    expect(anchors[0].selected).toBe(true);
  });

  it('skips candidates with no location at all', () => {
    const f = fieldWith([spec('s1', null), spec('s2', src({ documentId: null })), spec('s3', src({ pageNumber: 1 }))]);
    expect(fieldAnchors(f).map((a) => a.specId)).toEqual(['s3']);
  });
});
