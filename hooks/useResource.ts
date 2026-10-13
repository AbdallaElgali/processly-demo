import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';

/**
 * Loads one thing with an `AbortSignal` and exposes `reload`. `load` must be
 * stable (wrap it in `useCallback`): a new `load` is a new resource. State is
 * only set inside the promise callbacks (react-hooks/set-state-in-effect), and
 * a reload keeps showing the previous data until the new data arrives.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, fallbackError = 'Could not load this.') {
  const [state, setState] = useState<{ load: unknown; data: T | null; error: string | null }>({ load, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setState({ load, data, error: null }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ load, data: s.load === load ? s.data : null, error: errorMessage(e, fallbackError) }));
      });
    return () => controller.abort();
  }, [load, tick, fallbackError]);

  const current = state.load === load ? state : { data: null, error: null };
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: current.data, error: current.error, loading: current.data === null && current.error === null, reload };
}
