import { useSyncExternalStore } from 'react';

// `hasMounted` guards against hydration mismatches: the server and the first
// client render must agree, so anything that depends on browser-only state is
// held back until after hydration.
//
// useSyncExternalStore is the supported way to express "server says false,
// client says true" without calling setState inside an effect (which triggers
// a cascading render and is flagged by react-hooks/set-state-in-effect).
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const useHasMounted = (): boolean =>
  useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
