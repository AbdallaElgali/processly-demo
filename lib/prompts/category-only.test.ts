import { describe, expect, it } from 'vitest';
import { categoryRows } from './view';
import { PROMPT_EDITING_NOTE } from './config';
import { PINS_FROZEN_TEXT, resolutionNote } from './scoped';
import { categorySlots, customerPromptSummary } from '@/lib/customers/settings';

describe('only category prompts are shown (owner decision 2026-10-15)', () => {
  it('categoryRows drops agent and any other non-category slot, keeping order', () => {
    const rows = [
      { level: 'AGENT', n: 1 }, { level: 'CATEGORY', n: 2 }, { level: 'SYSTEM', n: 3 }, { level: 'category', n: 4 },
    ];
    expect(categoryRows(rows).map((r) => r.n)).toEqual([2, 4]);
  });

  it('categoryRows of agents only is empty (the section disappears)', () => {
    expect(categoryRows([{ level: 'AGENT' }])).toEqual([]);
  });

  it('customer slots keep only category.* keys', () => {
    const s = (slot_key: string) => ({ slot_key });
    expect(categorySlots([s('agent.router'), s('category.voltage'), s('system.base'), s('category.end_of_life')]).map((x) => x.slot_key))
      .toEqual(['category.voltage', 'category.end_of_life']);
  });

  it('customer prompt summary never names a non-category slot', () => {
    const settings = { prompt_slots: [
      { slot_key: 'agent.router', prompt_version_id: 'a', version_number: 3 },
      { slot_key: 'category.voltage', prompt_version_id: 'b', version_number: 2 },
    ] } as never;
    expect(customerPromptSummary(settings)).toBe('Customer prompts: Voltage v2');
  });

  it('user-facing prompt texts never mention models, agents or system prompts', () => {
    const texts = [PROMPT_EDITING_NOTE, PINS_FROZEN_TEXT, resolutionNote(null), resolutionNote({ pins_frozen: true } as never)];
    for (const t of texts) expect(t).not.toMatch(/\bmodels?\b|\bagents?\b|system prompt/i);
  });
});
