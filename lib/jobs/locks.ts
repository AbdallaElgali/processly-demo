/**
 * The Web Locks operations the scheduler needs, behind an interface so the
 * cross-tab rules can be unit-tested without a browser (AM3).
 *
 * AM2: liveness comes from locks, never from timers. A background tab is
 * throttled to roughly one wake-up per minute, so a lease renewed on a timer
 * would expire while its job was still running happily, and another tab would
 * mark it Interrupted — inviting the user to start a duplicate run that costs
 * tokens. A Web Lock is released by the browser when the tab dies, and not
 * before, which is exactly the signal we want.
 */
export interface LockManager {
  /** Runs `fn` while holding `name` exclusively. Serialises scheduler passes. */
  withLock<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /**
   * Takes `name` and holds it until the returned function is called. Resolves
   * to null if another context already holds it.
   *
   * The scheduler uses this to claim a job BEFORE marking it running, so there
   * is never a window where a job looks running to the liveness sweep but no
   * lock is held yet.
   */
  tryHold(name: string): Promise<(() => void) | null>;
  /** Names currently held anywhere in this origin, across every tab. */
  heldNames(): Promise<string[]>;
  /** True when the environment supports this at all. */
  readonly available: boolean;
}

export class WebLockManager implements LockManager {
  readonly available =
    typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';

  async withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.available) return fn();
    return navigator.locks.request(name, fn) as Promise<T>;
  }

  async tryHold(name: string): Promise<(() => void) | null> {
    if (!this.available) return () => {};

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    let signalAcquired!: (ok: boolean) => void;
    const acquired = new Promise<boolean>((resolve) => {
      signalAcquired = resolve;
    });

    // `ifAvailable` makes this non-blocking: the callback runs immediately with
    // null if someone else holds the lock. Returning `held` keeps the lock
    // until release() resolves it.
    void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
      if (!lock) {
        signalAcquired(false);
        return undefined;
      }
      signalAcquired(true);
      return held;
    });

    return (await acquired) ? release : null;
  }

  async heldNames(): Promise<string[]> {
    if (!this.available || typeof navigator.locks.query !== 'function') return [];
    const snapshot = await navigator.locks.query();
    return (snapshot.held ?? []).map((l) => l.name ?? '').filter(Boolean);
  }
}
