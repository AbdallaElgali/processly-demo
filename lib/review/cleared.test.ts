import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import type { ProjectParameter } from '@/api/projects';
import { dbParamToInputField, inputFieldToParameterInput } from '@/lib/parameter-adapter';
import { isReviewerCleared, rowState, selectedSpec } from '@/lib/review/rowState';
import { editValue, revertValue, selectCandidate, canRevert } from '@/lib/review/edits';
import { whyThisValue } from '@/lib/review/why';
import { hasLocation, fieldAnchors } from '@/lib/review/anchors';
import { reviewProgress } from '@/lib/overview/progress';
import { BATTERY_EXPORT_KEYS, FrontendBatteryFileExport, missingExportKeys } from '@/static/battery-template';

const candidate = (over: Record<string, unknown> = {}) => ({
  id: 'c1', ai_value: 3.65, expected_unit: 'V', unit: 'V', confidence: 0.9,
  source_document_id: 'doc-1', source_page_number: 2, source_text_snippet: 'x',
  extraction_logic: 'because', rule_violations: [], requires_review: false, run_number: 1, ...over,
});

const param = (over: Record<string, unknown> = {}): ProjectParameter =>
  ({
    id: 'pp1', parameter_key: 'U_MAX', parameter_alias: 'U max', parameter_id: 'p',
    final_value: null, final_unit: null, selected_candidate_id: null,
    is_human_modified: false, review_action: 'PENDING', candidates: [candidate()],
    ...over,
  }) as unknown as ProjectParameter;

const cleared = (reviewAction = 'MODIFIED') =>
  dbParamToInputField(param({ is_human_modified: true, review_action: reviewAction }));

describe('reader: reviewer-cleared row (R1 contract 1)', () => {
  it('selects a "no value" spec, never the first AI candidate', () => {
    const f = cleared();
    const sel = selectedSpec(f)!;
    expect(sel.candidateId).toBeNull();
    expect(sel.value).toBe('');
    expect(f.specifications.some((s) => s.candidateId === 'c1')).toBe(true);
    expect(f.selectedSpecId).toBe(sel.id);
  });

  it('still shows a human value when there is one', () => {
    const f = dbParamToInputField(param({ is_human_modified: true, review_action: 'MODIFIED', final_value: 3.7, final_unit: 'V', selected_candidate_id: null }));
    expect(selectedSpec(f)!.value).toBe('3.7');
  });

  it('an AI-empty row (not human) keeps its placeholder candidate selected', () => {
    const f = dbParamToInputField(param({ candidates: [candidate({ id: 'e1', ai_value: null, extraction_logic: 'NOT_FOUND' })] }));
    expect(selectedSpec(f)!.candidateId).toBe('e1');
    expect(isReviewerCleared(f)).toBe(false);
  });
});

describe('three empty states (contract 2)', () => {
  it('reviewer-cleared', () => {
    const st = rowState(cleared());
    expect(isReviewerCleared(cleared())).toBe(true);
    expect(isReviewerCleared(cleared('ACCEPTED'))).toBe(true);
    expect(st.emptyKind).toBe('cleared');
    expect(st.primary).toBe('empty');
    expect(st.reason).toBeNull();
    expect(st.secondary).not.toContain('modified');
    expect(rowState(cleared('ACCEPTED')).secondary).toContain('accepted');
  });
  it('AI searched, nothing found', () => {
    const f = dbParamToInputField(param({ candidates: [candidate({ id: 'e1', ai_value: null })] }));
    expect(rowState(f).emptyKind).toBe('searched');
  });
  it('not extracted yet', () => {
    const f = dbParamToInputField(param({ candidates: [] }));
    const st = rowState(f);
    expect(st.primary).toBe('no_run');
    expect(st.emptyKind).toBe('not_extracted');
  });
  it('a valued row has no empty kind', () => {
    expect(rowState(dbParamToInputField(param())).emptyKind).toBeNull();
  });
  it('a local clear of an AI value is a cleared row too', () => {
    const f = editValue(dbParamToInputField(param()), '', 'V');
    expect(isReviewerCleared(f)).toBe(true);
  });
  it('the overview counts a cleared row as empty, not reviewed', () => {
    const p = reviewProgress([cleared()]);
    expect(p.empty).toBe(1);
    expect(p.reviewed).toBe(0);
  });
});

