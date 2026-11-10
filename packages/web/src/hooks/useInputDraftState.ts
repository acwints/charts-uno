import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { isNativeApp } from '../services/native';
import { nativeInputDrafts, nativeSessionGeneration } from '../services/nativeNavigationSession';

export function useInputDraftState<T>(key: string, initial: T) {
  const generation = useRef(nativeSessionGeneration);
  const [value, update] = useState<T>(() => isNativeApp() && nativeInputDrafts.has(key) ? nativeInputDrafts.get(key) as T : initial);
  const setValue = useCallback((next: SetStateAction<T>) => {
    update(previous => {
      const value = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      if (isNativeApp() && generation.current === nativeSessionGeneration) nativeInputDrafts.set(key, value);
      return value;
    });
  }, [key]);
  return [value, setValue] as const;
}
