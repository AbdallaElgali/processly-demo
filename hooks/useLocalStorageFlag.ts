'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A boolean preference kept in localStorage.
 *
 * Built on useSyncExternalStore so the server renders the default and the
 * client swaps to the stored value during hydration, without calling setState
 * inside an effect (which cascades a render and is flagged by
 * react-hooks/set-state-in-effect).
 *
 * Every access is wrapped: localStorage throws in a private window or when
 * site data is blocked, and a remembered pane width is never worth a crash.
 */
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // `storage` fires in OTHER tabs, so a preference changed elsewhere lands here too.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

export function useLocalStorageFlag(
  key: string,
  defaultValue = false,
): [boolean, (next: boolean) => void] {
  const getSnapshot = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? defaultValue : raw === '1';
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* preference simply will not persist */
      }
      notify();
    },
    [key],
  );

  return [value, set];
}