describe('save (contract 3)', () => {
  it('sends nulls for a human row whose value is empty', () => {
    const body = inputFieldToParameterInput(cleared(), 'u');
    expect(body.final_value).toBeNull();
    expect(body.final_unit).toBeNull();
    expect(body.selected_candidate_id).toBeNull();
    expect(body.is_human_modified).toBe(true);
  });
  it('a local clear on an AI candidate also saves as a clear', () => {
    const f = editValue(dbParamToInputField(param()), '', 'V');
    const body = inputFieldToParameterInput(f, 'u');
    expect(body.final_value).toBeNull();
    expect(body.final_unit).toBeNull();
    expect(body.selected_candidate_id).toBeNull();
  });
  it('an untouched AI-empty row keeps its candidate and unit', () => {
    const f = dbParamToInputField(param({ candidates: [candidate({ id: 'e1', ai_value: null, unit: 'V' })] }));
    expect(inputFieldToParameterInput(f, 'u').selected_candidate_id).toBe('e1');
  });
});

describe('editing a cleared row (contract 4)', () => {
  it('typing a value is a human edit with no candidate', () => {
    const f = editValue(cleared(), '3.2', 'V');
    const body = inputFieldToParameterInput(f, 'u');
    expect(body.final_value).toBe(3.2);
    expect(body.selected_candidate_id).toBeNull();
    expect(body.is_human_modified).toBe(true);
  });
  it('picking the AI candidate brings its value back', () => {
    const f2 = selectCandidate(cleared(), 'c1');
    expect(selectedSpec(f2)!.value).toBe('3.65');
    expect(f2.reviewAction).toBe('PENDING');
    expect(f2.isHumanModified).toBe(false);
  });
  it('Revert is not offered on the "no value" spec', () => {
    const f = cleared();
    expect(canRevert(f)).toBe(false);
    expect(revertValue(f)).toBe(f);
  });
});

const exportField = (f: InputField, key = 'U_MAX'): InputField => ({ ...f, id: key, label: key });
const valueOf = (xml: string, name: string) => xml.match(new RegExp(`<Name>${BATTERY_EXPORT_KEYS.find((e) => e.key === name)?.exportName ?? name}</Name>\\s*<Value>([^<]*)</Value>`))?.[1];

describe('.battery export (contract 5)', () => {
  it('writes a cleared parameter as no value, never the AI candidate', () => {
    const fields = [exportField(cleared())];
    expect(missingExportKeys(fields)).toContain('U_MAX');
    const { content } = new FrontendBatteryFileExport().generate(fields, 'P');
    expect(valueOf(content, 'U_MAX')).toBe('99999999');
    expect(content).not.toContain('<Value>3.65</Value>');
  });
  it('still writes a valued parameter', () => {
    const f = exportField(dbParamToInputField(param()));
    const { content } = new FrontendBatteryFileExport().generate([f], 'P');
    expect(content).toContain('<Value>3.65</Value>');
  });
});

describe('unknown source (R2, contract 6)', () => {
  const unknown = () =>
    dbParamToInputField(param({
      candidates: [candidate({
        source_document_id: null, source_page_number: null, source_text_snippet: null,
        source_reason: 'Source document unknown: anchor P1 exists in several documents', requires_review: true,
      })],
    }));
  it('has no jump target', () => {
    const s = selectedSpec(unknown())!;
    expect(s.source!.documentId).toBeNull();
    expect(hasLocation(s.source)).toBe(false);
    expect(fieldAnchors(unknown())).toHaveLength(0);
  });
  it('a page without a document is not a jump target either', () => {
    expect(hasLocation({ documentId: null, pageNumber: 3, textSnippet: null, reason: null, boundingBox: null, tableName: null, cellCoordinates: null })).toBe(false);
  });
  it('"Why this value" gives source_reason as the source, not as a model note', () => {
    const why = whyThisValue(selectedSpec(unknown())!);
    expect(why.sourceUnknown).toMatch(/^Source document unknown/);
    expect(why.sourceNote).toBeNull();
  });
  it('a known source has no unknown-source text', () => {
    expect(whyThisValue(selectedSpec(dbParamToInputField(param()))!).sourceUnknown).toBeNull();
  });
});
