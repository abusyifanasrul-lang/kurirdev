import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '@/types';
import { authApi } from '@/services/api';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setSession, clearSession } = useSessionStore();
  const { updateUser: storeUpdateUser } = useUserStore();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');

    setState({
      user,
      token,
      isAuthenticated: !!(token && isAuthenticated && user),
      isLoading: false,
    });
  }, [user, isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    // This maintains original signature but now proxies to useUserStore
    // In a real app, this would perform the manual Fetch, then call storeLogin
    try {
      const response = await authApi.login(email, password);
      if (response.success && response.data) {
        const { user: apiUser, token } = response.data;
        sessionStorage.setItem('auth_token', token);
        setSession(apiUser);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      sessionStorage.removeItem('auth_token');
      clearSession();
    }
  }, [clearSession]);

  const updateUser = useCallback((updatedUser: User) => {
    storeUpdateUser(updatedUser.id, updatedUser);
  }, [storeUpdateUser]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
