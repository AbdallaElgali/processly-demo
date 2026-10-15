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

/** Only category prompts are shown to the user: agent, system and any other slot level is dropped. */
export function categoryRows<T extends { level: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.level.toUpperCase() === 'CATEGORY');
}
