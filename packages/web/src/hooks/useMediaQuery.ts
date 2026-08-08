import { useSyncExternalStore } from 'react';

// Subscribes to a CSS media query so components can branch on viewport
// without resize listeners. SSR-safe default: false.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
