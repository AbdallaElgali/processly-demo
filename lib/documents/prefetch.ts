import { PREFETCH_BUDGET_BYTES, PREFETCH_MIN_DOCS } from './config';

/**
 * Whether the document at `index` (in tab order) may still be prefetched,
 * given how many bytes this project has already prefetched. The first
 * `minDocs` always are; after that, only while the budget is not spent.
 */
export function mayPrefetch(
  index: number,
  bytesSoFar: number,
  { budget = PREFETCH_BUDGET_BYTES, minDocs = PREFETCH_MIN_DOCS }: { budget?: number; minDocs?: number } = {},
): boolean {
  if (index < minDocs) return true;
  return bytesSoFar < budget;
}

/** Most-recently-viewed first, capped at `max`. Returns the same array when nothing changes. */
export function touchRecent(list: string[], id: string, max: number): string[] {
  if (list[0] === id) return list;
  return [id, ...list.filter((x) => x !== id)].slice(0, Math.max(1, max));
}
