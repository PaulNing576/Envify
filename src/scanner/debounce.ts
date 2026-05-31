/**
 * Creates a debounced version of a function that delays invoking `fn` until
 * `delayMs` milliseconds have elapsed since the last invocation.
 *
 * Uses a Map keyed by a string (typically document URI) so each document
 * gets its own debounce timer — rapid edits in file A don't reset the
 * timer for file B.
 */
export function createDebouncer<T>(
  fn: (key: string, arg: T) => void,
  delayMs: number
): (key: string, arg: T) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return (key: string, arg: T) => {
    const existing = timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      timers.delete(key);
      fn(key, arg);
    }, delayMs);

    timers.set(key, timer);
  };
}

/**
 * Clear all pending debounced calls.
 */
export function createClearableDebouncer<T>(
  fn: (key: string, arg: T) => void,
  delayMs: number
): {
  debounce: (key: string, arg: T) => void;
  clear: () => void;
} {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const debounce = (key: string, arg: T) => {
    const existing = timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      timers.delete(key);
      fn(key, arg);
    }, delayMs);

    timers.set(key, timer);
  };

  const clear = () => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  };

  return { debounce, clear };
}
