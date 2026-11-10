import { useLayoutEffect, type RefObject } from 'react';
import { nativeScrollPositions } from '../services/nativeNavigationSession';

export function useNativeScrollRestoration(ref: RefObject<HTMLElement | null>, key: string, enabled: boolean, resetPosition = false) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const target = resetPosition ? 0 : nativeScrollPositions.get(key) ?? 0;
    let restoring = true;
    const record = () => { if (!restoring) nativeScrollPositions.set(key, element.scrollTop); };
    const observer = new ResizeObserver(() => restore());
    const restore = () => {
      if (!restoring) return;
      element.scrollTop = target;
      if (element.scrollHeight - element.clientHeight >= target) {
        restoring = false;
        observer.disconnect();
      }
    };
    const interrupt = () => { restoring = false; observer.disconnect(); record(); };
    const content = element.firstElementChild;
    if (content) observer.observe(content);
    restore();
    element.addEventListener('scroll', record, { passive: true });
    element.addEventListener('touchstart', interrupt, { passive: true });
    element.addEventListener('wheel', interrupt, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', record);
      element.removeEventListener('touchstart', interrupt);
      element.removeEventListener('wheel', interrupt);
    };
  }, [ref, key, enabled, resetPosition]);
}
