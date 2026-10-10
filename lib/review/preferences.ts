/**
 * Review preferences kept in localStorage (plan-A 6.8: "Review preferences
 * (local)"). One definition shared by the Workspace, which reads them, and
 * Settings, which is the main control; both use `useLocalStorageFlag`, so a
 * change in one is seen by the other at once (and by other tabs).
 */
export const COMPACT_KEY = 'bda.workspace.compact';
export const REVIEW_FIRST_KEY = 'bda.workspace.reviewFirst';
