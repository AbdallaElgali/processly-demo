'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * How many cells inside an Excel source table hold the candidate's value, per
 * open document. The backend names a table, never a cell (B14), so in an
 * operating-window matrix one value can sit in 20 or more cells. The viewer
 * marks the current one strongly and the rest lightly; the source bar steps
 * through them with "N of M" buttons (owner decision on step 9b; buttons only,
 * no keys, AM19).
 *
 * The viewer publishes the count here; the step index travels on the
 * highlight itself (`ViewerHighlight.matchIndex`). A module store, rather
 * than a callback, because the viewer sits behind a dynamic import and two
 * memo boundaries.
 */
export interface MatchInfo {
  /** The highlight jump this count belongs to. */
  nonce: number;
  count: number;
  /** More cells matched than MAX_VALUE_MATCHES; `count` is the cap. */
  truncated: boolean;
}

const keyOf = (projectId: string, documentId: string) => `${projectId}\u0000${documentId}`;

class MatchNavStore {
  private map = new Map<string, MatchInfo>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get(projectId: string, documentId: string): MatchInfo | undefined {
    return this.map.get(keyOf(projectId, documentId));
  }

  set(projectId: string, documentId: string, info: MatchInfo) {
    const k = keyOf(projectId, documentId);
    const prev = this.map.get(k);
    // Unchanged state keeps its reference, so useSyncExternalStore stays quiet.
    if (prev && prev.nonce === info.nonce && prev.count === info.count && prev.truncated === info.truncated) return;
    this.map.set(k, info);
    this.emit();
  }

  clear(projectId: string, documentId: string) {
    if (this.map.delete(keyOf(projectId, documentId))) this.emit();
  }

  reset() {
    if (this.map.size === 0) return;
    this.map.clear();
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const matchNav = new MatchNavStore();

export function useMatchInfo(projectId: string, documentId: string | null): MatchInfo | undefined {
  const get = useCallback(() => (documentId ? matchNav.get(projectId, documentId) : undefined), [projectId, documentId]);
  return useSyncExternalStore(matchNav.subscribe, get, () => undefined);
}

/** The next index, wrapping at both ends. */
export function stepIndex(index: number, dir: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  return (((index + dir) % count) + count) % count;
}
