import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration for the iOS App Store build.
 *
 * Chartsuno ships as a hybrid "remote URL" Capacitor app: the native shell
 * loads the production SPA from chartsuno.com, so web deploys reach installed
 * apps immediately and an App Store release is only needed for native-shell
 * changes. The Vercel rewrites proxy /api and /auth to the backend on the
 * same origin, so cookie auth works unchanged inside the WKWebView.
 *
 * `webDir` holds only a minimal offline fallback page; it is not the app.
 */
const config: CapacitorConfig = {
  appId: 'com.chartsuno.app',
  appName: 'Chartsuno',
  webDir: 'shell',
  server: {
    url: 'https://chartsuno.com',
    // Keep first-party navigation inside the webview. Google OAuth must NOT
    // be allowed here — Google blocks OAuth inside webviews, so sign-in is
    // opened via the Browser plugin (SFSafariViewController) and returns
    // through the com.chartsuno.app://auth-callback deep link.
    allowNavigation: ['chartsuno.com', 'www.chartsuno.com'],
    // Local page shown when the remote app cannot be loaded (offline).
    errorPath: 'index.html',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#101014',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#101014',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
    },
  },
};

export default config;
