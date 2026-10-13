import { describe, expect, it } from 'vitest';
import type { ProjectPromptResolution, ResolvedSlotConfig } from '@/api/prompts';
import { PINS_FROZEN_TEXT, pinsEditable, projectSlotRows, resolutionNote } from './scoped';

const slot = (slot_key: string, over: Partial<ResolvedSlotConfig> = {}): ResolvedSlotConfig => ({
  slot_key, slot_level: slot_key.startsWith('agent') ? 'AGENT' : 'CATEGORY', executes_calls: slot_key.startsWith('agent'),
  is_project_scopable: !slot_key.startsWith('agent'), prompt_version_id: 'v', version_number: 1, resolved_from_scope: 'global', ...over,
});
const res = (over: Partial<ProjectPromptResolution> = {}): ProjectPromptResolution => ({
  already_pinned: false, pins_frozen: false,
  slots: [slot('agent.router'), slot('category.voltage'), slot('category.current', { resolved_from_scope: 'customer', version_number: 2 }), slot('category.capacity', { resolved_from_scope: 'project', version_number: 4 })],
  ...over,
});

describe('projectSlotRows', () => {
  it('never lists agent slots', () => {
    expect(projectSlotRows(res()).map((r) => r.slotKey)).not.toContain('agent.router');
  });
  it('shows version and where it comes from', () => {
    const rows = projectSlotRows(res());
    expect(rows.find((r) => r.slotKey === 'category.current')).toMatchObject({ label: 'Current', version: 2, source: 'Customer' });
    expect(rows.find((r) => r.slotKey === 'category.voltage')).toMatchObject({ source: 'Global' });
  });
  it('offers Reset only for a project choice', () => {
    const rows = projectSlotRows(res());
    expect(rows.find((r) => r.slotKey === 'category.capacity')?.canReset).toBe(true);
    expect(rows.find((r) => r.slotKey === 'category.current')?.canReset).toBe(false);
  });
  it('is empty without a resolution', () => expect(projectSlotRows(null)).toEqual([]));
});

describe('pins_frozen, not already_pinned', () => {
  it('allows changes while not frozen, even if already_pinned (a customer project before its first run)', () => {
    expect(pinsEditable(res({ already_pinned: true, pins_frozen: false }))).toBe(true);
  });
  it('is read-only once frozen', () => {
    expect(pinsEditable(res({ pins_frozen: true }))).toBe(false);
    expect(PINS_FROZEN_TEXT).toBe('Frozen by the first extraction');
  });
  it('is read-only while unknown', () => expect(pinsEditable(null)).toBe(false));
  it('the note follows pins_frozen', () => {
    expect(resolutionNote(res({ already_pinned: true, pins_frozen: false }))).toMatch(/can still be changed/i);
    expect(resolutionNote(res({ pins_frozen: true }))).toMatch(/frozen/i);
  });
});
