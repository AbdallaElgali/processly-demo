import type { PinDetail, ProjectPromptResolution, ResolvedSlotConfig } from '@/api/prompts';

/** The pin route says `GLOBAL`, the resolution route `global`: one spelling for display. */
export type PromptScope = 'GLOBAL' | 'CUSTOMER' | 'PROJECT';

export function normalizeScope(raw: string | null | undefined): PromptScope | null {
  const upper = (raw ?? '').trim().toUpperCase();
  return upper === 'GLOBAL' || upper === 'CUSTOMER' || upper === 'PROJECT' ? upper : null;
}

export const SCOPE_LABEL: Record<PromptScope, string> = {
  GLOBAL: 'Global',
  CUSTOMER: 'Customer',
  PROJECT: 'Project',
};

export function scopeLabel(raw: string | null | undefined): string {
  const scope = normalizeScope(raw);
  return scope ? SCOPE_LABEL[scope] : raw?.trim() || 'Unknown';
}

/** What `is_lazy` means: the slot was not pinned with the others at the first run, but when it was first needed. */
export const LAZY_LABEL = 'Pinned during a correction';
export const LAZY_EXPLANATION =
  'This slot was not pinned at the first extraction run. It was pinned the first time a correction needed it, and keeps that version from then on.';

/** Model settings as one readable line; unset values are said to be unset, not hidden. */
export function modelSettings(s: { model_name?: string | null; reasoning_effort?: string | null; temperature?: number | null }) {
  return {
    model: s.model_name ?? null,
    effort: s.reasoning_effort ?? null,
    temperature: s.temperature ?? null,
  };
}

export interface SlotRow {
  slotKey: string;
  level: string;
  /** Present when the project has pinned this slot. */
  pin: PinDetail | null;
  /** The resolver's answer; when the project is pinned it repeats the pin. */
  resolved: ResolvedSlotConfig | null;
}

/**
 * One row per slot, in the resolver's order (it lists the pipeline in order),
 * then any pinned slot the resolver did not mention. Joins the two routes on
 * `slot_key`.
 */
export function joinSlots(pins: PinDetail[], resolution: ProjectPromptResolution | null): SlotRow[] {
  const byKey = new Map(pins.map((p) => [p.slot_key, p]));
  const rows: SlotRow[] = [];
  const seen = new Set<string>();
  for (const slot of resolution?.slots ?? []) {
    seen.add(slot.slot_key);
    rows.push({ slotKey: slot.slot_key, level: slot.slot_level, pin: byKey.get(slot.slot_key) ?? null, resolved: slot });
  }
  for (const pin of pins) {
    if (!seen.has(pin.slot_key)) rows.push({ slotKey: pin.slot_key, level: pin.slot_level, pin, resolved: null });
  }
  return rows;
}

/** Agent slots (they call a model) before category slots, keeping each group's order. */
export function groupByLevel<T extends { level: string }>(rows: T[]): { level: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) groups.set(r.level, [...(groups.get(r.level) ?? []), r]);
  const order = ['AGENT', 'CATEGORY'];
  return [...groups.entries()]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([level, list]) => ({ level, rows: list }));
}
