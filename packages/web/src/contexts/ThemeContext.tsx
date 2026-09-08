import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { updateNativeStatusBar } from '../services/native';
import type { ThemeMode } from '@chartsuno/shared';

const THEME_STORAGE_KEY = 'chartsuno-theme';

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

// Keep the browser UI (iOS Safari tab bar, Android status bar, PWA title bar)
// in step with the app theme. Values mirror --bg-primary in index.css.
const THEME_COLORS: Record<ThemeMode, string> = { dark: '#101014', light: '#ffffff' };

function setThemeAttribute(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[theme];
}

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  hasStoredPreference: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const storedTheme = getStoredTheme();
  const [theme, setThemeState] = useState<ThemeMode>(storedTheme ?? getSystemTheme());
  const [hasStoredPreference, setHasStoredPreference] = useState<boolean>(!!storedTheme);

  useEffect(() => {
    setThemeAttribute(theme);
    const applyStatusBar = () => updateNativeStatusBar(theme);
    applyStatusBar();
    window.addEventListener('chartsunoViewDidAppear', applyStatusBar);
    document.addEventListener('visibilitychange', applyStatusBar);
    return () => {
      window.removeEventListener('chartsunoViewDidAppear', applyStatusBar);
      document.removeEventListener('visibilitychange', applyStatusBar);
    };
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (!hasStoredPreference) {
        setThemeState(event.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [hasStoredPreference]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setHasStoredPreference(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, hasStoredPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
