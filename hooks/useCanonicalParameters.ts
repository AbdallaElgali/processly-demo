'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getParameters, type CanonicalParameter } from '@/api/templates';

/**
 * The canonical parameter dictionary (GET /extraction-templates/parameters),
 * cached at module scope so every caller in the session shares one fetch. Not
 * keyed per project -- the dictionary is global. It is also observable: a
 * parameter created or edited in one place (the Library, a rule dialog, a
 * project) shows up in all the others at once.
 */
let cache: CanonicalParameter[] | null = null;
let inflight: Promise<CanonicalParameter[]> | null = null;
const listeners = new Set<() => void>();

function publish(next: CanonicalParameter[] | null) {
  cache = next;
  listeners.forEach((l) => l());
}

function load(): Promise<CanonicalParameter[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getParameters()
      .then((list) => {
        publish(list);
        return list;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Puts a freshly created or edited parameter into the shared list (a new array, so subscribers re-render). */
export function upsertCanonicalParameter(parameter: CanonicalParameter) {
  const list = cache ?? [];
  const exists = list.some((p) => p.id === parameter.id);
  publish(exists ? list.map((p) => (p.id === parameter.id ? parameter : p)) : [...list, parameter]);
}

/** Fetches the dictionary again (after a create, to pick up anything the server added). */
export async function refreshCanonicalParameters(): Promise<CanonicalParameter[]> {
  const list = await getParameters();
  publish(list);
  return list;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const getSnapshot = () => cache;
const getServerSnapshot = () => null;

export function useCanonicalParameters(): {
  parameters: CanonicalParameter[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const parameters = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    load().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the parameter dictionary.');
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return {
    parameters,
    loading: parameters === null && !error,
    error: parameters ? null : error,
    reload: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
