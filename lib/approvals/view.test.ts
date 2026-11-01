import { describe, expect, it } from 'vitest';
import type { InputField, Specification } from '@/types';
import {
  OVERRIDE_STATUSES,
  analyzeConfirmText,
  approvalItemName,
  approvalRows,
  approvalValue,
  approveToastText,
  flagWhen,
  needsAnalyzeConfirm,
  openFlagWho,
  openFlagWhy,
  originLabel,
  reapproveBanner,
  resolveAllLabel,
  statusDisplay,
} from './view';

const fmt = (iso: string) => `D(${iso.slice(0, 10)})`;

const project = (over: Record<string, unknown> = {}) => ({
  status: 'NEW' as const,
  approval_version: null,
  approved_at: null,
  approved_by: null,
  approved_by_username: null,
  changed_since_approval: false,
  open_flag_count: 0,
  status_overridden: false,
  ...over,
});

describe('status in plain words (B)', () => {
  it.each([
    ['NEW', 'New'],
    ['PENDING_REVIEW', 'Pending review'],
    ['IN_REVIEW', 'In review'],
    ['APPROVED', 'Approved'],
  ] as const)('%s reads %s', (status, label) => {
    expect(statusDisplay(project({ status }), fmt).line).toBe(label);
  });

  it('an approved project names the version, who and when', () => {
    const p = project({ status: 'APPROVED', approval_version: 2, approved_by_username: 'mia', approved_at: '2026-10-30T09:00:00Z' });
    expect(statusDisplay(p, fmt).line).toBe('Approved · v2 · mia · D(2026-10-30)');
  });

  it('changed since approval says so, with the version', () => {
    const p = project({ status: 'IN_REVIEW', approval_version: 2, changed_since_approval: true, approved_by_username: 'mia', approved_at: '2026-10-30T09:00:00Z' });
    expect(statusDisplay(p, fmt).line).toBe('In review · changed since approval v2');
  });

  it('an in-review project that was approved before and did not change is just In review', () => {
    expect(statusDisplay(project({ status: 'IN_REVIEW', approval_version: 1 }), fmt).line).toBe('In review');
  });

  it('marks a manual override and explains it in a tooltip', () => {
    const d = statusDisplay(project({ status: 'IN_REVIEW', status_overridden: true }), fmt);
    expect(d.manual).toBe(true);
    expect(d.manualTooltip).toMatch(/set by hand/i);
    expect(statusDisplay(project(), fmt).manual).toBe(false);
  });

  it('copes with a backend that sends none of the new fields', () => {
    expect(statusDisplay({ status: 'IN_REVIEW' }, fmt)).toMatchObject({ line: 'In review', manual: false });
  });
});

describe('manual override menu (C)', () => {
  it('offers New, Pending review and In review, never Approved', () => {
    expect([...OVERRIDE_STATUSES]).toEqual(['NEW', 'PENDING_REVIEW', 'IN_REVIEW']);
  });
});

describe('approve and re-approve texts (D, E)', () => {
  const approval = { id: 'a', version: 3, approved_by: 'u', approved_by_username: 'mia', approved_at: '', note: null, flags_resolved_count: 0, item_count: 4 };
  it('a new version', () => {
    expect(approveToastText({ created: true, approval })).toBe('Approved as version 3');
  });
  it('nothing changed', () => {
    expect(approveToastText({ created: false, approval: { ...approval, version: 2 } })).toBe('Nothing changed since version 2 — approval confirmed');
  });

  it('the re-approve banner shows only when the project changed since approval', () => {
    expect(reapproveBanner(project({ status: 'IN_REVIEW', approval_version: 2, changed_since_approval: true }))).toBe(
      'Values changed since approval v2. Re-approve to save the current state as version 3.',
    );
    expect(reapproveBanner(project({ status: 'APPROVED', approval_version: 2 }))).toBeNull();
    expect(reapproveBanner(project())).toBeNull();
  });
});

