import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCurrentUser, setAuthCookie, logout as apiLogout, getAuthUrl } from '../services/api';
import { isNativeApp, signInNative } from '../services/native';
import { ApiError } from '../services/apiBase';
import type { User } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  isSigningIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const signingIn = useRef(false);
  const authGeneration = useRef(0);
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    const generation = ++authGeneration.current;
    try {
      const user = await getCurrentUser();
      if (generation !== authGeneration.current) return;
      setState({ user, isLoading: false, isAuthenticated: true, error: null });
    } catch (error) {
      if (generation !== authGeneration.current) return;
      if (error instanceof ApiError && error.status === 401) {
        setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
      } else {
        setState((previous) => ({ ...previous, isLoading: false, error: 'Could not check your account. Reconnect and try again.' }));
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const authError = params.get('auth_error');

    if (authError) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: decodeURIComponent(authError),
      });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (authToken) {
      setAuthCookie(authToken)
        .then(() => {
          window.history.replaceState({}, '', window.location.pathname);
          return checkAuth();
        })
        .catch((err) => {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: err instanceof Error ? err.message : 'Authentication failed',
          });
          window.history.replaceState({}, '', window.location.pathname);
        });
      return;
    }

    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isNativeApp()) return;
    const recheck = () => {
      if (document.visibilityState === 'visible' && !signingIn.current) void checkAuth();
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('online', recheck);
    };
  }, [checkAuth]);

  const login = useCallback(async () => {
    if (signingIn.current) return;
    authGeneration.current++;
    signingIn.current = true;
    setIsSigningIn(true);
    setState((prev) => ({ ...prev, error: null }));
    try {
      if (isNativeApp()) {
        await signInNative();
        const user = await getCurrentUser();
        setState({ user, isLoading: false, isAuthenticated: true, error: null });
        return;
      }
      const { auth_url } = await getAuthUrl(window.location.href);
      window.location.href = auth_url;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'CANCELLED') return;
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start authentication',
      }));
    } finally {
      signingIn.current = false;
      setIsSigningIn(false);
      setState((previous) => ({ ...previous, isLoading: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    authGeneration.current++;
    try {
      await apiLogout();
      authGeneration.current++;
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isSigningIn,
      login,
      logout,
      refetch: checkAuth,
      clearError,
    }),
    [state, isSigningIn, login, logout, checkAuth, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
