import type { InputField, SpecificationSource } from '@/types';

/**
 * Source anchors for one parameter (plan-A §8 "Anchor 1 of N", RFC §4.4 CFC).
 *
 * The data model has one source per candidate, so a parameter that appears on
 * two pages arrives as two candidates. Its anchors are the distinct locations
 * across all of its candidates, the selected candidate's first.
 */
export interface SourceAnchor {
  key: string;
  source: SpecificationSource;
  /** The spec this anchor came from (the first one, when several share a location). */
  specId: string;
  selected: boolean;
  /** That spec's value, so a spreadsheet viewer can find the cell inside a table-sized source. */
  value: string | null;
}

/** True when the source points at something the viewer can show. */
export function hasLocation(s: SpecificationSource | null | undefined): s is SpecificationSource {
  return !!s && (s.pageNumber !== null || s.boundingBox !== null || s.cellCoordinates !== null || !!s.documentId);
}

/** Identity of a location, independent of which candidate carries it. */
export function anchorKey(s: SpecificationSource): string {
  const b = s.boundingBox;
  const c = s.cellCoordinates;
  return [
    s.documentId ?? '',
    s.pageNumber ?? '',
    s.tableName ?? '',
    b ? [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 100) / 100).join(',') : '',
    c ? `${c.row}:${c.column}` : '',
  ].join('|');
}

export function fieldAnchors(field: InputField): SourceAnchor[] {
  const specs = [...field.specifications].sort(
    (a, b) => Number(b.id === field.selectedSpecId) - Number(a.id === field.selectedSpecId),
  );
  const seen = new Set<string>();
  const out: SourceAnchor[] = [];
  for (const spec of specs) {
    if (!hasLocation(spec.source)) continue;
    const key = anchorKey(spec.source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, source: spec.source, specId: spec.id, selected: spec.id === field.selectedSpecId, value: spec.value ?? null });
  }
  return out;
}
