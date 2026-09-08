import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isNativeApp, hideNativeSplash } from './services/native';

if (isNativeApp()) document.documentElement.classList.add('native-app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (isNativeApp()) {
  // Drop the splash on the first frame after React has committed, and never
  // later than 4s even if something above throws.
  requestAnimationFrame(() => requestAnimationFrame(hideNativeSplash));
  window.setTimeout(hideNativeSplash, 4000);
}
