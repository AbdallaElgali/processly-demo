import { describe, expect, it } from 'vitest';
import type { InputField, Specification } from '@/types';
import { inputFieldToParameterInput } from '@/lib/parameter-adapter';
import { ProjectDataStore } from '@/lib/project-data/store';
import type { FullProjectDetails } from '@/api/types/projects';
import { canRevert, editValue, mergeLocalEdits, revertValue, selectCandidate } from './edits';
import { approvalCheck, approveBlockReason } from './approval';
import { NO_REASONING, whyThisValue } from './why';
import { rowState } from './rowState';
import { REASON_SEARCHED_ABSENT } from './reasonCodes';

const spec = (over: Partial<Specification> = {}): Specification => ({
  id: 'c1',
  candidateId: 'c1',
  value: '2.29999999999999982',
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

describe('editing a value (step 10)', () => {
  it('keeps the extracted value as original, once, and marks the row modified', () => {
    const once = editValue(field(), '4.1', 'V');
    const twice = editValue(once, '4.15', 'V');
    const s = twice.specifications[0];
    expect(twice.reviewAction).toBe('MODIFIED');
    expect(s.value).toBe('4.15');
    expect(s.confidence).toBeNull();
    expect(s.original).toEqual({ value: '2.29999999999999982', unit: 'V', confidence: 95 });
  });

  it('Revert restores the exact extracted value, so Save writes it back unrounded (AM10)', () => {
    const reverted = revertValue(editValue(field(), '4.1', 'mV'));
    expect(reverted.reviewAction).toBe('PENDING');
    expect(canRevert(reverted)).toBe(false);
    const sent = inputFieldToParameterInput(reverted, 'u1');
    expect(sent.final_value).toBe(2.29999999999999982);
    expect(sent.final_unit).toBe('V');
    expect(sent.is_human_modified).toBe(false);
    expect(sent.selected_candidate_id).toBe('c1');
  });

  it('a value typed where there is no candidate has nothing to revert to', () => {
    const typed = editValue(field({}, []), '80', '%');
    expect(typed.specifications).toHaveLength(1);
    expect(typed.specifications[0].candidateId).toBeNull();
    expect(canRevert(typed)).toBe(false);
  });

  it('choosing another candidate drops the edit made on the previous one', () => {
    const f = field({}, [spec(), spec({ id: 'c2', candidateId: 'c2', value: '4.2' })]);
    const chosen = selectCandidate(editValue(f, '9', 'V'), 'c2');
    expect(chosen.selectedSpecId).toBe('c2');
    expect(chosen.reviewAction).toBe('PENDING');
    expect(chosen.specifications[0].value).toBe('2.29999999999999982');
    expect(chosen.specifications[0].original).toBeUndefined();
  });
});

describe('mergeLocalEdits: a background refresh keeps unsaved edits', () => {
  const server = [
    field({}, [spec(), spec({ id: 'c2', candidateId: 'c2', value: '4.2' }), spec({ id: 'c3', candidateId: 'c3', value: '4.25' })]),
    field({ id: 'U_MIN' }, [spec({ id: 'm1', candidateId: 'm1', value: '2.5' })]),
  ];

  it('returns the server rows untouched when nothing is dirty', () => {
    expect(mergeLocalEdits(server, [], new Set())).toBe(server);
  });

  it('re-applies an edited value on its candidate, and the chosen candidate, for dirty rows only', () => {
    const local = [editValue(selectCandidate(server[0], 'c2'), '4.19', 'V'), editValue(server[1], '9', 'V')];
    const merged = mergeLocalEdits(server, local, new Set(['U_MAX']));
    expect(merged[0].selectedSpecId).toBe('c2');
    const c2 = merged[0].specifications.find((s) => s.id === 'c2')!;
    expect(c2.value).toBe('4.19');
    expect(c2.original?.value).toBe('4.2');
    expect(merged[0].specifications).toHaveLength(3); // server candidates kept
    expect(merged[0].reviewAction).toBe('MODIFIED');
    expect(merged[1]).toBe(server[1]); // not dirty: the server wins
  });

  it('keeps a typed value with no candidate in front of the server candidates', () => {
    const typed = editValue(field({}, []), '80', '%');
    const merged = mergeLocalEdits(server, [typed], new Set(['U_MAX']));
    expect(merged[0].specifications[0].value).toBe('80');
    expect(merged[0].selectedSpecId).toBe(typed.specifications[0].id);
    expect(merged[0].specifications).toHaveLength(4);
  });

  it('takes the server row when the locally chosen candidate is gone', () => {
    const local = [selectCandidate(field({}, [spec(), spec({ id: 'gone', candidateId: 'gone' })]), 'gone')];
    expect(mergeLocalEdits(server, local, new Set(['U_MAX']))[0]).toBe(server[0]);
  });
});

describe('ProjectDataStore: dirty rows (step 10)', () => {
  const details = { parameters: [] } as unknown as FullProjectDetails;

  it('marks a row dirty on edit and keeps the edit through setDetails', () => {
    const store = new ProjectDataStore();
    store.setDetails('A', details, [field()]);
    store.updateField('A', 'U_MAX', (f) => editValue(f, '4.1', 'V'), { dirty: true });
    expect(store.get('A').dirty).toEqual(['U_MAX']);
    store.setDetails('A', details, [field()]); // e.g. a correction on another row finished
    expect(store.get('A').fields[0].specifications[0].value).toBe('4.1');
  });

  it('markSaved clears only rows that did not change while the save was in flight', () => {
    const store = new ProjectDataStore();
    store.setDetails('A', details, [field(), field({ id: 'U_MIN' })]);
    store.updateField('A', 'U_MAX', (f) => editValue(f, '4.1', 'V'), { dirty: true });
    store.updateField('A', 'U_MIN', (f) => editValue(f, '2.5', 'V'), { dirty: true });
    const sent = store.get('A').fields;
    store.updateField('A', 'U_MIN', (f) => editValue(f, '2.6', 'V'), { dirty: true }); // typed during the save
    store.markSaved('A', sent);
    expect(store.get('A').dirty).toEqual(['U_MIN']);
  });

  it('row operations are per row and per project', () => {
    const store = new ProjectDataStore();
    store.setRowOp('A', 'U_MAX', 'flag');
    expect(store.get('A').rowOps).toEqual({ U_MAX: 'flag' });
    expect(store.get('B').rowOps).toEqual({});
    store.setRowOp('A', 'U_MAX', null);
    expect(store.get('A').rowOps).toEqual({});
  });

  it('a run\'s live results skip rows with unsaved edits', () => {
    const store = new ProjectDataStore();
    store.setDetails('A', details, [field()]);
    store.updateField('A', 'U_MAX', (f) => editValue(f, '4.1', 'V'), { dirty: true });
    store.applySpecs('A', { U_MAX: [{ id: 'new', value: 9, unit: 'V', confidence: 0.99, source: null }] });
    expect(store.get('A').fields[0].specifications[0].value).toBe('4.1');
  });
});

describe('Approve gate (step 10)', () => {
  it('an open human flag blocks; an auto-flag only warns', () => {
    const flagged = field({ isFlagged: true, activeFlagId: 'f1' });
    const bounds = field({ id: 'I_MAX' }, [spec({ rule_violations: ['above max'] })]);
    const blocked = approvalCheck([flagged, bounds], { unsaved: 0, jobBusy: false });
    expect(blocked.openFlags).toEqual(['U_MAX']);
    expect(blocked.bounds).toEqual(['I_MAX']);
    expect(approveBlockReason(blocked)).toMatch(/1 open flag/);

    const warnOnly = approvalCheck([bounds], { unsaved: 2, jobBusy: false });
    expect(approveBlockReason(warnOnly)).toBeNull();
    expect(warnOnly.bounds).toEqual(['I_MAX']);
  });

  it('a running or queued re-extraction blocks', () => {
    expect(approveBlockReason(approvalCheck([field()], { unsaved: 0, jobBusy: true }))).toMatch(/Wait/);
  });

  it('counts pending rows; nothing pending means nothing to approve', () => {
    const approved = field({ reviewAction: 'ACCEPTED' });
    expect(approvalCheck([approved, field({ id: 'U_MIN' })], { unsaved: 0, jobBusy: false }).pending).toBe(1);
    expect(approveBlockReason(approvalCheck([approved], { unsaved: 0, jobBusy: false }))).toMatch(/Nothing is pending/);
  });
});

describe('rowState: accepted', () => {
  it('adds the accepted fact without changing the primary state', () => {
    const st = rowState(field({ reviewAction: 'ACCEPTED' }));
    expect(st.primary).toBe('high');
    expect(st.secondary).toContain('accepted');
  });
});

describe('Why this value (AM15)', () => {
  it('separates the model texts from the evidence, and never returns a blank', () => {
    const w = whyThisValue(
      spec({
        extractionLogic: '  Read from the limits table.  ',
        source: { documentId: 'd', textSnippet: 'U max 4.2 V', reason: 'Row "U max"', pageNumber: 2, boundingBox: null, tableName: null, cellCoordinates: null },
      }),
    );
    expect(w.explanation).toBe('Read from the limits table.');
    expect(w.sourceNote).toBe('Row "U max"');
    expect(w.snippet).toBe('U max 4.2 V');
    expect(w.calculation).toBeNull();
    expect(NO_REASONING).toBe('No reasoning recorded');
  });

  it('treats whitespace as empty and does not repeat the calculation as the source note', () => {
    const w = whyThisValue(
      spec({
        extractionLogic: '   ',
        calculated: true,
        calculationLogic: '4.2 V × 96 cells',
        source: { documentId: null, textSnippet: '', reason: '4.2 V × 96 cells', pageNumber: null, boundingBox: null, tableName: null, cellCoordinates: null },
      }),
    );
    expect(w.explanation).toBeNull();
    expect(w.sourceNote).toBeNull();
    expect(w.calculation).toBe('4.2 V × 96 cells');
    expect(w.snippet).toBeNull();
  });

  it('shows the reason code, not an explanation, on an empty candidate', () => {
    const w = whyThisValue(spec({ value: '', extractionLogic: REASON_SEARCHED_ABSENT }));
    expect(w.reasonCode?.code).toBe('searched_absent');
    expect(w.explanation).toBeNull();
  });
});
