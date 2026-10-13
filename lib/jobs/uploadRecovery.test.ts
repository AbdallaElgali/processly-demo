import { describe, expect, it, vi } from 'vitest';
import {
  CHECKING_TEXT,
  NOT_SAVED_TEXT,
  RECOVERY_ATTEMPTS,
  RECOVERY_INTERVAL_MS,
  SAVED_AWAY_TEXT,
  checkUploadOutcome,
  interruptedUploadText,
  resendNotice,
  splitByDocuments,
} from './uploadRecovery';
import type { UploadCheck } from './types';

const files = (...names: string[]) => names.map((name) => ({ name }));

describe('splitByDocuments (a listed document is a fully processed one, U1)', () => {
  it('separates saved from missing by file name', () => {
    const r = splitByDocuments(files('a.pdf', 'b.xlsx', 'c.pdf'), [{ name: 'b.xlsx' }, { name: 'zzz.pdf' }]);
    expect(r.saved).toEqual(files('b.xlsx'));
    expect(r.missing).toEqual(files('a.pdf', 'c.pdf'));
  });
  it('treats everything as missing when the project has no documents', () => {
    expect(splitByDocuments(files('a.pdf'), []).missing).toEqual(files('a.pdf'));
  });
  it('keeps the original items, so Files can be passed through', () => {
    const f = { name: 'a.pdf', size: 3 };
    expect(splitByDocuments([f], []).missing[0]).toBe(f);
  });
  it('matches the whole name only', () => {
    expect(splitByDocuments(files('a.pdf'), [{ name: 'a.pdf.bak' }, { name: 'A.PDF' }]).missing).toHaveLength(1);
  });
});

describe('checkUploadOutcome', () => {
  const run = (fetches: Array<Array<{ name: string }> | Error>, names = ['a.pdf', 'b.pdf']) => {
    let i = 0;
    const fetchDocuments = vi.fn(async () => {
      const next = fetches[Math.min(i++, fetches.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    });
    const sleep = vi.fn(async () => undefined);
    return { fetchDocuments, sleep, result: checkUploadOutcome({ names, fetchDocuments, sleep }) };
  };

  it('finishes at once, without waiting, when every file is already listed', async () => {
    const { result, sleep, fetchDocuments } = run([[{ name: 'a.pdf' }, { name: 'b.pdf' }]]);
    expect(await result).toEqual({ saved: ['a.pdf', 'b.pdf'], missing: [], checked: true });
    expect(fetchDocuments).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it('polls while the server may still be processing and stops when the files show up', async () => {
    const { result, sleep, fetchDocuments } = run([[], [{ name: 'a.pdf' }], [{ name: 'a.pdf' }, { name: 'b.pdf' }]]);
    expect((await result).missing).toEqual([]);
    expect(fetchDocuments).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(RECOVERY_INTERVAL_MS);
  });
  it('gives up after the last attempt and reports what is still missing', async () => {
    const { result, fetchDocuments } = run([[{ name: 'a.pdf' }]]);
    expect(await result).toEqual({ saved: ['a.pdf'], missing: ['b.pdf'], checked: true });
    expect(fetchDocuments).toHaveBeenCalledTimes(RECOVERY_ATTEMPTS);
  });
  it('covers about 60 seconds', () => {
    expect((RECOVERY_ATTEMPTS - 1) * RECOVERY_INTERVAL_MS).toBeGreaterThanOrEqual(50_000);
    expect((RECOVERY_ATTEMPTS - 1) * RECOVERY_INTERVAL_MS).toBeLessThanOrEqual(70_000);
  });
  it('survives a failed fetch and keeps trying', async () => {
    const { result } = run([new Error('network'), [{ name: 'a.pdf' }, { name: 'b.pdf' }]]);
    expect((await result).missing).toEqual([]);
  });
  it('says "not checked" rather than "missing" when the server never answered', async () => {
    const { result } = run([new Error('network')]);
    expect(await result).toEqual({ saved: [], missing: ['a.pdf', 'b.pdf'], checked: false });
  });
  it('stops polling when told to', async () => {
    const ac = new AbortController();
    const fetchDocuments = vi.fn(async () => {
      ac.abort();
      return [];
    });
    const r = await checkUploadOutcome({ names: ['a.pdf'], fetchDocuments, sleep: async () => undefined, signal: ac.signal });
    expect(fetchDocuments).toHaveBeenCalledTimes(1);
    expect(r.checked).toBe(true);
  });
});

describe('texts', () => {
  it('has the wording the brief asks for', () => {
    expect(CHECKING_TEXT).toBe('Checking whether the server finished…');
    expect(SAVED_AWAY_TEXT).toBe('Saved while you were away');
    expect(NOT_SAVED_TEXT).toBe('Not saved. Upload again');
  });
  it('reads the check state', () => {
    expect(interruptedUploadText(undefined)).toBe(CHECKING_TEXT);
    expect(interruptedUploadText({ state: 'checking' })).toBe(CHECKING_TEXT);
    expect(interruptedUploadText({ state: 'missing', missing: ['a.pdf'], saved: 0 })).toBe(NOT_SAVED_TEXT);
    expect(interruptedUploadText({ state: 'missing', missing: ['b.pdf'], saved: 1 })).toBe(
      '1 file saved while you were away; 1 not saved. Upload again',
    );
    expect(interruptedUploadText({ state: 'unknown' })).toMatch(/could not check/i);
  });
  it('does not claim "nothing was saved" anywhere', () => {
    const checks: Array<UploadCheck | undefined> = [undefined, { state: 'checking' }, { state: 'unknown' }, { state: 'missing', missing: ['a'], saved: 0 }];
    for (const check of checks) {
      expect(interruptedUploadText(check)).not.toMatch(/nothing was saved/i);
    }
  });
});

describe('resendNotice (Run again must not duplicate a saved file)', () => {
  it('says how many are re-sent and how many are already there', () => {
    expect(resendNotice(2, 1)).toBe('Re-sending 1 file that is not in the project; 2 already saved.');
    expect(resendNotice(0, 3)).toBe('Re-sending 3 files that are not in the project.');
  });
  it('says nothing is re-sent when everything is there', () => {
    expect(resendNotice(2, 0)).toBe('All files are already in the project; nothing to re-send.');
  });
});