describe('open flags (D, F)', () => {
  const flag = { flag_id: 'f', project_parameter_id: 'p', parameter_alias: 'A', flagger_id: 'u', flagger_username: 'sam', flag_reason: null, created_at: '2026-10-31T10:00:00Z' };
  it('lists who, why (or "no reason given") and when', () => {
    expect(openFlagWho(flag)).toBe('sam');
    expect(openFlagWhy(flag)).toBe('no reason given');
    expect(openFlagWhy({ ...flag, flag_reason: 'wrong table' })).toBe('wrong table');
    expect(flagWhen(flag, fmt)).toBe('D(2026-10-31)');
  });

  it('Resolve all flags (N) is hidden at 0', () => {
    expect(resolveAllLabel(0)).toBeNull();
    expect(resolveAllLabel(undefined)).toBeNull();
    expect(resolveAllLabel(3)).toBe('Resolve all flags (3)');
  });
});

describe('approval history (G)', () => {
  const item = (over: Record<string, unknown> = {}) => ({
    id: 'i', project_parameter_id: 'pp', parameter_id: 'p', parameter_name: 'U_MAX', parameter_alias: 'U max',
    final_value: '4.2', final_unit: 'V', selected_candidate_id: 'c', source_document_id: null, source_anchor: null,
    origin: 'AI_SELECTED', review_action: 'ACCEPTED', ...over,
  });

  it('origins in plain words', () => {
    expect(originLabel('AI_SELECTED')).toBe('AI');
    expect(originLabel('AI_CORRECTED')).toBe('AI correction');
    expect(originLabel('HUMAN_ENTERED')).toBe('Entered by hand');
  });

  it('a removed parameter says so, and keeps the alias it had', () => {
    expect(approvalItemName(item() as never)).toEqual({ name: 'U max', removed: false });
    expect(approvalItemName(item({ project_parameter_id: null }) as never)).toEqual({ name: 'U max', removed: true });
  });

  it('value and unit together, a placeholder when there is no value', () => {
    expect(approvalValue(item() as never)).toBe('4.2 V');
    expect(approvalValue(item({ final_unit: null }) as never)).toBe('4.2');
    expect(approvalValue(item({ final_value: null }) as never)).toBe('No value');
  });

  it('rows carry the name, removal, value and origin', () => {
    const rows = approvalRows([item(), item({ id: 'j', project_parameter_id: null, origin: 'HUMAN_ENTERED' })] as never);
    expect(rows.map((r) => [r.removed, r.origin])).toEqual([[false, 'AI'], [true, 'Entered by hand']]);
  });
});

describe('confirm before a full Analyze (H)', () => {
  const spec = (value: string): Specification => ({
    id: 's', candidateId: 'c', value, confidence: 90, unit: 'V', source: null, calculated: false, rule_passed: true, rule_violations: [], requires_review: false,
  });
  const field = (over: Partial<InputField> = {}): InputField => ({
    id: 'U_MAX', dbId: 'pp', label: 'U_MAX', specifications: [], isFlagged: false, flagReason: null, activeFlagId: null, reviewAction: 'PENDING', ...over,
  });

  it('asks when a row has an extracted value', () => {
    expect(needsAnalyzeConfirm([field({ specifications: [spec('4.2')], selectedSpecId: 's' })])).toBe(true);
  });
  it('asks when a person entered a value', () => {
    expect(needsAnalyzeConfirm([field({ isHumanModified: true, specifications: [spec('4.2')], selectedSpecId: 's' })])).toBe(true);
  });
  it('does not ask for a fresh project or rows with no values', () => {
    expect(needsAnalyzeConfirm([])).toBe(false);
    expect(needsAnalyzeConfirm([field(), field({ id: 'U_MIN', specifications: [spec('')], selectedSpecId: 's' })])).toBe(false);
  });
  it('says what is kept', () => {
    expect(analyzeConfirmText).toBe('Run a full extraction again? Values you edited, accepted or rejected are kept; other AI values may change.');
  });
});
