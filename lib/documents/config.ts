/**
 * Document viewer budgets (AM12). One constant each, so they are tuned in one
 * place.
 */

/** Documents fetched in the background at the same time, per browser tab. */
export const PREFETCH_CONCURRENCY = 2;

/**
 * Bytes a project may prefetch in the background. Sizes are only known once a
 * file has been fetched, so the budget is checked before each further
 * prefetch: once it is spent, the remaining documents are fetched on demand.
 */
export const PREFETCH_BUDGET_BYTES = 40 * 1024 * 1024;

/** Always prefetched, whatever the budget says: the first few tabs. */
export const PREFETCH_MIN_DOCS = 3;

/** Recently viewed documents kept mounted (hidden) so switching back does not re-parse. */
export const KEEP_MOUNTED = 3;

/** Projects whose fetched files stay in memory; older ones are released. */
export const MAX_CACHED_PROJECTS = 2;

/** Padding around a PDF highlight, in CSS pixels, independent of zoom. */
export const HIGHLIGHT_PAD_PX = 6;
