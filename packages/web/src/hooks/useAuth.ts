import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, setAuthCookie, logout as apiLogout, getAuthUrl } from '../services/api';
import type { User } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export function useAuth() {
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
      // Handle OAuth error
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: decodeURIComponent(authError),
      });
      // Clean URL params
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      return;
    }

    if (authToken) {
      // Exchange token for cookie
      setAuthCookie(authToken)
        .then(() => {
          // Clean URL params after successful auth
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
          checkAuth();
        })
        .catch((err) => {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: err instanceof Error ? err.message : 'Authentication failed',
          });
          // Clean URL params even on error
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        });
    } else {
      checkAuth();
    }
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

  return {
    ...state,
    login,
    logout,
    refetch: checkAuth,
    clearError,
  };
}
