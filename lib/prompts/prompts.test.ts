import { describe, expect, it } from 'vitest';
import type { PinDetail, ProjectPromptResolution } from '@/api/prompts';
import { joinSlots, normalizeScope, scopeLabel } from './view';

const pin = (slot_key: string, slot_level = 'AGENT'): PinDetail => ({
  slot_id: slot_key, slot_key, slot_level, prompt_version_id: 'v', content: 'x', version_number: 1, resolved_from_scope: 'GLOBAL',
  model_name: null, reasoning_effort: null, temperature: null, pinned_by_run_id: null, pinned_at: '2026-10-09T00:00:00Z', is_lazy: false,
});
const resolution: ProjectPromptResolution = {
  already_pinned: true,
  pins_frozen: true,
  slots: [
    { slot_key: 'agent.router', slot_level: 'AGENT', executes_calls: true, is_project_scopable: false, resolved_from_scope: 'global' },
    { slot_key: 'category.voltage', slot_level: 'CATEGORY', executes_calls: false, is_project_scopable: true, resolved_from_scope: 'global' },
  ],
};

describe('scopes', () => {
  it('reads the pin route (GLOBAL) and the resolution route (global) the same way', () => {
    expect(normalizeScope('global')).toBe('GLOBAL');
    expect(normalizeScope('GLOBAL')).toBe('GLOBAL');
    expect(normalizeScope('project')).toBe('PROJECT');
    expect(normalizeScope('galaxy')).toBeNull();
    expect(scopeLabel('customer')).toBe('Customer');
    expect(scopeLabel('galaxy')).toBe('galaxy');
    expect(scopeLabel(null)).toBe('Unknown');
  });
});

describe('joinSlots', () => {
  it('keeps the resolver order, attaches pins, and appends pinned slots the resolver did not list', () => {
    const rows = joinSlots([pin('category.voltage', 'CATEGORY'), pin('agent.old')], resolution);
    expect(rows.map((r) => r.slotKey)).toEqual(['agent.router', 'category.voltage', 'agent.old']);
    expect(rows[0].pin).toBeNull();
    expect(rows[1].pin?.slot_key).toBe('category.voltage');
    expect(rows[2].resolved).toBeNull();
  });
  it('works with no resolution', () => {
    expect(joinSlots([pin('a')], null).length).toBe(1);
  });
});
