import { describe, expect, it } from 'vitest';
import type { InputField, Specification } from '@/types';
import { reviewedPercent, reviewProgress } from './progress';
import { approvalCheck } from '@/lib/review/approval';
import { PROJECT_STATUSES, isProjectStatus, statusFormBody } from './status';
import { COMPACT_KEY, REVIEW_FIRST_KEY } from '@/lib/review/preferences';

const spec = (over: Partial<Specification> = {}): Specification => ({
  id: 's1',
  candidateId: 's1',
  value: '4.2',
  confidence: 95,
  unit: 'V',
  source: null,
  calculated: false,
  rule_passed: true,
  rule_violations: [],
  requires_review: false,
  ...over,
});

const field = (over: Partial<InputField> = {}, specs: Specification[] = [spec()]): InputField => ({
  id: 'U_MAX',
  dbId: 'pp-1',
  label: 'U_MAX',
  specifications: specs,
  selectedSpecId: specs[0]?.id,
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
  ...over,
});

describe('reviewProgress (step 12, B10)', () => {
  it('puts every parameter in exactly one bucket, so the four add up to the total', () => {
    const fields = [
      field({ id: 'A', reviewAction: 'ACCEPTED' }),
      field({ id: 'B', reviewAction: 'PENDING' }),
      field({ id: 'C', reviewAction: 'MODIFIED' }),
      field({ id: 'D', isFlagged: true, reviewAction: 'ACCEPTED' }),
      field({ id: 'E' }, []),
      field({ id: 'F' }, [spec({ value: '', candidateId: 'x', id: 'x' })]),
    ];
    const p = reviewProgress(fields);
    expect(p).toMatchObject({ total: 6, reviewed: 2, pending: 1, flagged: 1, empty: 2 });
    expect(p.reviewed + p.pending + p.flagged + p.empty).toBe(p.total);
  });

  it('counts an open flag as flagged even when the row is also accepted or empty', () => {
    const p = reviewProgress([
      field({ id: 'A', isFlagged: true, reviewAction: 'ACCEPTED' }),
      field({ id: 'B', isFlagged: true }, [spec({ value: '' })]),
    ]);
    expect(p).toMatchObject({ flagged: 2, reviewed: 0, empty: 0 });
  });

  it('does not let Approve change anything but review_action: an approved row is reviewed, whatever the project status', () => {
    expect(reviewProgress([field({ reviewAction: 'ACCEPTED' })]).reviewed).toBe(1);
  });

  it('counts ACCEPTED, MODIFIED and REJECTED as reviewed and only PENDING as pending (F0b)', () => {
    const p = reviewProgress([
      field({ id: 'A', reviewAction: 'ACCEPTED' }),
      field({ id: 'B', reviewAction: 'MODIFIED' }),
      field({ id: 'C', reviewAction: 'REJECTED' }),
      field({ id: 'D', reviewAction: 'PENDING' }),
    ]);
    expect(p).toMatchObject({ reviewed: 3, pending: 1 });
  });

  it('agrees with the Approve gate on what is pending (one rule)', () => {
    const fields = ['ACCEPTED', 'MODIFIED', 'REJECTED', 'PENDING', 'PENDING'].map((reviewAction, i) =>
      field({ id: `F${i}`, reviewAction: reviewAction as InputField['reviewAction'] }),
    );
    expect(reviewProgress(fields).pending).toBe(approvalCheck(fields, { unsaved: 0, jobBusy: false }).pending);
  });

  it('counts out-of-bounds rows as a warning on top of the buckets, never as a bucket', () => {
    const p = reviewProgress([
      field({ id: 'A' }, [spec({ rule_violations: ['above max'] })]),
      field({ id: 'B', reviewAction: 'ACCEPTED' }, [spec({ rule_violations: ['below min'] })]),
    ]);
    expect(p.outOfBounds).toBe(2);
    expect(p.reviewed + p.pending + p.flagged + p.empty).toBe(2);
  });

  it('handles a project with no parameters', () => {
    const p = reviewProgress([]);
    expect(p).toEqual({ total: 0, reviewed: 0, pending: 0, flagged: 0, empty: 0, outOfBounds: 0 });
    expect(reviewedPercent(p)).toBe(0);
  });
});

describe('reviewedPercent', () => {
  it('rounds down, so 100 means every parameter', () => {
    expect(reviewedPercent({ total: 3, reviewed: 2, pending: 1, flagged: 0, empty: 0, outOfBounds: 0 })).toBe(66);
    expect(reviewedPercent({ total: 3, reviewed: 3, pending: 0, flagged: 0, empty: 0, outOfBounds: 0 })).toBe(100);
  });
});

describe('project status change', () => {
  it('offers the four database statuses in lifecycle order', () => {
    expect(PROJECT_STATUSES).toEqual(['NEW', 'PENDING_REVIEW', 'IN_REVIEW', 'APPROVED']);
    expect(isProjectStatus('APPROVED')).toBe(true);
    expect(isProjectStatus('DONE')).toBe(false);
  });

  it('encodes the body as a form, with the two fields the route declares', () => {
    const body = statusFormBody('p-1', 'IN_REVIEW');
    expect(body.toString()).toBe('project_id=p-1&new_status=IN_REVIEW');
  });
});

describe('review preference keys', () => {
  it('keep the localStorage keys the Workspace already used, so saved choices survive', () => {
    expect(COMPACT_KEY).toBe('bda.workspace.compact');
    expect(REVIEW_FIRST_KEY).toBe('bda.workspace.reviewFirst');
  });
});
