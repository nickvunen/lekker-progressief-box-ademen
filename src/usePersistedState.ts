import { useState, useCallback } from 'react';

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setStateInner] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setState = useCallback(
    (val: T | ((prev: T) => T)) => {
      setStateInner((prev) => {
        const next = val instanceof Function ? val(prev) : val;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage full or unavailable
        }
        return next;
      });
    },
    [key],
  );

  return [state, setState];
}
