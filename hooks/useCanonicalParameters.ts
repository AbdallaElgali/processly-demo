'use client';

import { useEffect, useState } from 'react';
import { getParameters, type CanonicalParameter } from '@/api/templates';

/**
 * The canonical parameter dictionary (GET /extraction-templates/parameters),
 * cached at module scope so every caller in the session shares one fetch
 * (D5: this is also the join Extract's CategoryCards use for a category's
 * total). Not keyed per project -- the dictionary is global.
 */
let cache: CanonicalParameter[] | null = null;
let inflight: Promise<CanonicalParameter[]> | null = null;

function load(): Promise<CanonicalParameter[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getParameters()
      .then((list) => {
        cache = list;
        return list;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCanonicalParameters(): {
  parameters: CanonicalParameter[] | null;
  loading: boolean;
  error: string | null;
} {
  const [parameters, setParameters] = useState<CanonicalParameter[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    load()
      .then((list) => {
        if (!cancelled) setParameters(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the parameter dictionary.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { parameters, loading: parameters === null && !error, error };
}
