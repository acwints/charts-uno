import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration for the iOS App Store build.
 *
 * The web app is BUNDLED into the binary (`webDir` = the Vite build output),
 * so the app opens instantly and works offline for everything it already has.
 * API calls go to https://chartsuno.com (see packages/web/src/services/apiBase.ts),
 * and the session is a bearer token kept in the Keychain because the bundled
 * origin (capacitor://localhost) cannot share the site's cookie jar.
 *
 * Shipping web changes to installed apps therefore needs a new build
 * (`pnpm mobile:ios:sync` rebuilds the web bundle first) until an
 * over-the-air update service is wired in.
 *
 * For local debugging against a dev server, set CAP_SERVER_URL=http://<lan-ip>:5173
 * when running `cap sync`; it is never set in committed config or CI.
 */
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.chartsuno.app',
  appName: 'Chartsuno',
  webDir: '../web/dist',
  ...(devServerUrl ? { server: { url: devServerUrl, cleartext: true } } : {}),
  ios: {
    contentInset: 'never',
    backgroundColor: '#101014',
    // Sign-in opens in ASWebAuthenticationSession (NativeAuthPlugin), never in
    // this webview, so no OAuth hosts are allowed here.
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      // The web app calls SplashScreen.hide() after its first paint so the
      // splash never gives way to a blank frame. main.tsx has a 4s watchdog.
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      // No backgroundColor here: the launch storyboard's LaunchBackground
      // named color already follows light/dark, and this option would force
      // one ground over both appearances.
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
    },
  },
};

export default config;
