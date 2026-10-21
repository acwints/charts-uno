import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCurrentUser, logout as apiLogout, deleteAccount as apiDeleteAccount } from '../services/api';
import { beginBrowserSignIn, finishBrowserSignIn } from '../services/browserAuth';
import { isNativeApp, signInNative, signInWithApple, signInWithReview, restoreNativeSession, clearNativeSession } from '../services/native';
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
  loginWithApple: () => Promise<void>;
  loginWithReview: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
    const authCode = params.get('auth_code');
    const authState = params.get('auth_state') || '';
    const authError = params.get('auth_error');
    const cleanUrl = new URL(window.location.href);
    for (const key of ['auth_code', 'auth_state', 'auth_token', 'auth_error']) cleanUrl.searchParams.delete(key);
    const cleanTarget = `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`;

    if (authError) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: authError,
      });
      window.history.replaceState({}, '', cleanTarget);
      return;
    }

    if (authCode) {
      window.history.replaceState({}, '', cleanTarget);
      finishBrowserSignIn(authCode, authState)
        .then(() => {
          return checkAuth();
        })
        .catch((err) => {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: err instanceof Error ? err.message : 'Authentication failed',
          });
        });
      return;
    }

    if (params.has('auth_token')) window.history.replaceState({}, '', cleanTarget);

    // Native: load the Keychain token before the first account check.
    void restoreNativeSession().then(checkAuth);
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

  const finishNativeSignIn = useCallback(async (start: () => Promise<void>) => {
    if (signingIn.current) return;
    authGeneration.current++;
    signingIn.current = true;
    setIsSigningIn(true);
    setState((prev) => ({ ...prev, error: null }));
    try {
      await start();
      const user = await getCurrentUser();
      setState({ user, isLoading: false, isAuthenticated: true, error: null });
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

  const login = useCallback(async () => {
    if (isNativeApp()) {
      await finishNativeSignIn(signInNative);
      return;
    }
    if (signingIn.current) return;
    authGeneration.current++;
    signingIn.current = true;
    setIsSigningIn(true);
    setState((prev) => ({ ...prev, error: null }));
    try {
      window.location.href = await beginBrowserSignIn(window.location.href);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start authentication',
      }));
    } finally {
      signingIn.current = false;
      setIsSigningIn(false);
      setState((previous) => ({ ...previous, isLoading: false }));
    }
  }, [finishNativeSignIn]);

  const loginWithApple = useCallback(async () => {
    if (!isNativeApp()) return;
    await finishNativeSignIn(signInWithApple);
  }, [finishNativeSignIn]);

  const loginWithReview = useCallback(async (email: string, password: string) => {
    if (!isNativeApp()) return;
    await finishNativeSignIn(() => signInWithReview(email, password));
  }, [finishNativeSignIn]);

  const logout = useCallback(async () => {
    authGeneration.current++;
    try {
      await apiLogout();
      await clearNativeSession();
      authGeneration.current++;
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    authGeneration.current++;
    await apiDeleteAccount();
    await clearNativeSession();
    authGeneration.current++;
    setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isSigningIn,
      login,
      loginWithApple,
      loginWithReview,
      logout,
      deleteAccount,
      refetch: checkAuth,
      clearError,
    }),
    [state, isSigningIn, login, loginWithApple, loginWithReview, logout, deleteAccount, checkAuth, clearError],
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
