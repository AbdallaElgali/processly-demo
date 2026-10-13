import { describe, expect, it } from 'vitest';
import type { CustomerSettings } from '@/api/customerSettings';
import {
  AGENT_PROMPTS_NOTE, customerDefaultTemplateOptions, customerPromptSummary, promptSourceLabel, slotLabel,
  validateNewVersion, versionChoices,
} from './settings';

const slot = (slot_key: string, over: Record<string, unknown> = {}) => ({
  slot_key, description: null, prompt_version_id: null, version_number: null, change_note: null,
  global_version_id: 'g', global_version_number: 1, ...over,
});
const settings = (over: Partial<CustomerSettings> = {}): CustomerSettings => ({
  customer_id: 'c1', alias_name: 'DAM', name: null, default_template: null, prompt_slots: [], ...over,
});

describe('slotLabel', () => {
  it.each([
    ['category.voltage', 'Voltage'], ['category.end_of_life', 'End of life'], ['category.system', 'System'], ['category.temperature', 'Temperature'],
  ])('%s -> %s', (key, label) => expect(slotLabel(key)).toBe(label));
  it('copes with a key without a prefix', () => expect(slotLabel('capacity')).toBe('Capacity'));
});

describe('promptSourceLabel', () => {
  it('says Global (vN) when the customer has no choice', () => {
    expect(promptSourceLabel(slot('category.voltage'))).toBe('Global (v1)');
  });
  it('says Customer (vN, change note)', () => {
    expect(promptSourceLabel(slot('category.voltage', { prompt_version_id: 'p', version_number: 3, change_note: 'DAM wording' }))).toBe('Customer (v3, DAM wording)');
  });
  it('leaves out an empty change note', () => {
    expect(promptSourceLabel(slot('category.voltage', { prompt_version_id: 'p', version_number: 2, change_note: ' ' }))).toBe('Customer (v2)');
  });
});

describe('customerPromptSummary', () => {
  it('is "Global prompts" with no customer choice', () => {
    expect(customerPromptSummary(settings({ prompt_slots: [slot('category.voltage')] }))).toBe('Global prompts');
  });
  it('lists only the customer-chosen slots, in slot order', () => {
    const s = settings({
      prompt_slots: [
        slot('category.current', { prompt_version_id: 'a', version_number: 2 }),
        slot('category.capacity'),
        slot('category.voltage', { prompt_version_id: 'b', version_number: 3 }),
      ],
    });
    expect(customerPromptSummary(s)).toBe('Customer prompts: Current v2, Voltage v3');
  });
  it('is "Global prompts" before the settings are known', () => expect(customerPromptSummary(null)).toBe('Global prompts'));
});

describe('customerDefaultTemplateOptions', () => {
  const tpl = [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }];
  it('lists the templates', () => {
    expect(customerDefaultTemplateOptions(tpl, null).map((o) => o.id)).toEqual(['t1', 't2']);
  });
  it('adds the current default when the user cannot see it, so the selector still shows it', () => {
    expect(customerDefaultTemplateOptions(tpl, { id: 't9', name: 'Hidden' }).map((o) => o.id)).toEqual(['t9', 't1', 't2']);
  });
  it('does not repeat a visible default', () => {
    expect(customerDefaultTemplateOptions(tpl, { id: 't2', name: 'B' })).toHaveLength(2);
  });
});

describe('versionChoices', () => {
  const v = (n: number, over = {}) => ({ id: `v${n}`, slot_id: 's', version_number: n, content: 'c', is_archived: false, created_at: '', ...over });
  it('sorts newest first and drops archived versions, except the one in use', () => {
    const list = [v(1), v(2, { is_archived: true }), v(3), v(4, { is_archived: true })];
    expect(versionChoices(list, 'v2').map((x) => x.id)).toEqual(['v3', 'v2', 'v1']);
  });
  it('labels with the number and change note', () => {
    expect(versionChoices([v(2, { change_note: 'fix' })], null)[0].label).toBe('v2 · fix');
    expect(versionChoices([v(2)], null)[0].label).toBe('v2');
  });
});

describe('validateNewVersion', () => {
  it('needs content and a change note', () => {
    expect(validateNewVersion({ content: ' ', changeNote: 'x' })).toMatch(/text/i);
    expect(validateNewVersion({ content: 'a', changeNote: ' ' })).toMatch(/change note/i);
    expect(validateNewVersion({ content: 'a', changeNote: 'x' })).toBeNull();
  });
});

describe('texts', () => {
  it('says agent prompts are shared', () => expect(AGENT_PROMPTS_NOTE).toBe('Agent prompts are shared by all customers.'));
});
