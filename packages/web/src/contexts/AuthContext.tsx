import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCurrentUser, setAuthCookie, logout as apiLogout, getAuthUrl } from '../services/api';
import type { User } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
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
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setState({ user, isLoading: false, isAuthenticated: true, error: null });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
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

  const login = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));
    try {
      const { auth_url } = await getAuthUrl(window.location.href);
      window.location.href = auth_url;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start authentication',
      }));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refetch: checkAuth,
      clearError,
    }),
    [state, login, logout, checkAuth, clearError],
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
