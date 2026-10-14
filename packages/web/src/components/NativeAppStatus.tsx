import { useEffect, useState } from 'react';
import { isNativeApp } from '../services/native';
import './NativeAppStatus.css';

export function NativeAppStatus() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    if (!isNativeApp()) return;
    const updateConnection = () => setOffline(!navigator.onLine);
    const updateReachability = (event: Event) => {
      const ok = (event as CustomEvent<{ ok?: boolean }>).detail?.ok;
      setOffline(ok === false || !navigator.onLine);
    };
    const updateKeyboard = () => {
      const viewport = window.visualViewport;
      const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      document.documentElement.classList.toggle('native-keyboard-open', Boolean(editing && viewport && window.innerHeight - viewport.height > 120));
    };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    window.addEventListener('chartsuno:reachability', updateReachability);
    window.visualViewport?.addEventListener('resize', updateKeyboard);
    document.addEventListener('focusout', updateKeyboard);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
      window.removeEventListener('chartsuno:reachability', updateReachability);
      window.visualViewport?.removeEventListener('resize', updateKeyboard);
      document.removeEventListener('focusout', updateKeyboard);
      document.documentElement.classList.remove('native-keyboard-open');
    };
  }, []);
  return isNativeApp() && offline ? (
    <div className="native-offline" role="status">
      <p>You’re offline. Charts you already opened stay on this screen. Reconnect to load or save.</p>
      <button type="button" className="native-offline__retry" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  ) : null;
}
