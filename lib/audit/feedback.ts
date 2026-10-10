import type { FeedbackItem } from '@/api/audit/feedback';

/**
 * `GET /audit/feedback-list` has no total and caps a page at 1000, so the
 * total is only right if every page is read. Reads pages until one comes back
 * short; `maxPages` is a stop against a backend that ignores `offset`.
 */
export async function collectAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 1000,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const rows = await fetchPage(page * pageSize, pageSize);
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export interface FeedbackTotals {
  total: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
}

const tally = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** Counts that add up to `total` by construction (a missing status counts as "unknown"). */
export function feedbackTotals(items: FeedbackItem[]): FeedbackTotals {
  return {
    total: items.length,
    byStatus: tally(items.map((i) => (i.status || 'unknown').toLowerCase())).map(([status, count]) => ({ status, count })),
    byType: tally(items.map((i) => i.feedback_type || 'unknown')).map(([type, count]) => ({ type, count })),
  };
}
